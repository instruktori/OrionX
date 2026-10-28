"use client";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale, type MessageKey, translate } from "./i18n";
type TranslationVars = Record<string,string|number>;
type I18nContextValue = { locale: Locale; setLocale: (next: Locale) => void; t: (key: MessageKey, values?: TranslationVars) => string };
const I18nContext = createContext<I18nContextValue | null>(null);
export function I18nProvider({ initialLocale, children }: { initialLocale: Locale; children: React.ReactNode }) {
  const router = useRouter();
  const [locale,setCurrentLocale] = useState<Locale>(initialLocale);
  const setLocale = useCallback((next: Locale) => {
    if (!isLocale(next)) return;
    // SameSite=Lax keeps a single, same-origin preference through OAuth round trips.
    // Refresh the current RSC tree without navigating, so path, query, and flow state stay intact.
    document.cookie = `${LOCALE_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    document.documentElement.lang = next;
    setCurrentLocale(next);
    router.refresh();
  },[router]);
  const t = useCallback((key: MessageKey, values?: TranslationVars) => translate(locale,key,values),[locale]);
  const value = useMemo(()=>({locale,setLocale,t}),[locale,setLocale,t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n requires an I18nProvider");
  return context;
}
export const FALLBACK_LOCALE = DEFAULT_LOCALE;
