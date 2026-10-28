"use client";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useI18n } from "@/lib/i18n-provider";
export function ThemeToggle() {
  const { t } = useI18n();
  const [theme, setTheme] = useState("light");
  useEffect(() => {
    setTheme(document.documentElement.dataset.theme || "light");
  }, []);
  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    setTheme(next);
    try {
      localStorage.setItem("orionx-theme", next);
    } catch {}
  }
  return (
    <button
      type="button"
      className="icon-button theme-toggle"
      onClick={toggle}
      aria-label={theme === "dark" ? t("theme.switchLight") : t("theme.switchDark")}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
    >
      {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}
