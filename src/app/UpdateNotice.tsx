import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '../ui/Button.tsx';

/**
 * Registers the service worker and offers new versions without forcing a
 * reload in the middle of an import or export.
 */
export function UpdateNotice() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    // Some embedding contexts forbid service workers; the app works without one.
    onRegisterError: () => undefined,
  });

  if (!needRefresh && !offlineReady) return null;

  return (
    <div
      role="status"
      className="fade fixed right-4 bottom-24 z-30 flex max-w-[calc(100vw-2rem)] items-center gap-4 rounded-card bg-surface-2 px-4 py-3 shadow-raised md:bottom-6"
    >
      <p className="text-footnote text-text-1">
        {needRefresh ? 'Há uma nova versão do Liner.' : 'O Liner já funciona sem internet.'}
      </p>
      {needRefresh ? (
        <Button
          variant="primary"
          className="px-3 py-1.5 text-footnote"
          onClick={() => void updateServiceWorker(true)}
        >
          Atualizar
        </Button>
      ) : null}
      <Button
        variant="plain"
        className="text-footnote"
        onClick={() => {
          setNeedRefresh(false);
          setOfflineReady(false);
        }}
      >
        {needRefresh ? 'Depois' : 'Ok'}
      </Button>
    </div>
  );
}
