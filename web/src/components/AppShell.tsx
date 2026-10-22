import { NavLink, Outlet, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { Bell, HelpCircle, History, Home, LayoutDashboard, LogOut, Search, Ticket, TrainFront, User, Wallet } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Logo } from './Logo';
import { DemoStrip } from './DemoBanner';

const MOBILE_NAV = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/tickets', label: 'Tickets', icon: Ticket },
  { to: '/wallet', label: 'Wallet', icon: Wallet },
  { to: '/notifications', label: 'Alerts', icon: Bell, badge: true },
  { to: '/profile', label: 'Profile', icon: User },
];

const SIDE_NAV = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/unreserved', label: 'Unreserved ticket', icon: TrainFront },
  { to: '/reserved', label: 'Reserved search', icon: Search },
  { to: '/tickets', label: 'My tickets', icon: Ticket },
  { to: '/history', label: 'Booking history', icon: History },
  { to: '/wallet', label: 'Wallet', icon: Wallet },
  { to: '/notifications', label: 'Notifications', icon: Bell, badge: true },
  { to: '/profile', label: 'Profile & settings', icon: User },
  { to: '/help', label: 'Help & support', icon: HelpCircle },
];

export function AppShell() {
  const { user, unread, logout } = useAuth();
  const loc = useLocation();
  return (
    <div className="min-h-dvh md:flex">
      {/* Desktop / tablet sidebar */}
      <aside className="no-print sticky top-0 hidden h-dvh w-64 shrink-0 flex-col bg-brand-900 text-brand-100 md:flex lg:w-72">
        <div className="px-5 pb-4 pt-6">
          <Logo light />
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3" aria-label="Main">
          {SIDE_NAV.map(({ to, label, icon: Icon, end, badge }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => clsx('flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition', isActive ? 'bg-white/12 text-white' : 'text-brand-100/85 hover:bg-white/6 hover:text-white')}>
              {({ isActive }) => (
                <>
                  <Icon className={clsx('size-5', isActive && 'text-saffron-400')} aria-hidden />
                  <span className="flex-1">{label}</span>
                  {badge && unread > 0 && <span className="rounded-full bg-saffron-500 px-1.5 text-[11px] font-bold text-white">{unread}</span>}
                </>
              )}
            </NavLink>
          ))}
          {user?.role === 'ADMIN' && (
            <NavLink to="/admin" className="mt-3 flex h-11 items-center gap-3 rounded-xl border border-white/15 px-3 text-sm font-medium text-white hover:bg-white/6">
              <LayoutDashboard className="size-5 text-saffron-400" /> Admin dashboard
            </NavLink>
          )}
        </nav>
        <div className="m-3 rounded-xl bg-white/6 p-3">
          <p className="truncate text-sm font-semibold text-white">{user?.name}</p>
          <p className="truncate text-xs text-brand-200">{user?.email}</p>
          <button onClick={() => void logout()} className="mt-2 flex h-9 items-center gap-2 text-xs font-semibold text-brand-200 hover:text-white">
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
        <p className="px-5 pb-4 text-[10px] leading-snug text-brand-300">Independent demo. Not affiliated with Indian Railways, CRIS, IRCTC or RailOne.</p>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <DemoStrip className="no-print" />
        <main key={loc.pathname} className="mx-auto w-full max-w-3xl flex-1 px-4 pb-28 pt-0 animate-fade-up md:px-8 md:pb-12 md:pt-8 lg:max-w-4xl">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 pb-safe backdrop-blur md:hidden" aria-label="Primary">
        <ul className="mx-auto flex max-w-lg">
          {MOBILE_NAV.map(({ to, label, icon: Icon, end, badge }) => (
            <li key={to} className="flex-1">
              <NavLink to={to} end={end} className={({ isActive }) => clsx('relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition', isActive ? 'text-brand-800' : 'text-slate-500')}>
                {({ isActive }) => (
                  <>
                    <span className={clsx('flex h-8 w-14 items-center justify-center rounded-full transition', isActive && 'bg-brand-50')}>
                      <Icon className="size-[22px]" strokeWidth={isActive ? 2.4 : 2} aria-hidden />
                    </span>
                    {label}
                    {badge && unread > 0 && <span className="absolute right-[calc(50%-20px)] top-2 min-w-4 rounded-full bg-saffron-500 px-1 text-center text-[10px] font-bold leading-4 text-white">{unread > 9 ? '9+' : unread}</span>}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
