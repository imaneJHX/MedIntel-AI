import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { getWorkspace } from "../../utils/workspaces";
export function AppLayout() {
  const [open, setOpen] = useState(false);
  const main = useRef<HTMLElement>(null);
  const location = useLocation();
  const workspace = getWorkspace(location.pathname);
  const previousPath = useRef(location.pathname);
  useEffect(() => {
    if (previousPath.current !== location.pathname) main.current?.focus();
    previousPath.current = location.pathname;
    document.title = `${workspace.nav.find((item) => item.path === location.pathname)?.label ?? "Page not found"} · ${workspace.title} | MedIntel AI`;
    window.scrollTo(0, 0);
  }, [location.pathname, workspace]);
  useEffect(() => {
    if (!open) return;
    const sidebar = document.getElementById("main-sidebar");
    const focusable = Array.from(
      sidebar?.querySelectorAll<HTMLElement>("a[href], button, select") ?? [],
    ).filter((element) => element.getClientRects().length > 0);
    sidebar?.querySelector<HTMLButtonElement>(".mobile-close")?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        document.querySelector<HTMLButtonElement>(".mobile-menu")?.focus();
      }
      if (event.key === "Tab" && focusable.length) {
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open]);
  return (
    <div className={`app-shell workspace-${workspace.id}`}>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <Sidebar open={open} close={() => setOpen(false)} />
      <div className="workspace">
        <Header open={open} toggle={() => setOpen((value) => !value)} />
        <main id="main-content" ref={main} tabIndex={-1}>
          <Outlet />
        </main>
        <footer className="page-footer">
          <span>
            MedIntel AI <span aria-hidden="true">·</span> Research prototype
          </span>
          <span>Transparent models. Thoughtful exploration.</span>
        </footer>
      </div>
    </div>
  );
}
