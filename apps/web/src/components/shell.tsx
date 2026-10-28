"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  ChevronRight,
  FileBadge2,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings2,
  ShieldCheck,
  X,
} from "lucide-react";
import { useSession } from "@/lib/session";
import { oauthCallbackTarget } from "@/lib/oauth-redirect";
import { ThemeToggle } from "./theme-toggle";
import { BrandLogo } from "./brand-logo";
import { LanguageSelector } from "./language-selector";
import { useI18n } from "@/lib/i18n-provider";

export function Brand() {
  const { t } = useI18n();
  return (
    <Link className="brand" href="/" aria-label={t("common.orionxHome")}>
      <BrandLogo className="brand-logo" priority width={138} height={36} />
    </Link>
  );
}
export function Shell({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const path = usePathname();
  const router = useRouter();
  const { session, loading, signOut } = useSession();
  const [open, setOpen] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const drawer = useRef<HTMLElement>(null);
  const menu = useRef<HTMLButtonElement>(null);
  const publicPage = ["/", "/login", "/auth/callback"].includes(path);
  const nav = [
    { href: "/dashboard", label: t("shell.overview"), icon: LayoutDashboard },
    { href: "/passport", label: t("shell.myPassport"), icon: FileBadge2 },
    { href: "/verify", label: t("shell.verify"), icon: ShieldCheck },
  ];
  const active = (href: string) =>
    path === href || (href !== "/" && path.startsWith(href + "/"));
  const current = path.startsWith("/admin")
    ? t("shell.administration")
    : nav.find((n) => active(n.href))?.label || t("shell.workspace");
  useEffect(() => {
    const callback = oauthCallbackTarget(path, window.location.search);
    if (callback) router.replace(callback);
  }, [path, router]);
  useEffect(() => {
    setOpen(false);
  }, [path]);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    drawer.current?.querySelector<HTMLButtonElement>(".mobile-close")?.focus();
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key !== "Tab") return;
      const controls = drawer.current?.querySelectorAll<HTMLElement>(
        "a[href], button:not([disabled])",
      );
      if (!controls?.length) return;
      const first = controls[0],
        last = controls[controls.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    const desktop = window.matchMedia("(min-width: 1024px)");
    const close = () => {
      if (desktop.matches) setOpen(false);
    };
    desktop.addEventListener("change", close);
    document.addEventListener("keydown", handle);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", handle);
      desktop.removeEventListener("change", close);
      menu.current?.focus();
    };
  }, [open]);
  async function logOut() {
    try {
      await signOut();
      setOpen(false);
      router.push("/login");
      router.refresh();
    } catch {
      setSignOutError(t("shell.signOutError"));
    }
  }
  const initials = (session?.email?.slice(0, 2) || "OX").toUpperCase();
  return (
    <div className={`shell ${publicPage ? "public-shell" : "workspace-shell"} ${path === "/" ? "landing-shell" : ""}`}>
      {publicPage ? (
        <header className="public-header">
          <Brand />
          <nav aria-label={t("shell.mainNavigation")}>
            <Link href="/#how-it-works">{t("shell.how")}</Link>
            <Link href="/verify">
              Verify a credential <ArrowUpRight size={13} />
            </Link>
          </nav>
          <div className="top-actions">
            <LanguageSelector />
            <ThemeToggle />
            <Link
              className="button secondary btn-sm"
              href={
                session
                  ? session.role === "admin"
                    ? "/admin"
                    : "/dashboard"
                  : "/login"
              }
            >
              {session ? "Open workspace" : "Sign in"}
              <ChevronRight size={14} />
            </Link>
          </div>
        </header>
      ) : (
        <>
          <aside
            ref={drawer}
            className={`workspace-sidebar ${open ? "is-open" : ""}`}
            id="workspace-navigation"
            aria-label={t("shell.workspaceNav")}
          >
            <div className="sidebar-brand">
              <Brand />
              <button
                className="icon-button mobile-close"
                type="button"
                aria-label={t("shell.closeMenu")}
                onClick={() => setOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="university-switch">
              <span className="university-icon">
                <GraduationCap size={19} />
              </span>
              <div>
                <strong>BTU</strong>
                <small>{t("shell.aiSkillsPassport")}</small>
              </div>
              <span className="workspace-label">{t("shell.workspace")}</span>
            </div>
            <div className="nav-caption">{t("shell.workspace").toUpperCase()}</div>
            <nav className="workspace-nav">
              {nav.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active(n.href) ? "page" : undefined}
                  className={active(n.href) ? "active" : ""}
                >
                  <n.icon size={17} />
                  <span>{n.label}</span>
                  {active(n.href) && <span className="nav-active-dot" />}
                </Link>
              ))}
            </nav>
            {session?.role === "admin" && (
              <>
                <div className="nav-caption">{t("shell.university")}</div>
                <nav className="workspace-nav">
                  <Link
                    href="/admin"
                    className={path === "/admin" ? "active" : ""}
                    aria-current={path === "/admin" ? "page" : undefined}
                  >
                    <Settings2 size={17} />
                    Administration
                  </Link>
                </nav>
              </>
            )}
            <div className="sidebar-bottom">
              <div className="network-label">
                <span className="network-dot" />
                Solana Devnet<span className="mono">{t("shell.network")}</span>
              </div>
              <div className="sidebar-account">
                <span className="avatar">{initials}</span>
                <div>
                  <strong>
                    {loading
                      ? t("shell.accountLoading")
                      : session?.email || t("shell.yourWorkspace")}
                  </strong>
                  <small>
                    {session
                      ? session.role === "admin"
                        ? t("shell.adminRole")
                        : session.verification === "UNIVERSITY_VERIFIED"
                          ? t("shell.studentVerified")
                          : t("shell.personalAccount")
                      : t("shell.signInStart")}
                  </small>
                </div>
                {session ? (
                  <button
                    type="button"
                    className="icon-button"
                    onClick={logOut}
                    aria-label={t("common.signOut")}
                  >
                    <LogOut size={15} />
                  </button>
                ) : (
                  <Link href="/login" aria-label={t("common.signIn")}>
                    <ChevronRight size={18} />
                  </Link>
                )}
              </div>
              {signOutError && (
                <p className="field-error" role="alert">
                  {signOutError}
                </p>
              )}
            </div>
          </aside>
          {open && (
            <button
              type="button"
              className="mobile-backdrop"
              aria-label={t("shell.closeNavigation")}
              onClick={() => setOpen(false)}
            />
          )}
          <header className="workspace-topbar" inert={open}>
            <div className="top-left">
              <button
                ref={menu}
                type="button"
                className="icon-button mobile-menu"
                aria-label={t("shell.openMenu")}
                aria-expanded={open}
                aria-controls="workspace-navigation"
                onClick={() => setOpen(true)}
              >
                <Menu size={18} />
              </button>
              <span className="breadcrumb-org">Workspace</span>
              <ChevronRight size={13} className="muted" />
              <span>{current}</span>
            </div>
            <div className="top-actions">
              <span className="topbar-note">
                <ShieldCheck size={14} />
                {path === "/verify" ? t("shell.publicVerification") : t("shell.privateByDefault")}
              </span>
              <ThemeToggle />
            </div>
          </header>
        </>
      )}
      <div className="main" inert={open}>
        <main id="main-content" tabIndex={-1} className="content">
          {children}
        </main>
      </div>
    </div>
  );
}
