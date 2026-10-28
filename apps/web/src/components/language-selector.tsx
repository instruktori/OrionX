"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, Languages } from "lucide-react";
import { useI18n } from "@/lib/i18n-provider";
import { localeNames, type Locale } from "@/lib/i18n";

/**
 * Same icon-button surface, dimensions, and stroke language as ThemeToggle.
 * The popup is a genuine two-option language menu, never a visible select box.
 */
export function LanguageSelector() {
  const { locale, setLocale, t } = useI18n();
  const id = useId();
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const selectLocale = (value: Locale) => {
    setLocale(value);
    setOpen(false);
    trigger.current?.focus();
  };

  return (
    <div className="language-control" ref={container}>
      <button
        type="button"
        ref={trigger}
        className="icon-button theme-toggle language-toggle"
        aria-label={t("common.language")}
        title={t("common.language")}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={open ? id : undefined}
        onClick={() => setOpen(value => !value)}
      >
        <Languages size={17} strokeWidth={1.9} aria-hidden="true" />
      </button>
      {open && (
        <div id={id} role="menu" className="language-menu" aria-label={t("common.language")}>
          {(["en", "ka"] as const).map(value => (
            <button
              type="button"
              key={value}
              role="menuitemradio"
              aria-checked={locale === value}
              className={locale === value ? "language-option is-selected" : "language-option"}
              onClick={() => selectLocale(value)}
            >
              <span lang={value}>{localeNames[value]}</span>
              {locale === value && <Check size={15} aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
