"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../shared/api/client";
import { AdminLogin } from "./AdminLogin";
import { AdminSidebar } from "./AdminSidebar";
import { AdminTopbar } from "./AdminTopbar";
import { CommandPalette } from "./CommandPalette";
import { ShortcutsHelp, useShortcuts } from "./shortcuts";
import { StepUpDialog } from "./StepUpDialog";
import { ConfirmHost, Toaster } from "./ui";
import { Dashboard } from "./Dashboard";
import { UsersTab } from "./UsersTab";
import { BookingsTab } from "./BookingsTab";
import { ContentTab } from "./ContentTab";
import { SupportTab } from "./SupportTab";
import { BroadcastTab } from "./BroadcastTab";
import { ResetsTab } from "./ResetsTab";
import { ReportsTab } from "./ReportsTab";
import { HealthTab } from "./HealthTab";
import { SettingsTab } from "./SettingsTab";
import { SecurityTab } from "./SecurityTab";
import { ActionsTab } from "./ActionsTab";
import { SECTIONS, isTab } from "./nav";

const THEME_KEY = "frfro_admin_theme";

/** Dark by default; the choice of light is remembered in this browser. */
export function AdminClient() {
  const [theme, setTheme] = useState("dark");
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(THEME_KEY);
      if (saved === "light" || saved === "dark") setTheme(saved);
    } catch {
      // storage can be blocked; stay on the default
    }
  }, []);
  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      try {
        window.localStorage.setItem(THEME_KEY, next);
      } catch {
        // not essential
      }
      return next;
    });
  }, []);
  return (
    <div className="admRoot" data-theme={theme}>
      <AdminApp theme={theme} onToggleTheme={toggleTheme} />
    </div>
  );
}

/**
 * Where the admin is lives in the address bar (/admin?p=users&id=12), so reload, back/forward and a bookmarked or
 * shared link all land on the same page and item. `n` changes on every move so a page starts fresh.
 */
function readLocation() {
  if (typeof window === "undefined") return { tab: "overview", params: {} };
  const query = new URLSearchParams(window.location.search);
  const tab = isTab(query.get("p")) ? query.get("p") : "overview";
  const params = Object.fromEntries([...query.entries()].filter(([key]) => key !== "p"));
  return { tab, params };
}

function useAdminRoute() {
  const [nav, setNav] = useState({ tab: "overview", params: {}, n: 0 });
  useEffect(() => {
    setNav((prev) => ({ ...readLocation(), n: prev.n + 1 }));
    const onPop = () => setNav((prev) => ({ ...readLocation(), n: prev.n + 1 }));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const go = useCallback((tab, params = {}) => {
    const clean = Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ""));
    const query = new URLSearchParams({ ...(tab === "overview" ? {} : { p: tab }), ...clean }).toString();
    window.history.pushState(null, "", query ? `/admin?${query}` : "/admin");
    setNav((prev) => ({ tab, params: clean, n: prev.n + 1 }));
    window.scrollTo({ top: 0 });
  }, []);
  /** Changes the item in the address bar without starting the page over (e.g. selecting a row in a list). */
  const setParam = useCallback((key, value) => {
    const query = new URLSearchParams(window.location.search);
    if (value === null || value === undefined || value === "") query.delete(key);
    else query.set(key, String(value));
    const text = query.toString();
    window.history.replaceState(null, "", text ? `/admin?${text}` : "/admin");
  }, []);
  return { ...nav, go, setParam };
}

const PAGES = {
  overview: Dashboard,
  users: UsersTab,
  bookings: BookingsTab,
  content: ContentTab,
  support: SupportTab,
  broadcast: BroadcastTab,
  resets: ResetsTab,
  reports: ReportsTab,
  health: HealthTab,
  settings: SettingsTab,
  security: SecurityTab,
  actions: ActionsTab
};

function AdminApp({ theme, onToggleTheme }) {
  const [me, setMe] = useState(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const { tab, params, n, go, setParam } = useAdminRoute();

  const refresh = useCallback(async () => {
    try {
      const { payload } = await apiFetch("/api/admin/me");
      setMe(payload.data || { isAdmin: false });
    } catch {
      // offline for a moment: keep what is on screen
    }
  }, []);

  useEffect(() => {
    refresh();
    // A session ends after 30 idle minutes: re-check when the tab comes back and once a minute, so the login form appears instead of silent errors.
    const timer = setInterval(refresh, 60 * 1000);
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  async function logout() {
    await apiFetch("/api/admin/auth/logout", { method: "POST" }).catch(() => null);
    setMe({ isAdmin: false, configured: true });
  }

  const signedIn = Boolean(me?.isAdmin);
  useShortcuts({ enabled: signedIn && !paletteOpen && !helpOpen, go, openPalette: () => setPaletteOpen(true), openHelp: () => setHelpOpen(true), toggleTheme: onToggleTheme });

  if (!me) return <main className="adm admBoot" aria-busy="true"><span className="admBootMark">frfro</span></main>;
  if (!signedIn) return <AdminLogin configured={me.configured !== false} setupKeyConfigured={me.setupKeyConfigured !== false} onDone={refresh} />;

  const Page = PAGES[tab] || Dashboard;
  const badges = { support: me.openTickets || 0, resets: me.pendingResets || 0, health: me.clientErrors || 0 };
  return (
    <div className="admShell">
      <AdminSidebar sections={SECTIONS} active={tab} onSelect={(id) => go(id)} name={me.name} onLogout={logout} theme={theme} onToggleTheme={onToggleTheme} badges={badges} />
      <main className="adm" id="admMain">
        <AdminTopbar tab={tab} name={me.name} onOpenPalette={() => setPaletteOpen(true)} onOpenHelp={() => setHelpOpen(true)} onGo={go} badges={badges} />
        <Page key={n} intent={params} onGo={go} setParam={setParam} onChanged={refresh} name={me.name} />
      </main>
      {paletteOpen ? <CommandPalette onClose={() => setPaletteOpen(false)} onGo={go} onToggleTheme={onToggleTheme} onLogout={logout} onOpenHelp={() => setHelpOpen(true)} /> : null}
      {helpOpen ? <ShortcutsHelp onClose={() => setHelpOpen(false)} /> : null}
      <StepUpDialog />
      <ConfirmHost />
      <Toaster />
    </div>
  );
}
