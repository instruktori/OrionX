"use client";
import { useEffect, useId, useRef } from "react";
import { useI18n } from "@/lib/i18n-provider";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  LoaderCircle,
  X,
  type LucideIcon,
} from "lucide-react";

export function PageHeading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        {description && <p className="lead">{description}</p>}
      </div>
      {children && <div className="page-actions">{children}</div>}
    </div>
  );
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "blue" | "success" | "warning" | "danger";
}) {
  return <span className={`pill badge-${tone}`}>{children}</span>;
}
export function Button({
  children,
  secondary,
  busy,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  secondary?: boolean;
  busy?: boolean;
}) {
  return (
    <button
      {...props}
      type={props.type || "button"}
      disabled={props.disabled || busy}
      aria-busy={busy || undefined}
      className={`button ${secondary ? "secondary" : ""} ${className}`}
    >
      {busy && <LoaderCircle className="spin" size={16} />}
      {children}
    </button>
  );
}
export function EmptyState({
  icon: Icon,
  title,
  description,
  href,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  href?: string;
  action?: string;
}) {
  const { t } = useI18n();
  return (
    <section className="empty-state">
      <span className="empty-icon">
        <Icon size={26} strokeWidth={1.5} />
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
      {href && (
        <Link href={href} className="button secondary">
          {action || t("common.continue")}
          <ArrowRight size={16} />
        </Link>
      )}
    </section>
  );
}
export function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  const {t,locale} = useI18n();
  return (
    <div className="error-state" role="alert">
      <AlertCircle size={20} />
      <div>
        <strong>{t("ui.attention")}</strong>
        <p>{locale === "ka" ? t("ui.fallbackError") : message}</p>
        {retry && (
          <Button secondary onClick={retry}>
            {t("common.retry")}
          </Button>
        )}
      </div>
    </div>
  );
}
export function Skeleton({ rows = 3 }: { rows?: number }) {
  const {t} = useI18n();
  return (
    <div
      role="status"
      aria-label={t("ui.loadingWorkspace")}
      className="skeleton-group"
    >
      <span className="sr-only">{t("common.loading")}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="skeleton"
          style={{ height: i === 0 ? 92 : 64 }}
        />
      ))}
    </div>
  );
}
export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const {t} = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const el = ref.current;
    if (!open || !el) return;
    const previous = document.activeElement as HTMLElement | null;
    el.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      el.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="confirm-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dialog-heading">
        <h2 id={titleId}>{title}</h2>
        <button
          type="button"
          className="icon-button"
          aria-label={t("ui.closeDialog")}
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
