import type { Database } from '../db/sqlite.ts';
import { MS_PER_DAY, MS_PER_HOUR, MS_PER_MINUTE, STREAM_THRESHOLD_MS } from '../lib/units.ts';
import { aggregateTracks, dataRange, dropAggregate, scanPeriodPlays } from './aggregate.ts';
import { dayKey, resolvePeriod, weekday, type PeriodSpec, type ResolvedPeriod } from './period.ts';

/**
 * Advanced listening metrics (docs/METRICS.md, "Análises"). Every figure has
 * a fixed definition; constants below are part of those definitions.
 */

/** A new session starts when the gap since the previous play exceeds this. */
export const SESSION_GAP_MS = 15 * MS_PER_MINUTE;
/** "Night" = local hours 00:00–05:59. */
export const NIGHT_HOURS = [0, 1, 2, 3, 4, 5] as const;
/** Average month length in days (365.25 / 12). */
export const DAYS_PER_MONTH = 30.4375;
/** An artist "stopped appearing" with at least this many streams before the window… */
export const FADED_MIN_STREAMS = 20;
/** …and no streams in the last this-many days of data. */
export const FADED_WINDOW_DAYS = 365;

export interface Streak {
  readonly days: number;
  readonly start: string;
  readonly end: string;
}

export interface Analytics {
  readonly period: ResolvedPeriod;
  readonly dataFirstDay: string;
  readonly dataLastDay: string;
  /** Longest run of consecutive local days with at least one stream. */
  readonly longestStreak: Streak | null;
  /** Run of days with streams ending on the period's last day. */
  readonly currentStreak: Streak | null;
  /** The most streams of one track on a single local day. */
  readonly mostReplayed: {
    readonly track: string;
    readonly artist: string;
    readonly day: string;
    readonly streams: number;
  } | null;
  readonly sessions: {
    readonly count: number;
    readonly averageMs: number;
    readonly longest: {
      readonly startLocal: number;
      readonly endLocal: number;
      readonly durationMs: number;
      readonly plays: number;
    } | null;
  };
  /** Share of listening time at night (00:00–05:59 local). */
  readonly nightShare: number;
  /** Listening time share per part of the day. */
  readonly dayparts: {
    readonly night: number;
    readonly morning: number;
    readonly afternoon: number;
    readonly evening: number;
  };
  readonly mostActiveHour: { readonly hour: number; readonly share: number } | null;
  /** Average listening time per weekday (Mon–Fri) and weekend day, over calendar days. */
  readonly weekdayAverageMs: number;
  readonly weekendAverageMs: number;
  readonly loyalty: {
    readonly topArtist: string | null;
    readonly top1Share: number;
    readonly top5Share: number;
  };
  readonly diversity: {
    /** Artists with at least one stream. */
    readonly artists: number;
    /** Shannon entropy of streams by artist ÷ ln(artists), in [0, 1]. */
    readonly evenness: number;
    /** exp(entropy): artists that would give the same entropy if equally played. */
    readonly effectiveArtists: number;
  };
  readonly discovery: {
    /** Artists whose first-ever play falls in the period. */
    readonly newArtists: number;
    readonly newArtistShare: number;
    readonly newTracks: number;
    readonly newTrackShare: number;
    readonly topNewArtists: readonly {
      readonly id: number;
      readonly name: string;
      readonly streams: number;
      readonly firstPlay: number;
    }[];
  };
  /** Streams per distinct track with streams. */
  readonly streamsPerTrack: number;
  /** Listening time ÷ (days ÷ 30.4375). */
  readonly monthlyAverageMs: number;
  readonly peakDay: { readonly day: string; readonly msPlayed: number } | null;
}

function streaks(days: readonly number[]): { longest: Streak | null; tail: Streak | null } {
  let longest: Streak | null = null;
  let runStart = 0;
  for (let i = 0; i < days.length; i++) {
    const day = days[i] ?? 0;
    if (i === 0 || day !== (days[i - 1] ?? 0) + 1) runStart = day;
    const length = day - runStart + 1;
    if (!longest || length > longest.days) {
      longest = {
        days: length,
        start: dayKey(runStart * MS_PER_DAY),
        end: dayKey(day * MS_PER_DAY),
      };
    }
  }
  const last = days.at(-1);
  let tail: Streak | null = null;
  if (last !== undefined) {
    let start = last;
    for (let i = days.length - 2; i >= 0 && days[i] === start - 1; i--) start--;
    tail = {
      days: last - start + 1,
      start: dayKey(start * MS_PER_DAY),
      end: dayKey(last * MS_PER_DAY),
    };
  }
  return { longest, tail };
}

/** Days of each kind (weekday, weekend) in [from, to). */
function countDayKinds(from: number, to: number): { weekdays: number; weekends: number } {
  let weekdays = 0;
  let weekends = 0;
  for (let t = from; t < to; t += MS_PER_DAY) {
    if (weekday(t) >= 5) weekends++;
    else weekdays++;
  }
  return { weekdays, weekends };
}

export function analytics(db: Database, spec: PeriodSpec): Analytics | null {
  const range = dataRange(db);
  if (!range) return null;
  const period = resolvePeriod(spec, range);
  if (!period) return null;
  const bind = { ':from': period.from, ':to': period.to };

  // One ordered pass over the period's plays: streak days, hours, weekdays,
  // peak day, sessions and the most replayed track/day.
  const streamDaySet = new Set<number>();
  const hours = new Array<number>(24).fill(0);
  const dayTotals = new Map<number, number>();
  const replays = new Map<string, { day: number; trackId: number; streams: number; ms: number }>();
  let weekdayMs = 0;
  let weekendMs = 0;
  let sessionCount = 0;
  let sessionTotal = 0;
  let longestSession: Analytics['sessions']['longest'] = null;
  let current: {
    start: number;
    end: number;
    localStart: number;
    localEnd: number;
    plays: number;
  } | null = null;
  let prevEnd = Number.NEGATIVE_INFINITY;
  const closeSession = () => {
    if (!current) return;
    const duration = current.end - current.start;
    sessionCount++;
    sessionTotal += duration;
    if (!longestSession || duration > longestSession.durationMs) {
      longestSession = {
        startLocal: current.localStart,
        endLocal: current.localEnd,
        durationMs: duration,
        plays: current.plays,
      };
    }
  };

  scanPeriodPlays(db, period.from, period.to, (p) => {
    const day = Math.floor(p.localEnd / MS_PER_DAY);
    const isStream = p.msPlayed >= STREAM_THRESHOLD_MS;
    if (isStream) streamDaySet.add(day);
    const hour = Math.floor((p.localEnd % MS_PER_DAY) / MS_PER_HOUR);
    hours[hour] = (hours[hour] ?? 0) + p.msPlayed;
    dayTotals.set(day, (dayTotals.get(day) ?? 0) + p.msPlayed);
    if (weekday(p.localEnd) >= 5) weekendMs += p.msPlayed;
    else weekdayMs += p.msPlayed;

    const key = `${String(day)}:${String(p.trackId)}`;
    const replay = replays.get(key) ?? { day, trackId: p.trackId, streams: 0, ms: 0 };
    replay.streams += isStream ? 1 : 0;
    replay.ms += p.msPlayed;
    replays.set(key, replay);

    // Sessions: a gap of more than SESSION_GAP_MS between the previous end and
    // this play's start (end − ms_played) begins a new session.
    const start = p.tsEnd - p.msPlayed;
    const localStart = p.localEnd - p.msPlayed;
    if (!current || start - prevEnd > SESSION_GAP_MS) {
      closeSession();
      current = { start, end: p.tsEnd, localStart, localEnd: p.localEnd, plays: 1 };
    } else {
      current.start = Math.min(current.start, start);
      current.localStart = Math.min(current.localStart, localStart);
      current.end = Math.max(current.end, p.tsEnd);
      current.localEnd = Math.max(current.localEnd, p.localEnd);
      current.plays++;
    }
    prevEnd = p.tsEnd;
  });
  closeSession();

  const streamDays = [...streamDaySet].sort((a, b) => a - b);
  const { longest, tail } = streaks(streamDays);
  const lastDayIndex = Math.floor((period.to - 1) / MS_PER_DAY);
  const currentStreak = tail && streamDays.at(-1) === lastDayIndex ? tail : null;

  const totalMs = hours.reduce((a, b) => a + b, 0);
  const share = (ms: number) => (totalMs > 0 ? ms / totalMs : 0);
  const sumHours = (from: number, to: number) =>
    hours.slice(from, to + 1).reduce((a, b) => a + b, 0);
  let mostActiveHour: Analytics['mostActiveHour'] = null;
  let bestHourMs = 0;
  hours.forEach((ms, hour) => {
    if (ms > bestHourMs) {
      bestHourMs = ms;
      mostActiveHour = { hour, share: share(ms) };
    }
  });
  let peakDay: Analytics['peakDay'] = null;
  for (const [day, ms] of [...dayTotals].sort((a, b) => a[0] - b[0])) {
    if (!peakDay || ms > peakDay.msPlayed)
      peakDay = { day: dayKey(day * MS_PER_DAY), msPlayed: ms };
  }
  const kinds = countDayKinds(period.from, period.to);

  // Most replayed: most streams of one track on one day; ties → more time →
  // earlier day → lower catalog id.
  let bestReplay: { day: number; trackId: number; streams: number; ms: number } | null = null;
  for (const r of replays.values()) {
    if (r.streams === 0) continue;
    if (
      !bestReplay ||
      r.streams > bestReplay.streams ||
      (r.streams === bestReplay.streams &&
        (r.ms > bestReplay.ms ||
          (r.ms === bestReplay.ms &&
            (r.day < bestReplay.day ||
              (r.day === bestReplay.day && r.trackId < bestReplay.trackId)))))
    ) {
      bestReplay = r;
    }
  }
  const replay = bestReplay
    ? db.selectObject(
        `SELECT t.name AS track, a.name AS artist FROM tracks t JOIN artists a ON a.id = t.artist_id
         WHERE t.id = ?`,
        [bestReplay.trackId],
      )
    : undefined;

  // Per-track aggregate for the period, then everything per artist from it.
  aggregateTracks(db, period.from, period.to);
  let artistStreams: { id: number; name: string; streams: number }[];
  let streamedTracks: number;
  let totalStreams: number;
  let periodTracks: number;
  let periodArtists: number;
  let newTracks: number;
  let newArtistRows: Record<string, unknown>[];
  try {
    artistStreams = db
      .selectObjects(
        `SELECT g.artist_id AS id, a.name, SUM(g.streams) AS streams
         FROM temp.tg g JOIN artists a ON a.id = g.artist_id
         GROUP BY g.artist_id HAVING SUM(g.streams) > 0
         ORDER BY streams DESC, SUM(g.ms) DESC, a.name COLLATE NOCASE`,
      )
      .map((r) => ({
        id: Number(r['id']),
        name: typeof r['name'] === 'string' ? r['name'] : '',
        streams: Number(r['streams']),
      }));
    const counts = db.selectObject(
      `SELECT COUNT(*) AS tracks, COALESCE(SUM(streams > 0), 0) AS streamed,
              COALESCE(SUM(streams), 0) AS streams, COUNT(DISTINCT artist_id) AS artists
       FROM temp.tg`,
    );
    periodTracks = Number(counts?.['tracks'] ?? 0);
    streamedTracks = Number(counts?.['streamed'] ?? 0);
    totalStreams = Number(counts?.['streams'] ?? 0);
    periodArtists = Number(counts?.['artists'] ?? 0);

    // Discovery: first-ever registered play per track (one pass over the
    // plays index), rolled up to artists; "new" = first play inside the period.
    db.exec('DROP TABLE IF EXISTS temp.firsts');
    db.exec(`CREATE TEMP TABLE firsts AS
             SELECT p.track_id, t.artist_id, MIN(p.local_end) AS first_play
             FROM plays p JOIN tracks t ON t.id = p.track_id
             WHERE t.kind = 'track' AND p.ms_played > 0
             GROUP BY p.track_id`);
    newTracks = Number(
      db.selectValue(
        `SELECT COUNT(*) FROM temp.firsts WHERE first_play >= :from AND first_play < :to`,
        bind,
      ) ?? 0,
    );
    newArtistRows = db.selectObjects(
      `WITH artist_first AS (
         SELECT artist_id, MIN(first_play) AS first_play FROM temp.firsts GROUP BY artist_id),
       period_streams AS (
         SELECT artist_id, SUM(streams) AS streams FROM temp.tg GROUP BY artist_id)
       SELECT f.artist_id AS id, a.name, f.first_play, COALESCE(ps.streams, 0) AS streams
       FROM artist_first f
       JOIN artists a ON a.id = f.artist_id
       LEFT JOIN period_streams ps ON ps.artist_id = f.artist_id
       WHERE f.first_play >= :from AND f.first_play < :to
       ORDER BY streams DESC, a.name COLLATE NOCASE`,
      bind,
    );
  } finally {
    db.exec('DROP TABLE IF EXISTS temp.firsts');
    dropAggregate(db);
  }
  const streamShare = (n: number) => (totalStreams > 0 ? n / totalStreams : 0);
  let entropy = 0;
  for (const a of artistStreams) {
    const p = streamShare(a.streams);
    if (p > 0) entropy -= p * Math.log(p);
  }
  const n = artistStreams.length;

  return {
    period,
    dataFirstDay: dayKey(range.first),
    dataLastDay: dayKey(range.last),
    longestStreak: longest,
    currentStreak,
    mostReplayed:
      replay && bestReplay
        ? {
            track: typeof replay['track'] === 'string' ? replay['track'] : '',
            artist: typeof replay['artist'] === 'string' ? replay['artist'] : '',
            day: dayKey(bestReplay.day * MS_PER_DAY),
            streams: bestReplay.streams,
          }
        : null,
    sessions: {
      count: sessionCount,
      averageMs: sessionCount > 0 ? sessionTotal / sessionCount : 0,
      longest: longestSession,
    },
    nightShare: share(sumHours(0, 5)),
    dayparts: {
      night: share(sumHours(0, 5)),
      morning: share(sumHours(6, 11)),
      afternoon: share(sumHours(12, 17)),
      evening: share(sumHours(18, 23)),
    },
    mostActiveHour,
    weekdayAverageMs: kinds.weekdays > 0 ? weekdayMs / kinds.weekdays : 0,
    weekendAverageMs: kinds.weekends > 0 ? weekendMs / kinds.weekends : 0,
    loyalty: {
      topArtist: artistStreams[0]?.name ?? null,
      top1Share: streamShare(artistStreams[0]?.streams ?? 0),
      top5Share: streamShare(artistStreams.slice(0, 5).reduce((s, a) => s + a.streams, 0)),
    },
    diversity: {
      artists: n,
      evenness: n > 1 ? entropy / Math.log(n) : 0,
      effectiveArtists: n > 0 ? Math.exp(entropy) : 0,
    },
    discovery: {
      newArtists: newArtistRows.length,
      newArtistShare: periodArtists > 0 ? newArtistRows.length / periodArtists : 0,
      newTracks,
      newTrackShare: periodTracks > 0 ? newTracks / periodTracks : 0,
      topNewArtists: newArtistRows.slice(0, 5).map((r) => ({
        id: Number(r['id']),
        name: typeof r['name'] === 'string' ? r['name'] : '',
        streams: Number(r['streams'] ?? 0),
        firstPlay: Number(r['first_play']),
      })),
    },
    streamsPerTrack: streamedTracks > 0 ? totalStreams / streamedTracks : 0,
    monthlyAverageMs: totalMs / (period.days / DAYS_PER_MONTH),
    peakDay,
  };
}

export interface FadedArtist {
  readonly id: number;
  readonly name: string;
  /** Streams before the final window. */
  readonly streams: number;
  /** Last registered play, local ms. */
  readonly lastPlay: number;
}

/**
 * Artists with at least FADED_MIN_STREAMS streams before the last
 * FADED_WINDOW_DAYS days of data and no stream inside that window.
 * Independent of the selected period. Empty when the history is shorter than
 * the window plus one day.
 */
export function fadedArtists(db: Database, limit = 10): FadedArtist[] {
  const range = dataRange(db);
  if (!range) return [];
  const cutoff = (Math.floor(range.last / MS_PER_DAY) + 1 - FADED_WINDOW_DAYS) * MS_PER_DAY;
  if (cutoff <= range.first) return [];
  return db
    .selectObjects(
      `SELECT t.artist_id AS id, a.name,
              SUM(CASE WHEN p.local_end < :cutoff THEN p.ms_played >= ${STREAM_THRESHOLD_MS} ELSE 0 END) AS before,
              SUM(CASE WHEN p.local_end >= :cutoff THEN p.ms_played >= ${STREAM_THRESHOLD_MS} ELSE 0 END) AS after,
              MAX(p.local_end) AS last_play
       FROM plays p JOIN tracks t ON t.id = p.track_id JOIN artists a ON a.id = t.artist_id
       WHERE t.kind = 'track' AND p.ms_played > 0
       GROUP BY t.artist_id
       HAVING before >= :min AND after = 0
       ORDER BY before DESC, last_play DESC, a.name COLLATE NOCASE
       LIMIT :limit`,
      { ':cutoff': cutoff, ':min': FADED_MIN_STREAMS, ':limit': limit },
    )
    .map((r) => ({
      id: Number(r['id']),
      name: typeof r['name'] === 'string' ? r['name'] : '',
      streams: Number(r['before']),
      lastPlay: Number(r['last_play']),
    }));
}
