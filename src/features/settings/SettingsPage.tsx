import { useEffect, useState } from 'react';
import { useLibrary } from '../../app/library-context.ts';
import { THEME_SEGMENTS, type ThemePreference } from '../../app/theme.ts';
import { formatBytes } from '../../lib/format.ts';
import { Button } from '../../ui/Button.tsx';
import { Section } from '../../ui/Section.tsx';
import { SegmentedControl } from '../../ui/SegmentedControl.tsx';
import { BackupSection } from './BackupSection.tsx';

interface StorageEstimate {
  persisted: boolean | null;
  usage: number | null;
}

async function readStorage(): Promise<StorageEstimate> {
  if (!('storage' in navigator)) return { persisted: null, usage: null };
  const [persisted, estimate] = await Promise.all([
    navigator.storage.persisted().catch(() => null),
    navigator.storage.estimate().catch(() => null),
  ]);
  return { persisted, usage: estimate?.usage ?? null };
}

function StorageSection() {
  const { storage } = useLibrary();
  const [estimate, setEstimate] = useState<StorageEstimate>({ persisted: null, usage: null });

  useEffect(() => {
    const lifecycle = { active: true };
    void readStorage().then((value) => {
      if (lifecycle.active) setEstimate(value);
    });
    return () => {
      lifecycle.active = false;
    };
  }, []);

  const protect = async () => {
    try {
      await navigator.storage.persist();
    } finally {
      setEstimate(await readStorage());
    }
  };

  return (
    <Section title="Armazenamento">
      <dl className="max-w-[60ch] space-y-4 text-callout">
        <div>
          <dt className="font-medium">Banco de dados local</dt>
          <dd className="text-text-2">
            {storage === null
              ? 'Verificando…'
              : storage.persistent
                ? 'Guardado neste dispositivo, no armazenamento privado do navegador.'
                : 'Temporário: os dados não sobrevivem a um recarregamento.'}
            {estimate.usage !== null && ` Uso atual: ${formatBytes(estimate.usage)}.`}
          </dd>
        </div>
        <div>
          <dt className="font-medium">Proteção contra limpeza automática</dt>
          <dd className="text-text-2">
            {estimate.persisted === null
              ? 'Não disponível neste navegador.'
              : estimate.persisted
                ? 'Ativa. O navegador não apaga estes dados para liberar espaço.'
                : 'Inativa. Em pouco espaço, o navegador pode apagar dados de sites. Instalar o Liner como app costuma ativar a proteção.'}
          </dd>
        </div>
      </dl>
      {estimate.persisted === false && (
        <Button className="mt-6" onClick={() => void protect()}>
          Pedir proteção
        </Button>
      )}
    </Section>
  );
}

function EraseSection() {
  const { client, status, setSummary } = useLibrary();
  const [confirming, setConfirming] = useState(false);
  const [state, setState] = useState<'idle' | 'working' | 'done'>('idle');

  const erase = async () => {
    setState('working');
    try {
      setSummary(await client.call('eraseAll', undefined));
      setState('done');
    } catch {
      setState('idle');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Section title="Apagar dados">
      <p className="max-w-[60ch] text-callout text-text-2">
        Remove todo o histórico, as importações e os ajustes deste dispositivo. Faça um backup antes
        se quiser recuperar os dados depois.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        {confirming ? (
          <>
            <Button
              variant="destructive"
              disabled={state === 'working'}
              onClick={() => void erase()}
            >
              {state === 'working' ? 'Apagando…' : 'Apagar definitivamente'}
            </Button>
            <Button
              onClick={() => {
                setConfirming(false);
              }}
            >
              Cancelar
            </Button>
          </>
        ) : (
          <Button
            variant="destructive"
            disabled={status !== 'ready'}
            onClick={() => {
              setState('idle');
              setConfirming(true);
            }}
          >
            Apagar todos os dados…
          </Button>
        )}
      </div>
      {state === 'done' && (
        <p aria-live="polite" className="mt-4 text-footnote text-text-2">
          Todos os dados foram apagados.
        </p>
      )}
    </Section>
  );
}

export function SettingsPage({
  theme,
  onThemeChange,
}: {
  theme: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
}) {
  return (
    <main className="mx-auto max-w-[880px] px-4 pt-8 pb-16 sm:px-8 lg:px-14 lg:pt-14">
      <h1 className="font-display text-display font-semibold">Ajustes</h1>
      <div className="mt-14 space-y-16">
        <BackupSection />
        <StorageSection />
        <Section title="Aparência">
          <SegmentedControl
            label="Tema"
            segments={THEME_SEGMENTS}
            value={theme}
            onChange={onThemeChange}
          />
        </Section>
        <EraseSection />
      </div>
    </main>
  );
}
