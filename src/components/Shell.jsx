import { useState } from "react";
import {
  ChevronDown,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { auth } from "../lib/api.js";
import { supabase } from "../lib/supabase.js";
import logoSrc from "../public/Logo.png";

export function Shell({ children, path, navigate }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const sideNav = [
    { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
    { label: "Cases", path: "/cases", icon: FileText },
  ];

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const user = auth.getUser();
  const displayName =
    user?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "User";

  async function handleLogout() {
    // Sign out from Supabase so the server-side session is invalidated
    await supabase.auth.signOut().catch(() => {});
    auth.logout();
    navigate("/login");
  }

  function handleNav(itemPath) {
    navigate(itemPath);
    setMobileOpen(false);
  }

  return (
    <div className="sh-app">
      {mobileOpen && (
        <div
          className="sh-mobile-overlay"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside className={`sh-sidebar${mobileOpen ? " sh-sidebar-open" : ""}`}>
        <div>
          <button
            className="sh-logo-btn"
            type="button"
            onClick={() => handleNav("/dashboard")}
          >
            <img src={logoSrc} alt="DocLens" className="sh-logo-img" />
            <span className="sh-logo-text">DocLens</span>
          </button>

          <nav className="sh-nav" aria-label="Primary">
            {sideNav.map(({ label, path: itemPath, icon: Icon }) => {
              const active =
                path === itemPath ||
                (itemPath !== "/dashboard" && path.startsWith(itemPath));
              return (
                <button
                  key={itemPath}
                  className={`sh-navitem${active ? " sh-active" : ""}`}
                  type="button"
                  onClick={() => handleNav(itemPath)}
                >
                  <Icon size={24} strokeWidth={2} />
                  <span>{label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <nav className="sh-nav sh-nav-footer" aria-label="Account">
          <button className="sh-navitem" type="button" onClick={handleLogout}>
            <LogOut size={24} strokeWidth={2} />
            <span>Logout</span>
          </button>
        </nav>
      </aside>

      <header className="sh-header">
        <div className="sh-header-left">
          <button
            className="sh-hamburger"
            type="button"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? (
              <X size={22} strokeWidth={2} />
            ) : (
              <Menu size={22} strokeWidth={2} />
            )}
          </button>
          <div
            className="sh-header-brand"
            onClick={() => handleNav("/dashboard")}
          >
            <img
              src={logoSrc}
              alt="DocLens Logo"
              className="sh-header-logo-icon"
            />
            <span className="sh-header-brand-title">DocLens</span>
          </div>
        </div>

        <span className="sh-header-date">Today, {today}</span>
        <div className="sh-header-right">
          <button className="sh-user" type="button">
            <span>{displayName}</span>
            <ChevronDown size={18} strokeWidth={2.5} />
          </button>
        </div>
      </header>

      <main className="sh-main">{children}</main>
    </div>
  );
}
