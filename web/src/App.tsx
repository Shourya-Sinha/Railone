import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { safeNext } from './lib/safeNext';
import { AppShell } from './components/AppShell';
import { LogoMark } from './components/Logo';
import { LoginPage } from './pages/Login';
import { RegisterPage } from './pages/Register';
import { HomePage } from './pages/Home';

const UnreservedPage = lazy(() => import('./pages/Unreserved'));
const CheckoutPage = lazy(() => import('./pages/Checkout'));
const TicketDetailPage = lazy(() => import('./pages/TicketDetail'));
const MyTicketsPage = lazy(() => import('./pages/MyTickets'));
const HistoryPage = lazy(() => import('./pages/History'));
const PlatformPage = lazy(() => import('./pages/Platform'));
const ReservedPage = lazy(() => import('./pages/Reserved'));
const PnrPage = lazy(() => import('./pages/Pnr'));
const RunningStatusPage = lazy(() => import('./pages/RunningStatus'));
const WalletPage = lazy(() => import('./pages/Wallet'));
const ProfilePage = lazy(() => import('./pages/Profile'));
const NotificationsPage = lazy(() => import('./pages/Notifications'));
const HelpPage = lazy(() => import('./pages/Help'));
const NotFoundPage = lazy(() => import('./pages/NotFound'));
const AdminApp = lazy(() => import('./admin/AdminApp'));

function Splash() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-white" role="status" aria-label="Loading RailwayOne Pro">
      <LogoMark className="size-16 animate-pulse" />
      <p className="text-sm font-medium text-slate-500">RailwayOne Pro · Demo</p>
    </div>
  );
}

function PageFallback() {
  return (
    <div className="space-y-4 pt-6" role="status" aria-label="Loading page">
      <div className="h-7 w-1/2 animate-pulse rounded-lg bg-slate-200" />
      <div className="h-40 animate-pulse rounded-2xl bg-slate-200/70" />
      <div className="h-24 animate-pulse rounded-2xl bg-slate-200/70" />
    </div>
  );
}

function RequireAuth({ children, role }: { children: ReactNode; role?: 'ADMIN' }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <Splash />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  if (role && user.role !== role) return <Navigate to="/" replace state={{ denied: true }} />;
  return <>{children}</>;
}


function GuestOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <Splash />;
  if (user) return <Navigate to={safeNext(new URLSearchParams(loc.search).get('next')) ?? '/'} replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
      <Route path="/register" element={<GuestOnly><RegisterPage /></GuestOnly>} />
      <Route path="/admin/*" element={<RequireAuth role="ADMIN"><Suspense fallback={<Splash />}><AdminApp /></Suspense></RequireAuth>} />
      <Route element={<RequireAuth><AppShell /></RequireAuth>}>
        <Route index element={<HomePage />} />
        {(
          [
            ['unreserved', UnreservedPage], ['checkout/:id', CheckoutPage], ['tickets', MyTicketsPage], ['tickets/:id', TicketDetailPage],
            ['history', HistoryPage], ['platform', PlatformPage], ['reserved', ReservedPage], ['pnr', PnrPage], ['running-status', RunningStatusPage],
            ['wallet', WalletPage], ['profile', ProfilePage], ['notifications', NotificationsPage], ['help', HelpPage], ['*', NotFoundPage],
          ] as const
        ).map(([path, C]) => (
          <Route key={path} path={path} element={<Suspense fallback={<PageFallback />}><C /></Suspense>} />
        ))}
      </Route>
    </Routes>
  );
}
