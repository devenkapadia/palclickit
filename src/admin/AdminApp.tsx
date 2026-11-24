import { useCallback, useMemo, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell, CalendarDays, ClipboardList, FileDown, Globe, Image, LayoutDashboard, LogOut, Menu, PartyPopper,
  Plus, Receipt, Settings as SettingsIcon, Users, Wallet, X,
} from 'lucide-react';
import clsx from 'clsx';
import { api } from '@/lib/api';
import { Logo } from '@/components/Logo';
import { Button, Spinner } from '@/components/ui';
import { Ctx, type AdminCtx, type Row } from './ctx';
import Login from './Login';
import { InquiryDrawer, InquiryFormModal } from './InquiryParts';
import { EventDrawer, EventFormModal, ExpenseModal } from './EventParts';
import Dashboard from './pages/Dashboard';
import Inquiries from './pages/Inquiries';
import WebsiteRequests from './pages/WebsiteRequests';
import Followups from './pages/Followups';
import Bookings from './pages/Bookings';
import CalendarPage from './pages/CalendarPage';
import Expenses from './pages/Expenses';
import Finance from './pages/Finance';
import SocialAdmin from './pages/SocialAdmin';
import WebsiteContent from './pages/WebsiteContent';
import Reports from './pages/Reports';
import SettingsPage from './pages/SettingsPage';

const NAV = [
  { to: '/admin', end: true, label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/requests', label: 'Website requests', icon: Bell },
  { to: '/admin/inquiries', label: 'Inquiries', icon: Users },
  { to: '/admin/followups', label: 'Follow-ups', icon: ClipboardList },
  { to: '/admin/bookings', label: 'Bookings / Events', icon: PartyPopper },
  { to: '/admin/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/admin/expenses', label: 'Expenses', icon: Receipt },
  { to: '/admin/finance', label: 'Finance', icon: Wallet },
  { to: '/admin/social', label: 'Reels & Posts', icon: Image },
  { to: '/admin/content', label: 'Website Content', icon: Globe },
  { to: '/admin/reports', label: 'Reports', icon: FileDown },
  { to: '/admin/settings', label: 'Settings', icon: SettingsIcon },
];

export default function AdminApp() {
  const qc = useQueryClient();
  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get<{ user: AdminCtx['user'] | null }>('/auth/me'),
    staleTime: Infinity,
  });

  if (me.isLoading) return <div className="grid min-h-screen place-items-center bg-sky"><Spinner /></div>;
  if (!me.data?.user) return <Login onDone={() => qc.invalidateQueries({ queryKey: ['me'] })} />;
  return <Shell user={me.data.user} />;
}

function Shell({ user }: { user: AdminCtx['user'] }) {
  const qc = useQueryClient();
  const loc = useLocation();
  const [menu, setMenu] = useState(false);
  const [inqForm, setInqForm] = useState<{ open: boolean; row?: Row | null }>({ open: false });
  const [inqId, setInqId] = useState<number | null>(null);
  const [evId, setEvId] = useState<number | null>(null);
  const [evForm, setEvForm] = useState(false);
  const [exp, setExp] = useState<{ open: boolean; row?: Row | null; preset?: Row }>({ open: false });

  // Sidebar badge: follow-ups that need attention now (overdue + today). Shares its cache key with the Follow-ups page.
  const fu = useQuery({ queryKey: ['followups'], queryFn: () => api.get<Record<'today' | 'overdue', Row[]>>('/admin/followups') });
  const followupsDue = (fu.data?.overdue.length ?? 0) + (fu.data?.today.length ?? 0);
  // Sidebar badge: website requests waiting for approval (re-checked every 30s so new ones show up like a notification).
  const pendingReq = useQuery({ queryKey: ['pending-requests'], queryFn: () => api.get<Row[]>('/admin/inquiries/pending'), refetchInterval: 30_000 });
  const requestsWaiting = pendingReq.data?.length ?? 0;

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } catch { /* session may already be gone */ }
    qc.clear();
    window.location.assign('/admin');
  }, [qc]);

  const ctx = useMemo<AdminCtx>(() => ({
    user,
    addInquiry: (preset) => setInqForm({ open: true, row: preset ?? null }),
    openInquiry: setInqId,
    openEvent: setEvId,
    addEvent: () => setEvForm(true),
    addExpense: (preset) => setExp({ open: true, row: null, preset }),
    editExpense: (row) => setExp({ open: true, row }),
    logout,
  }), [user, logout]);

  // Close mobile menu on navigation.
  const [lastPath, setLastPath] = useState(loc.pathname);
  if (lastPath !== loc.pathname) { setLastPath(loc.pathname); setMenu(false); }

  const sidebar = (
    <nav className="flex h-full flex-col">
      <div className="px-3 pb-4 pt-5"><div className="inline-flex rounded-xl bg-sky px-3 py-2"><Logo size={30} /></div></div>
      <div className="px-3 pb-3">
        <Button className="w-full" onClick={() => ctx.addInquiry()}><Plus className="size-4" /> Add Inquiry</Button>
      </div>
      <ul className="flex-1 space-y-0.5 overflow-y-auto px-2">
        {NAV.map((n) => (
          <li key={n.to}>
            <NavLink to={n.to} end={n.end}
              className={({ isActive }) => clsx('flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition', isActive ? 'bg-sun text-ink' : 'text-slate-300 hover:bg-white/10 hover:text-white')}>
              <n.icon className="size-[18px]" /> {n.label}
              {n.to === '/admin/followups' && followupsDue > 0 && (
                <span className="ml-auto rounded-full bg-sun px-2 text-xs font-bold text-ink" aria-label={`${followupsDue} follow-ups due`}>{followupsDue}</span>
              )}
              {n.to === '/admin/requests' && requestsWaiting > 0 && (
                <span className="ml-auto rounded-full bg-sun px-2 text-xs font-bold text-ink" aria-label={`${requestsWaiting} website requests waiting`}>{requestsWaiting}</span>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
      <div className="border-t border-white/10 p-3">
        <div className="mb-2 truncate px-1 text-xs text-slate-400">{user.email}</div>
        <button onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-white/10 hover:text-white">
          <LogOut className="size-4" /> Sign out
        </button>
        <a href="/" className="mt-1 block px-3 py-1 text-xs text-slate-500 hover:text-slate-300">View website ↗</a>
      </div>
    </nav>
  );

  return (
    <Ctx.Provider value={ctx}>
      <div className="min-h-screen bg-mist text-ink">
        {/* desktop sidebar */}
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 bg-ink lg:block">{sidebar}</aside>

        {/* mobile top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-2 bg-ink px-4 py-2.5 text-white lg:hidden">
          <button onClick={() => setMenu(true)} aria-label="Open menu" className="rounded-md p-1.5 hover:bg-white/10"><Menu className="size-5" /></button>
          <div className="rounded-lg bg-sky px-2.5 py-1"><Logo size={22} /></div>
          <Button size="sm" onClick={() => ctx.addInquiry()}><Plus className="size-4" /> Inquiry</Button>
        </header>
        {menu && (
          <div className="fixed inset-0 z-40 lg:hidden" onMouseDown={(e) => e.target === e.currentTarget && setMenu(false)}>
            <div className="absolute inset-0 bg-ink/50" />
            <aside className="relative h-full w-64 bg-ink">
              <button onClick={() => setMenu(false)} aria-label="Close menu" className="absolute right-2 top-3 rounded-md p-1.5 text-white hover:bg-white/10"><X className="size-5" /></button>
              {sidebar}
            </aside>
          </div>
        )}

        <main className="lg:pl-60">
          <div className="mx-auto max-w-[1400px] p-4 sm:p-6">
            <Routes>
              <Route index element={<Dashboard />} />
              <Route path="requests" element={<WebsiteRequests />} />
              <Route path="inquiries" element={<Inquiries />} />
              <Route path="followups" element={<Followups />} />
              <Route path="bookings" element={<Bookings />} />
              <Route path="calendar" element={<CalendarPage />} />
              <Route path="expenses" element={<Expenses />} />
              <Route path="finance" element={<Finance />} />
              <Route path="social" element={<SocialAdmin />} />
              <Route path="content" element={<WebsiteContent />} />
              <Route path="reports" element={<Reports />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/admin" replace />} />
            </Routes>
          </div>
        </main>
      </div>

      <InquiryFormModal open={inqForm.open} inquiry={inqForm.row} onClose={() => setInqForm({ open: false })} />
      <InquiryDrawer id={inqId} onClose={() => setInqId(null)} />
      <EventDrawer id={evId} onClose={() => setEvId(null)} />
      <EventFormModal open={evForm} onClose={() => setEvForm(false)} />
      <ExpenseModal open={exp.open} expense={exp.row} preset={exp.preset} onClose={() => setExp({ open: false })} />
    </Ctx.Provider>
  );
}

