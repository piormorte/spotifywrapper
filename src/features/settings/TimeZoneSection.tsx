import { useEffect, useMemo, useState } from 'react';
import { useLibrary } from '../../app/library-context.ts';
import { deviceTimeZone } from '../../lib/time.ts';
import { Section } from '../../ui/Section.tsx';

function zoneLabel(zone: string): string {
  return zone.replace(/_/g, ' ');
}

/** Time zone for local-time statistics (day boundaries, hour of day). */
export function TimeZoneSection() {
  const { client, status, setSummary } = useLibrary();
  const [zone, setZone] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const device = deviceTimeZone();

  const zones = useMemo(() => {
    const all = Intl.supportedValuesOf('timeZone');
    return all.includes(device) ? all : [device, ...all];
  }, [device]);

  useEffect(() => {
    if (status !== 'ready') return;
    const lifecycle = { active: true };
    void client.call('getTimeZone', undefined).then((value) => {
      if (lifecycle.active) setZone(value);
    });
    return () => {
      lifecycle.active = false;
    };
  }, [client, status]);

  const change = async (next: string) => {
    setZone(next);
    setSaving(true);
    try {
      setSummary(await client.call('setTimeZone', next));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section title="Fuso horário" caption={saving ? 'Recalculando…' : undefined}>
      <p className="max-w-[60ch] text-callout text-text-2">
        Define a que dia e hora cada reprodução pertence. Os arquivos da Spotify registram tudo em
        UTC; se você viajou, as estatísticas por hora refletem o fuso escolhido, não o local da
        viagem.
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <label htmlFor="time-zone" className="sr-only">
          Fuso horário
        </label>
        <select
          id="time-zone"
          className="max-w-full rounded-control bg-fill-1 px-3 py-2 text-callout text-text-1"
          value={zone ?? ''}
          disabled={zone === null || saving}
          onChange={(e) => void change(e.target.value)}
        >
          {zones.map((z) => (
            <option key={z} value={z}>
              {zoneLabel(z)}
              {z === device ? ' (este dispositivo)' : ''}
            </option>
          ))}
        </select>
      </div>
    </Section>
  );
}
