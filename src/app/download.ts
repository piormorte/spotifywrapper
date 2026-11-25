/**
 * Saves bytes as a file: the native save dialog where available (Chromium),
 * otherwise a regular download.
 */

interface SaveFilePickerWindow {
  showSaveFilePicker?: (options: {
    suggestedName: string;
    types: { description: string; accept: Record<string, string[]> }[];
  }) => Promise<{
    createWritable: () => Promise<{
      write: (data: Blob) => Promise<void>;
      close: () => Promise<void>;
    }>;
  }>;
}

export interface FileKind {
  readonly mime: string;
  readonly extension: string;
  readonly description: string;
}

export const FILE_KINDS = {
  backup: { mime: 'application/vnd.sqlite3', extension: '.sqlite', description: 'Backup do Liner' },
  png: { mime: 'image/png', extension: '.png', description: 'Imagem PNG' },
  pdf: { mime: 'application/pdf', extension: '.pdf', description: 'Documento PDF' },
} as const satisfies Record<string, FileKind>;

export async function saveFile(
  bytes: Uint8Array,
  fileName: string,
  kind: FileKind,
): Promise<boolean> {
  const blob = new Blob([bytes as Uint8Array<ArrayBuffer>], { type: kind.mime });
  const picker = (window as unknown as SaveFilePickerWindow).showSaveFilePicker;
  if (picker) {
    try {
      const handle = await picker({
        suggestedName: fileName,
        types: [{ description: kind.description, accept: { [kind.mime]: [kind.extension] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return false;
      // Fall through to a regular download.
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 10_000);
  return true;
}
