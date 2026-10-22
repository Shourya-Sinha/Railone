import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Bell, BellOff, CheckCheck, Gift, Ticket, Wallet, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { relativeTime } from '@/lib/format';
import type { Notification, PageMeta } from '@/lib/types';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/feedback';

const ICON: Record<string, typeof Bell> = { BOOKING_CONFIRMED: Ticket, BOOKING_CANCELLED: XCircle, WALLET: Wallet, WELCOME: Gift };

export default function NotificationsPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { refresh } = useAuth();
  const q = useQuery({ queryKey: ['notifications'], queryFn: () => api<{ notifications: Notification[]; unread: number; meta: PageMeta }>('/notifications?pageSize=50') });
  const readAll = useMutation({ mutationFn: () => api('/notifications/read-all', { method: 'POST' }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['notifications'] }); refresh(); } });
  const open = async (n: Notification) => {
    if (!n.read) { await api(`/notifications/${n.id}/read`, { method: 'POST' }).catch(() => undefined); qc.invalidateQueries({ queryKey: ['notifications'] }); refresh(); }
    if (n.link) nav(n.link);
  };

  return (
    <div>
      <PageHeader title="Notifications" back={false} action={q.data?.unread ? <Button size="sm" variant="ghost" icon={<CheckCheck className="size-4" />} loading={readAll.isPending} onClick={() => readAll.mutate()}>Mark all read</Button> : undefined} />
      {q.isPending ? (
        <ListSkeleton rows={4} />
      ) : q.isError ? (
        <ErrorState message={(q.error as Error).message} onRetry={() => void q.refetch()} />
      ) : q.data.notifications.length === 0 ? (
        <Card><EmptyState icon={<BellOff className="size-7" />} title="You're all caught up" body="Booking, refund and wallet alerts will show up here." /></Card>
      ) : (
        <Card className="divide-y divide-slate-100 overflow-hidden">
          {q.data.notifications.map((n) => {
            const Icon = ICON[n.kind] ?? Bell;
            return (
              <button key={n.id} type="button" onClick={() => void open(n)} className={clsx('flex w-full items-start gap-3 p-4 text-left transition hover:bg-slate-50', !n.read && 'bg-brand-50/40')}>
                <span className={clsx('flex size-10 shrink-0 items-center justify-center rounded-xl', n.kind === 'BOOKING_CANCELLED' ? 'bg-red-50 text-red-600' : n.kind === 'WALLET' ? 'bg-emerald-50 text-emerald-700' : 'bg-brand-50 text-brand-700')}><Icon className="size-5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2"><span className={clsx('flex-1 truncate', n.read ? 'font-medium text-slate-700' : 'font-bold text-slate-900')}>{n.title}</span><span className="shrink-0 text-[11px] text-slate-400">{relativeTime(n.createdAt)}</span></span>
                  <span className="mt-0.5 line-clamp-2 block text-sm text-slate-500">{n.body}</span>
                </span>
                {!n.read && <span className="mt-2 size-2.5 shrink-0 rounded-full bg-saffron-500" aria-label="Unread" />}
              </button>
            );
          })}
        </Card>
      )}
    </div>
  );
}
