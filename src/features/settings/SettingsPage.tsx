import { useEffect, useState } from 'react';
import { useLibrary } from '../../app/library-context.ts';
import { THEME_SEGMENTS, type ThemePreference } from '../../app/theme.ts';
import { formatBytes, formatDate, formatInteger } from '../../lib/format.ts';
import { Button, LinkButton } from '../../ui/Button.tsx';
import { Page, PageHeader } from '../analytics/PageHeader.tsx';
import { Section } from '../../ui/Section.tsx';
import { SegmentedControl } from '../../ui/SegmentedControl.tsx';
import { BackupSection } from './BackupSection.tsx';
import { InstallSection } from './InstallSection.tsx';
import { TimeZoneSection } from './TimeZoneSection.tsx';

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

function ProfileSection({
  displayName,
  onDisplayNameChange,
}: {
  displayName: string;
  onDisplayNameChange: (name: string) => void;
}) {
  const [draft, setDraft] = useState(displayName);
  const [saved, setSaved] = useState(false);
  // Follow outside changes (e.g. the stored name arriving after load).
  const [syncedFrom, setSyncedFrom] = useState(displayName);
  if (syncedFrom !== displayName) {
    setSyncedFrom(displayName);
    setDraft(displayName);
  }
  const save = () => {
    if (draft.trim() === displayName) return;
    onDisplayNameChange(draft);
    setSaved(true);
  };
  return (
    <Section
      title="Perfil"
      caption="Usado na saudação e na retrospectiva. Fica só neste dispositivo."
    >
      <form
        className="flex max-w-[480px] flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <label className="min-w-0 flex-1 text-footnote text-text-2">
          Como devemos chamar você?
          <input
            id="display-name"
            type="text"
            autoComplete="nickname"
            maxLength={40}
            value={draft}
            placeholder="Seu nome (opcional)"
            onChange={(e) => {
              setDraft(e.target.value);
              setSaved(false);
            }}
            onBlur={save}
            className="mt-1.5 block w-full rounded-control bg-fill-1 px-3 py-2 text-callout text-text-1 shadow-[inset_0_0_0_1px_var(--border)] transition-shadow placeholder:text-text-3 focus:shadow-[inset_0_0_0_1px_var(--focus-ring)] focus:outline-none"
          />
        </label>
        <Button type="submit">Salvar</Button>
      </form>
      {saved && (
        <p aria-live="polite" className="mt-3 text-footnote text-text-2">
          Nome salvo.
        </p>
      )}
    </Section>
  );
}

function DataSection() {
  const { summary } = useLibrary();
  return (
    <Section
      title="Seus dados"
      caption="O Liner lê os arquivos que você exporta da sua conta. Nenhuma conexão com serviços externos."
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-[52ch] text-callout text-text-2">
          {summary?.lastPlay
            ? `${formatInteger(summary.registeredPlays)} reproduções de música, até ${formatDate(summary.lastPlay)}. Para atualizar, peça uma nova exportação e importe os arquivos.`
            : 'Nenhum histórico importado ainda.'}
        </p>
        <LinkButton href="#importar">Importar dados</LinkButton>
      </div>
    </Section>
  );
}

export function SettingsPage({
  theme,
  onThemeChange,
  displayName = '',
  onDisplayNameChange = () => undefined,
}: {
  theme: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
  displayName?: string;
  onDisplayNameChange?: (name: string) => void;
}) {
  return (
    <Page>
      <PageHeader eyebrow="Biblioteca" title="Ajustes" data={null} />
      <div className="space-y-12">
        <ProfileSection displayName={displayName} onDisplayNameChange={onDisplayNameChange} />
        <Section title="Aparência">
          <SegmentedControl
            label="Tema"
            segments={THEME_SEGMENTS}
            value={theme}
            onChange={onThemeChange}
          />
        </Section>
        <DataSection />
        <BackupSection />
        <TimeZoneSection />
        <StorageSection />
        <InstallSection />
        <EraseSection />
      </div>
    </Page>
  );
}
