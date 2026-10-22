import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export function PageHeader({ title, subtitle, back = true, action, backTo }: { title: string; subtitle?: string; back?: boolean; action?: ReactNode; backTo?: string }) {
  const nav = useNavigate();
  return (
    <header className="no-print sticky top-0 z-20 -mx-4 mb-4 flex items-center gap-1 border-b border-slate-200/70 bg-white/90 px-2 py-2 backdrop-blur md:static md:mx-0 md:mb-6 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
      {back && (
        <button type="button" onClick={() => (backTo ? nav(backTo) : window.history.length > 1 ? nav(-1) : nav('/'))} className="flex size-11 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100 md:-ml-2" aria-label="Go back">
          <ArrowLeft className="size-5" />
        </button>
      )}
      <div className="min-w-0 flex-1 px-1">
        <h1 className="truncate text-lg font-bold tracking-tight text-slate-900 md:text-2xl">{title}</h1>
        {subtitle && <p className="truncate text-xs text-slate-500 md:text-sm">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
