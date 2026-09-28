import { useCallback, useEffect, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { useBlocker } from 'react-router';
import { IMAGE_ACCEPT, formatBytes, isImageFile, listMedia, uploadImage, type MediaFile } from '../lib/media';
import { Modal } from './dialog';
import { Empty, ErrorBox, Loading } from './ui';

// Building blocks for The Palace's website editors.

// ─────────────────────────────────────────────────────────── toast

export function useToast() {
  const [toast, setToast] = useState<{ text: string; kind: 'ok' | 'error' } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const show = useCallback((text: string, kind: 'ok' | 'error' = 'ok') => {
    clearTimeout(timer.current);
    setToast({ text, kind });
    timer.current = setTimeout(() => setToast(null), kind === 'ok' ? 3500 : 7000);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  const node = (
    <div className="toast-region" role="status" aria-live="polite">
      {toast && (
        <div className={`toast toast-${toast.kind}`}>
          <span>{toast.text}</span>
          <button type="button" className="icon-btn" aria-label="Dismiss" onClick={() => setToast(null)}>
            ×
          </button>
        </div>
      )}
    </div>
  );
  return { show, node };
}

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

// ─────────────────────────────────────────────────────────── unsaved changes

/** Warns before leaving the page (in-app navigation and tab close) while there are unsaved edits. */
export function useUnsavedWarning(dirty: boolean) {
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname);
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    if (window.confirm('You have unsaved changes. Leave without saving?')) blocker.proceed();
    else blocker.reset();
  }, [blocker]);
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);
}

// ─────────────────────────────────────────────────────────── drop zone

export function DropZone({ onFiles, multiple, busy, children }: { onFiles: (files: File[]) => void; multiple?: boolean; busy?: boolean; children?: ReactNode }) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  function take(list: FileList | null) {
    const files = Array.from(list ?? []);
    if (files.length) onFiles(multiple ? files : files.slice(0, 1));
  }
  return (
    <div
      className={`dropzone${over ? ' over' : ''}`}
      onDragOver={(e: DragEvent) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e: DragEvent) => {
        e.preventDefault();
        setOver(false);
        if (!busy) take(e.dataTransfer.files);
      }}
    >
      {children}
      <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? 'Uploading…' : multiple ? 'Choose photos' : 'Upload'}
      </button>
      <span className="muted">or drag {multiple ? 'them' : 'it'} here</span>
      <input
        ref={input}
        type="file"
        accept={IMAGE_ACCEPT}
        multiple={multiple}
        hidden
        onChange={(e) => {
          take(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────── media library picker

export function MediaPicker({ onPick, onClose }: { onPick: (url: string) => void; onClose: () => void }) {
  const [files, setFiles] = useState<MediaFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [folder, setFolder] = useState('all');
  const load = useCallback(() => {
    setError(null);
    listMedia()
      .then(setFiles)
      .catch((e) => setError(errMsg(e)));
  }, []);
  useEffect(load, [load]);
  const folders = Array.from(new Set((files ?? []).map((f) => f.folder)));
  const shown = (files ?? []).filter((f) => folder === 'all' || f.folder === folder);
  return (
    <Modal title="Choose from the media library" onClose={onClose} wide>
      {error && <ErrorBox error={error} onRetry={load} />}
      {!files && !error && <Loading />}
      {files && folders.length > 1 && (
        <div className="row" style={{ marginBottom: 12 }} role="group" aria-label="Folder">
          {['all', ...folders].map((f) => (
            <button key={f} type="button" className="chip" aria-pressed={folder === f} onClick={() => setFolder(f)}>
              {f === 'all' ? 'All' : f}
            </button>
          ))}
        </div>
      )}
      {files && shown.length === 0 && <Empty>No images yet. Upload one first.</Empty>}
      <div className="media-grid">
        {shown.map((f) => (
          <button key={f.path} type="button" className="media-tile" onClick={() => onPick(f.url)}>
            <img src={f.url} alt="" loading="lazy" />
            <span className="small muted">
              {f.folder} · {formatBytes(f.size)}
            </span>
          </button>
        ))}
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────── image picker

export function ImagePicker({ value, onChange, folder, label, hint }: { value: string | null | undefined; onChange: (url: string) => void; folder: string; label: string; hint?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  async function upload(files: File[]) {
    const f = files[0];
    if (!f) return;
    if (!isImageFile(f)) {
      setError('Please choose a photo (JPEG, PNG, WebP or GIF).');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onChange(await uploadImage(f, folder));
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <fieldset className="image-picker">
      <legend>{label}</legend>
      {hint && <p className="muted small" style={{ margin: '0 0 8px' }}>{hint}</p>}
      <div className="image-picker-body">
        <div className="image-preview" aria-live="polite">
          {value ? <img src={value} alt={`Current ${label.toLowerCase()}`} /> : <span className="muted small">No image</span>}
        </div>
        <div className="stack" style={{ flex: 1, minWidth: 220 }}>
          <DropZone onFiles={upload} busy={busy} />
          <div className="row">
            <button type="button" className="btn btn-ghost" onClick={() => setPicking(true)} disabled={busy}>
              Choose from library
            </button>
            {value && (
              <button type="button" className="btn btn-ghost" onClick={() => onChange('')} disabled={busy}>
                Remove
              </button>
            )}
          </div>
          {error && <p className="error" role="alert">{error}</p>}
        </div>
      </div>
      {picking && (
        <MediaPicker
          onClose={() => setPicking(false)}
          onPick={(url) => {
            onChange(url);
            setPicking(false);
          }}
        />
      )}
    </fieldset>
  );
}

// ─────────────────────────────────────────────────────────── list editors

/** Add / remove / move up / move down around any item editor. */
export function ListEditor<T>({
  items,
  onChange,
  render,
  blank,
  itemLabel,
  titleOf,
}: {
  items: T[];
  onChange: (next: T[]) => void;
  render: (item: T, set: (next: T) => void, index: number) => ReactNode;
  blank: () => T;
  itemLabel: string;
  titleOf?: (item: T, index: number) => string;
}) {
  const move = (i: number, d: number) => {
    const next = items.slice();
    const [x] = next.splice(i, 1);
    next.splice(i + d, 0, x!);
    onChange(next);
  };
  return (
    <div className="list-editor">
      {items.map((item, i) => {
        const title = titleOf?.(item, i) || `${itemLabel} ${i + 1}`;
        return (
          <div key={i} className="list-item" role="group" aria-label={title}>
            <div className="spread list-item-head">
              <strong>{title}</strong>
              <div className="row" style={{ gap: 4 }}>
                <button type="button" className="icon-btn" aria-label={`Move ${title} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                  ↑
                </button>
                <button type="button" className="icon-btn" aria-label={`Move ${title} down`} disabled={i === items.length - 1} onClick={() => move(i, 1)}>
                  ↓
                </button>
                <button
                  type="button"
                  className="icon-btn danger"
                  aria-label={`Remove ${title}`}
                  onClick={() => {
                    if (window.confirm(`Remove “${title}”?`)) onChange(items.filter((_, j) => j !== i));
                  }}
                >
                  ×
                </button>
              </div>
            </div>
            {render(item, (n) => onChange(items.map((x, j) => (j === i ? n : x))), i)}
          </div>
        );
      })}
      <button type="button" className="btn btn-secondary" onClick={() => onChange([...items, blank()])}>
        + Add {itemLabel.toLowerCase()}
      </button>
    </div>
  );
}

/** A list of single lines (inclusions, value lines…). */
export function LinesEditor({ items, onChange, itemLabel, multiline }: { items: string[]; onChange: (next: string[]) => void; itemLabel: string; multiline?: boolean }) {
  const move = (i: number, d: number) => {
    const next = items.slice();
    const [x] = next.splice(i, 1);
    next.splice(i + d, 0, x!);
    onChange(next);
  };
  return (
    <div className="lines-editor">
      {items.map((line, i) => (
        <div key={i} className="line-row">
          {multiline ? (
            <textarea aria-label={`${itemLabel} ${i + 1}`} value={line} onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} />
          ) : (
            <input type="text" aria-label={`${itemLabel} ${i + 1}`} value={line} onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} />
          )}
          <button type="button" className="icon-btn" aria-label={`Move ${itemLabel.toLowerCase()} ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)}>
            ↑
          </button>
          <button type="button" className="icon-btn" aria-label={`Move ${itemLabel.toLowerCase()} ${i + 1} down`} disabled={i === items.length - 1} onClick={() => move(i, 1)}>
            ↓
          </button>
          <button type="button" className="icon-btn danger" aria-label={`Remove ${itemLabel.toLowerCase()} ${i + 1}`} onClick={() => onChange(items.filter((_, j) => j !== i))}>
            ×
          </button>
        </div>
      ))}
      <button type="button" className="btn btn-ghost" onClick={() => onChange([...items, ''])}>
        + Add {itemLabel.toLowerCase()}
      </button>
    </div>
  );
}
