import { Component, type ReactNode } from 'react';

interface State {
  readonly failed: boolean;
}

/**
 * Keeps a failure in one screen from blanking the whole app. Data is never
 * logged: only the error name reaches the console.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: Error): void {
    console.error(`Liner: falha ao exibir a tela (${error.name}).`);
  }

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="mx-auto max-w-[880px] px-4 pt-8 pb-16 sm:px-8 lg:px-14 lg:pt-14">
        <h1 className="font-display text-display font-semibold">Algo deu errado</h1>
        <p className="mt-3 max-w-[60ch] text-callout text-text-2">
          Esta tela não pôde ser exibida. Seus dados continuam guardados neste dispositivo. Volte
          para a Visão geral ou recarregue a página.
        </p>
        <a
          href="#visao-geral"
          className="mt-6 inline-flex rounded-control bg-text-1 px-4 py-2 text-callout font-medium text-bg hover:opacity-85"
        >
          Ir para a Visão geral
        </a>
      </main>
    );
  }
}
