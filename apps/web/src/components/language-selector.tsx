"use client";
import { useId } from "react";
import { useI18n } from "@/lib/i18n-provider";
import { isLocale, localeNames, type Locale } from "@/lib/i18n";
export function LanguageSelector() {
  const id = useId();
  const { locale, setLocale, t } = useI18n();
  return (
    <div className="language-select-wrap">
      <label className="sr-only" htmlFor={id}>{t("common.language")}</label>
      <select id={id} className="language-select" aria-label={t("common.language")}
        value={locale} onChange={(event) => {
          const selected = event.currentTarget.value;
          if (isLocale(selected)) setLocale(selected as Locale);
        }}>
        <option value="en">{localeNames.en}</option>
        <option value="ka">{localeNames.ka}</option>
      </select>
    </div>
  );
}
