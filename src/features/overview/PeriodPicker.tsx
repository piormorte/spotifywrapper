import { useState } from 'react';
import type { PeriodPreset, PeriodSpec } from '../../stats/period.ts';
import { SegmentedControl } from '../../ui/SegmentedControl.tsx';

type Choice = PeriodPreset | 'custom';

interface PeriodPickerProps {
  readonly value: PeriodSpec;
  readonly onChange: (spec: PeriodSpec) => void;
  /** Year of the last day with data, used as the "this year" label. */
  readonly dataYear: number | null;
  /** First and last day with data ("YYYY-MM-DD"), bounds for custom dates. */
  readonly bounds: { readonly first: string; readonly last: string } | null;
}

/** Preset periods plus a custom inclusive date range. */
export function PeriodPicker({ value, onChange, dataYear, bounds }: PeriodPickerProps) {
  const [start, setStart] = useState(
    value.preset === 'custom' ? value.start : (bounds?.first ?? ''),
  );
  const [end, setEnd] = useState(value.preset === 'custom' ? value.end : (bounds?.last ?? ''));

  const segments = [
    { value: 'all', label: 'Todo o período', short: 'Tudo' },
    {
      value: 'year',
      label: dataYear ? String(dataYear) : 'Ano',
      short: dataYear ? String(dataYear) : 'Ano',
    },
    { value: '12m', label: '12 meses', short: '12 m' },
    { value: '6m', label: '6 meses', short: '6 m' },
    { value: '30d', label: '30 dias', short: '30 d' },
    { value: 'custom', label: 'Datas', short: 'Datas' },
  ] as const satisfies readonly { value: Choice; label: string; short: string }[];

  const select = (choice: Choice) => {
    if (choice !== 'custom') {
      onChange({ preset: choice });
      return;
    }
    const s = start || bounds?.first || '';
    const e = end || bounds?.last || '';
    setStart(s);
    setEnd(e);
    onChange({ preset: 'custom', start: s, end: e });
  };

  const applyCustom = (s: string, e: string) => {
    setStart(s);
    setEnd(e);
    if (s && e && s <= e) onChange({ preset: 'custom', start: s, end: e });
  };

  const dateClass =
    'numeric rounded-control bg-fill-1 px-3 py-1.5 text-footnote text-text-1 [color-scheme:inherit]';

  return (
    <div className="flex w-full flex-col items-stretch gap-3 sm:w-auto sm:items-end">
      <SegmentedControl
        label="Período"
        segments={segments}
        value={value.preset}
        onChange={select}
        fullWidth
      />
      {value.preset === 'custom' && (
        <div className="flex flex-wrap items-center gap-2 text-footnote text-text-2">
          <label htmlFor="period-start" className="sr-only">
            Data inicial
          </label>
          <input
            id="period-start"
            type="date"
            className={dateClass}
            value={start}
            min={bounds?.first}
            max={bounds?.last}
            onChange={(e) => {
              applyCustom(e.target.value, end);
            }}
          />
          <span aria-hidden>até</span>
          <label htmlFor="period-end" className="sr-only">
            Data final
          </label>
          <input
            id="period-end"
            type="date"
            className={dateClass}
            value={end}
            min={bounds?.first}
            max={bounds?.last}
            onChange={(e) => {
              applyCustom(start, e.target.value);
            }}
          />
          {start && end && start > end && (
            <span className="w-full text-critical sm:w-auto">
              A data inicial vem depois da final.
            </span>
          )}
        </div>
      )}
    </div>
  );
}
