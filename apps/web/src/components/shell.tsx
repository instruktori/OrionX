"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutDashboard,
  ShieldCheck,
  Settings2,
  FileBadge2,
  Menu,
  X,
  Sparkles,
  LogOut,
  LogIn,
  ArrowLeftRight,
} from "lucide-react";
import { useSession } from "@/lib/session";
import { oauthCallbackTarget } from "@/lib/oauth-redirect";

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const mobileDrawer = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const { session, signOut } = useSession();

  const navItems = useMemo(() => {
    const items = [{ href: "/", label: "Overview", icon: LayoutDashboard }];
    if (session?.role === "admin") {
      items.push({ href: "/admin", label: "Admin", icon: Settings2 });
      if (session.studentId) {
        items.push({ href: "/passport", label: "Passport", icon: FileBadge2 });
      }
    } else if (session?.role === "student") {
      items.push({ href: "/passport", label: "Passport", icon: FileBadge2 });
    }
    items.push({ href: "/verify", label: "Verify", icon: ShieldCheck });
    return items;
  }, [session?.role, session?.studentId]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    mobileDrawer.current?.querySelector<HTMLButtonElement>(".mobile-close")?.focus();
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) setOpen(false);
    };
    const desktop = window.matchMedia("(min-width: 861px)");
    desktop.addEventListener("change", closeOnDesktop);
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
      if (event.key !== "Tab") return;
      const controls = mobileDrawer.current?.querySelectorAll<HTMLElement>(
        "a[href], button:not([disabled])",
      );
      if (!controls?.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      desktop.removeEventListener("change", closeOnDesktop);
      document.removeEventListener("keydown", handleKey);
      menuButton.current?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const callback = oauthCallbackTarget(path, window.location.search);
    if (callback) router.replace(callback);
  }, [path, router]);

  const handleSignOut = async () => {
    await signOut();
    setOpen(false);
    router.push("/login");
    router.refresh();
  };

  const roleBadge = session
    ? session.role === "admin"
      ? session.studentId
        ? "ADMIN+STUDENT"
        : "ADMIN"
      : session.verification === "UNIVERSITY_VERIFIED"
        ? "VERIFIED"
        : "STUDENT"
    : null;

  const isDualRole = session?.role === "admin" && Boolean(session?.studentId);
  const shortIdentity = session?.email
    ? session.email.split("@")[0]
    : session
      ? "Account"
      : "";

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="top-left">
            <button
              ref={menuButton}
              type="button"
              className="mobile-menu"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              aria-controls="workspace-navigation"
              onClick={() => setOpen(!open)}
            >
              {open ? <X size={18} /> : <Menu size={18} />}
            </button>
            <Link
              className="brand"
              href="/"
              onClick={() => setOpen(false)}
              aria-label="OrionX home"
            >
              <span className="brand-mark">
                <Sparkles size={15} />
              </span>
              <span className="brand-name">
                orion<span>x</span>
              </span>
            </Link>
            <span className="demo-chip" title="Solana Devnet simulated issuer environment">
              <span className="status-dot" /> DEVNET
            </span>

            <nav className="top-nav" aria-label="Main navigation">
              {navItems.map((item) => {
                const active = path === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={active ? "top-nav-link active" : "top-nav-link"}
                  >
                    <item.icon size={14} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="top-actions">
            {session ? (
              <div className="session-cluster">
                <Link
                  href={
                    isDualRole
                      ? path === "/admin"
                        ? "/passport"
                        : "/admin"
                      : session.role === "admin"
                        ? "/admin"
                        : "/passport"
                  }
                  className="session-pill"
                  title={
                    isDualRole
                      ? `${session.email || session.subject} — Click to switch between Admin and Passport`
                      : session.email || session.subject
                  }
                >
                  <span className={`role-dot ${session.role === "admin" ? "dot-blue" : "dot-pink"}`} />
                  <span className="session-email">{shortIdentity}</span>
                  <span className={`role-tag ${session.role === "admin" ? "tag-blue" : "tag-pink"}`}>
                    {roleBadge}
                  </span>
                </Link>
                <button
                  type="button"
                  className="top-auth-btn"
                  onClick={handleSignOut}
                  aria-label="Sign out"
                  title="Sign out"
                >
                  <LogOut size={14} />
                </button>
              </div>
            ) : (
              <Link className="button btn-sm top-signin-cta" href="/login">
                <LogIn size={14} />
                <span>Sign in</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      <aside
        ref={mobileDrawer}
        id="workspace-navigation"
        className={open ? "sidebar sidebar-open" : "sidebar"}
        aria-label="Mobile navigation"
      >
        <button
          type="button"
          className="mobile-close"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        >
          <X size={20} />
        </button>
        <Link
          className="brand"
          href="/"
          onClick={() => setOpen(false)}
          aria-label="OrionX home"
        >
          <span className="brand-mark">
            <Sparkles size={18} />
          </span>
          <span className="brand-name">
            orion<span>x</span>
            <small>AI SKILLS PASSPORT</small>
          </span>
        </Link>
        <div className="nav-caption">NAVIGATION</div>
        <nav className="nav">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={path === item.href ? "page" : undefined}
              className={path === item.href ? "active" : ""}
              onClick={() => setOpen(false)}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        {isDualRole && (
          <div className="sidefoot">
            <ArrowLeftRight size={16} />
            <b>Dual-role account</b>
            <p>
              Your Google account is authorized for Administration and linked to a personal Student Passport.
            </p>
          </div>
        )}
        <div className="sidebar-bottom">
          <span className="avatar">
            {session?.role === "admin"
              ? "AD"
              : session?.role === "student"
                ? "ST"
                : "OX"}
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <b
              style={{
                display: "block",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {session?.email || "Guest Visitor"}
            </b>
            <small>
              {session ? `${roleBadge} SESSION` : "Not signed in"}
            </small>
          </div>
          {session ? (
            <button
              type="button"
              className="icon-signout"
              aria-label="Sign out"
              title="Sign out"
              onClick={handleSignOut}
            >
              <LogOut size={15} />
            </button>
          ) : (
            <Link
              href="/login"
              className="button btn-sm"
              onClick={() => setOpen(false)}
            >
              Sign in
            </Link>
          )}
        </div>
      </aside>

      {open && (
        <button
          className="mobile-backdrop"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}

      <div className="main" inert={open}>
        <main id="main-content" tabIndex={-1} className="content">
          {children}
        </main>
      </div>
    </div>
  );
}
