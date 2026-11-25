import { useSyncExternalStore } from 'react';
import {
  canPromptInstall,
  isAppleMobile,
  isInstalled,
  promptInstall,
  subscribeInstall,
} from '../../pwa/install.ts';
import { Button } from '../../ui/Button.tsx';
import { Section } from '../../ui/Section.tsx';

export function InstallSection() {
  const canPrompt = useSyncExternalStore(subscribeInstall, canPromptInstall, () => false);
  const installed = isInstalled();

  return (
    <Section title="Instalar o app">
      <p className="max-w-[60ch] text-callout text-text-2">
        Instalado, o Liner abre em janela própria, funciona sem internet e o navegador tende a
        proteger os dados contra limpeza automática.
      </p>
      <div className="mt-6">
        {installed ? (
          <p className="text-callout">O Liner está instalado neste dispositivo.</p>
        ) : canPrompt ? (
          <Button variant="primary" onClick={() => void promptInstall()}>
            Instalar o Liner
          </Button>
        ) : isAppleMobile() ? (
          <p className="max-w-[60ch] text-callout">
            No Safari, toque em Compartilhar e depois em “Adicionar à Tela de Início”.
          </p>
        ) : (
          <p className="max-w-[60ch] text-callout">
            Use a opção “Instalar” na barra de endereço ou no menu do navegador. No Chrome e no
            Edge, ela aparece como “Instalar o Liner”.
          </p>
        )}
      </div>
    </Section>
  );
}
