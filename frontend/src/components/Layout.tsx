import { BarChart3, FileText, FolderKanban, LayoutDashboard, ListChecks, Menu, Receipt, ShieldAlert, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useDemo } from '../context/Demo';

export function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#4f46e5" />
      <circle cx="15" cy="15" r="7" fill="none" stroke="#fff" strokeWidth="2.5" />
      <path d="M20.5 20.5 26 26" stroke="#5eead4" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

const FUTURE = [
  { label: 'BOQ & Documents', icon: FileText },
  { label: 'Price Intelligence', icon: BarChart3 },
  { label: 'Quotations', icon: Receipt },
  { label: 'Milestones', icon: ListChecks },
];

export function Layout() {
  const [open, setOpen] = useState(false);
  const { showDemo, setShowDemo } = useDemo();
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="shell">
      <a href="#main" className="skip-link">Skip to content</a>
      {open && <div className="scrim" onClick={() => setOpen(false)} aria-hidden="true" />}
      <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Primary">
        <div className="brand">
          <BrandMark />
          <div><span className="brand-name">TenderLens</span><span className="brand-tag">Procurement intelligence</span></div>
          <button type="button" className="icon-btn sidebar-close" aria-label="Close navigation" onClick={() => setOpen(false)}><X size={18} /></button>
        </div>
        <nav>
          <ul className="nav-list">
            <li><NavLink to="/" end className="nav-link"><LayoutDashboard size={18} aria-hidden="true" />Dashboard</NavLink></li>
            <li><NavLink to="/projects" className="nav-link"><FolderKanban size={18} aria-hidden="true" />Projects</NavLink></li>
          </ul>
          <p className="nav-group">Roadmap - not yet available</p>
          <ul className="nav-list">
            {FUTURE.map(({ label, icon: Icon }) => (
              <li key={label}><span className="nav-link disabled" aria-disabled="true"><Icon size={18} aria-hidden="true" />{label}<span className="soon">Soon</span></span></li>
            ))}
          </ul>
        </nav>
        <p className="sidebar-foot">v0.1 · Feature 1<br />Development build</p>
      </aside>

      <div className="main-col">
        <header className="topbar">
          <button type="button" className="icon-btn menu-btn" aria-label="Open navigation" onClick={() => setOpen(true)}><Menu size={22} /></button>
          <div className="dev-chip" title="No sign-in or access control exists yet. Do not enter real customer or confidential data.">
            <ShieldAlert size={15} aria-hidden="true" /><span>Development build · no authentication</span>
          </div>
          <label className="switch">
            <input type="checkbox" role="switch" checked={showDemo} onChange={(e) => setShowDemo(e.target.checked)} />
            <span className="track" aria-hidden="true"><span className="thumb" /></span>
            <span>Show demo data</span>
          </label>
        </header>
        <main id="main" tabIndex={-1} className="content"><Outlet /></main>
      </div>
    </div>
  );
}
