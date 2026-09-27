"use client";

import { useEffect, useId, useRef, useState, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// Form fields -------------------------------------------------------------------

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: ReactNode;
  error?: string;
  hint?: ReactNode;
}

export function Field({ label, error, hint, className, id, ...rest }: FieldProps) {
  const auto = useId();
  const inputId = id ?? auto;
  const describedBy = error ? `${inputId}-err` : hint ? `${inputId}-hint` : undefined;
  return (
    <div className={cn("field", className)}>
      <label htmlFor={inputId}>{label}</label>
      <input id={inputId} className="input" aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...rest} />
      {hint && !error ? (
        <small id={`${inputId}-hint`} className="text-ink-soft">
          {hint}
        </small>
      ) : null}
      {error ? (
        <small id={`${inputId}-err`} className="field-error">
          {error}
        </small>
      ) : null}
    </div>
  );
}

interface AreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: ReactNode;
  error?: string;
  hint?: ReactNode;
}

export function TextArea({ label, error, hint, className, id, ...rest }: AreaProps) {
  const auto = useId();
  const inputId = id ?? auto;
  const describedBy = error ? `${inputId}-err` : hint ? `${inputId}-hint` : undefined;
  return (
    <div className={cn("field", className)}>
      <label htmlFor={inputId}>{label}</label>
      <textarea id={inputId} className="input" aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...rest} />
      {hint && !error ? (
        <small id={`${inputId}-hint`} className="text-ink-soft">
          {hint}
        </small>
      ) : null}
      {error ? (
        <small id={`${inputId}-err`} className="field-error">
          {error}
        </small>
      ) : null}
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl border border-[#f3b3bc] bg-[#fff1f3] px-4 py-3 text-[0.95rem] font-medium text-red-pen">
      {message}
    </p>
  );
}

// Avatar ----------------------------------------------------------------------------

export function Avatar({
  emoji,
  url,
  name,
  size = 56,
  className,
}: {
  emoji: string;
  url: string | null;
  name: string;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn("inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-blue-soft", className)}
      style={{ width: size, height: size, fontSize: size * 0.58, lineHeight: 1 }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={`Ảnh của ${name}`} width={size} height={size} className="h-full w-full object-cover" />
      ) : (
        <span role="img" aria-label={`Sticker của ${name}`}>
          {emoji}
        </span>
      )}
    </span>
  );
}

// Dialog --------------------------------------------------------------------------------

export function Sheet({
  open,
  onClose,
  title,
  children,
  wide,
  footer,
}: {
  open: boolean;
  onClose(): void;
  title: ReactNode;
  children: ReactNode;
  wide?: boolean;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const pressedBackdrop = useRef(false);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      // React doesn't write the autofocus attribute, so showModal would focus the close button instead.
      d.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={cn("sheet", wide && "sheet-wide")}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      // Close on a click on the dim backdrop only, not when a text selection that began inside ends outside.
      onPointerDown={(e) => {
        pressedBackdrop.current = e.target === ref.current;
      }}
      onClick={(e) => {
        if (e.target === ref.current && pressedBackdrop.current) onClose();
        pressedBackdrop.current = false;
      }}
    >
      {open ? (
        <div className="flex max-h-[calc(100dvh-32px)] flex-col">
          <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
            <h2 id={titleId} className="text-2xl font-bold">
              {title}
            </h2>
            <button type="button" onClick={onClose} className="btn btn-ghost btn-sm -mr-2 !px-2" aria-label="Đóng">
              <X size={20} />
            </button>
          </header>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {footer ? <footer className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">{footer}</footer> : null}
        </div>
      ) : null}
    </dialog>
  );
}

/** A yes/no question that names the action on its button. */
export function Confirm({
  open,
  title,
  body,
  action,
  danger,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body: ReactNode;
  action: string;
  danger?: boolean;
  onConfirm(): void | Promise<void>;
  onClose(): void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Thôi
          </button>
          <button
            type="button"
            className={cn("btn", danger ? "btn-danger" : "btn-primary")}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await onConfirm();
              setBusy(false);
            }}
          >
            {action}
          </button>
        </>
      }
    >
      <div className="text-[1.02rem]">{body}</div>
    </Sheet>
  );
}

// Toasts ------------------------------------------------------------------------------------

type ToastKind = "ok" | "error";
const TOAST_EVENT = "lhhp-toast";

export function toast(message: string, kind: ToastKind = "ok") {
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: { message, kind } }));
}

export function Toaster() {
  const [items, setItems] = useState<{ id: number; message: string; kind: ToastKind }[]>([]);
  useEffect(() => {
    let n = 0;
    const onToast = (e: Event) => {
      const { message, kind } = (e as CustomEvent<{ message: string; kind: ToastKind }>).detail;
      const id = ++n;
      setItems((xs) => [...xs.slice(-2), { id, message, kind }]);
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), kind === "error" ? 6000 : 3200);
    };
    window.addEventListener(TOAST_EVENT, onToast);
    return () => window.removeEventListener(TOAST_EVENT, onToast);
  }, []);
  return (
    // At the top, so a toast never covers the undo bar, the selection bar or a phone's bottom navigation.
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-16 z-[70] flex flex-col items-center gap-2 px-4">
      {items.map((t) => (
        <div
          key={t.id}
          role={t.kind === "error" ? "alert" : "status"}
          className={cn(
            "pop-in max-w-md rounded-2xl px-4 py-3 font-semibold shadow-lg",
            t.kind === "error" ? "bg-red-pen text-white" : "bg-ink text-white",
          )}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}

// States -------------------------------------------------------------------------------------

export function Loading({ label = "Đang tải…" }: { label?: string }) {
  return (
    <div className="grid place-items-center py-16 text-ink-soft" role="status">
      <span className="mb-2 animate-bounce text-4xl motion-reduce:animate-none" aria-hidden>
        💧
      </span>
      {label}
    </div>
  );
}

export function Empty({ emoji, title, children }: { emoji: string; title: string; children?: ReactNode }) {
  return (
    <div className="paper grid place-items-center px-6 py-10 text-center">
      <span className="mb-2 text-5xl" aria-hidden>
        {emoji}
      </span>
      <p className="font-display text-xl font-bold">{title}</p>
      {children ? <div className="mt-2 max-w-md text-ink-soft">{children}</div> : null}
    </div>
  );
}

export function LoadError({ message, onRetry }: { message: string; onRetry?(): void }) {
  return (
    <div className="paper grid place-items-center gap-3 px-6 py-10 text-center" role="alert">
      <p className="font-semibold text-red-pen">{message}</p>
      {onRetry ? (
        <button type="button" className="btn btn-ghost" onClick={onRetry}>
          Thử lại
        </button>
      ) : null}
    </div>
  );
}

// Celebration ---------------------------------------------------------------------------------

const CONFETTI_COLORS = ["#ff8fb8", "#a9dbf5", "#ffd84d", "#a8e6c3", "#c3aef0", "#ffba88"];

export function Confetti({ pieces = 70 }: { pieces?: number }) {
  const [bits] = useState(() =>
    Array.from({ length: pieces }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.6,
      duration: 1.8 + Math.random() * 1.6,
      dx: `${(Math.random() - 0.5) * 30}vw`,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      round: Math.random() > 0.6,
    })),
  );
  return (
    <div aria-hidden>
      {bits.map((b, i) => (
        <span
          key={i}
          className="confetti"
          style={{
            left: `${b.left}vw`,
            background: b.color,
            animationDelay: `${b.delay}s`,
            animationDuration: `${b.duration}s`,
            borderRadius: b.round ? "50%" : "2px",
            ["--dx" as string]: b.dx,
          }}
        />
      ))}
    </div>
  );
}
