import { lazy, Suspense, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import clsx from 'clsx';
import { Activity, ArrowLeft, CreditCard, FileWarning, LayoutDashboard, Menu, MapPin, Ticket, Users, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Logo } from '@/components/Logo';
import { ListSkeleton } from '@/components/ui/feedback';

const Overview = lazy(() => import('./Overview'));
const UsersPage = lazy(() => import('./Users'));
const BookingsPage = lazy(() => import('./Bookings'));
const TransactionsPage = lazy(() => import('./Transactions'));
const StationsPage = lazy(() => import('./Stations'));
const HealthPage = lazy(() => import('./Health'));
const LogsPage = lazy(() => import('./Logs'));

const NAV = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/bookings', label: 'Bookings', icon: Ticket },
  { to: '/admin/transactions', label: 'Transactions', icon: CreditCard },
  { to: '/admin/stations', label: 'Stations', icon: MapPin },
  { to: '/admin/health', label: 'System health', icon: Activity },
  { to: '/admin/logs', label: 'Error & audit logs', icon: FileWarning },
];

export default function AdminApp() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const nav = (
    <nav aria-label="Admin" className="space-y-0.5 px-3">
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)} className={({ isActive }) => clsx('flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition', isActive ? 'bg-white/12 text-white' : 'text-slate-300 hover:bg-white/6 hover:text-white')}>
          {({ isActive }) => <><Icon className={clsx('size-5', isActive && 'text-saffron-400')} />{label}</>}
        </NavLink>
      ))}
      <Link to="/" className="mt-4 flex h-11 items-center gap-3 rounded-xl border border-white/15 px-3 text-sm font-medium text-slate-200 hover:bg-white/6"><ArrowLeft className="size-5" /> Back to app</Link>
    </nav>
  );
  return (
    <div className="min-h-dvh bg-slate-50 lg:flex">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col bg-slate-900 lg:flex">
        <div className="px-5 pb-1 pt-6"><Logo light /></div>
        <p className="mb-5 px-5 text-[11px] font-bold uppercase tracking-widest text-saffron-400">Admin console</p>
        <div className="flex-1 overflow-y-auto">{nav}</div>
        <p className="p-5 text-xs text-slate-400">Signed in as <span className="font-semibold text-slate-200">{user?.email}</span></p>
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 bg-slate-900 px-2 text-white lg:hidden">
        <button type="button" onClick={() => setOpen(true)} aria-label="Open admin menu" className="flex size-11 items-center justify-center rounded-full hover:bg-white/10"><Menu className="size-5" /></button>
        <Logo light />
        <span className="ml-auto mr-2 rounded bg-saffron-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">Admin</span>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Admin menu">
          <div className="absolute inset-0 bg-slate-950/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 bg-slate-900 py-4 animate-fade-up">
            <div className="mb-4 flex items-center justify-between px-4"><Logo light /><button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="flex size-11 items-center justify-center rounded-full text-white hover:bg-white/10"><X className="size-5" /></button></div>
            {nav}
          </div>
        </div>
      )}

      <main className="min-w-0 flex-1">
        <div className="bg-saffron-50 px-4 py-1.5 text-center text-xs font-medium text-saffron-700 ring-1 ring-saffron-100">Demo administration · all data is simulated · no real tickets or payments</div>
        <div className="mx-auto max-w-7xl p-4 md:p-8">
          <Suspense fallback={<ListSkeleton rows={5} />}>
            <Routes>
              <Route index element={<Overview />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="bookings" element={<BookingsPage />} />
              <Route path="transactions" element={<TransactionsPage />} />
              <Route path="stations" element={<StationsPage />} />
              <Route path="health" element={<HealthPage />} />
              <Route path="logs" element={<LogsPage />} />
              <Route path="*" element={<Navigate to="/admin" replace />} />
            </Routes>
          </Suspense>
        </div>
      </main>
    </div>
  );
}
