import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { fmtDateTime, inr } from '@/lib/format';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { Badge } from '@/components/ui/Badge';
import { AdminPageTitle, DataTable, FilterSelect, Toolbar, useAdminList, type Column } from './shared';

type AdminUser = { id: string; name: string; email: string; phone: string | null; role: 'USER' | 'ADMIN'; disabled: boolean; walletBalancePaise: number; bookings: number; lastLoginAt: string | null; createdAt: string };

export default function UsersPage() {
  const { user: me } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const { query, q, setQ, filters, setFilter, setPage } = useAdminList<{ users: AdminUser[] }>('users', ['role', 'disabled']);
  const toggle = useMutation({
    mutationFn: (u: AdminUser) => api(`/admin/users/${u.id}`, { method: 'PATCH', body: { disabled: !u.disabled } }),
    onSuccess: (_d, u) => { toast(`${u.email} ${u.disabled ? 'enabled' : 'disabled'}`); qc.invalidateQueries({ queryKey: ['admin', 'users'] }); },
    onError: (e) => toast((e as Error).message, 'error'),
  });
  const cols: Column<AdminUser>[] = [
    { key: 'name', header: 'User', cell: (u) => <div><p className="font-semibold text-slate-900">{u.name}</p><p className="text-xs text-slate-500">{u.email}{u.phone && ` · ${u.phone}`}</p></div> },
    { key: 'role', header: 'Role', cell: (u) => <Badge tone={u.role === 'ADMIN' ? 'saffron' : 'blue'}>{u.role}</Badge> },
    { key: 'status', header: 'Status', cell: (u) => <Badge tone={u.disabled ? 'red' : 'green'}>{u.disabled ? 'Disabled' : 'Active'}</Badge> },
    { key: 'bookings', header: 'Bookings', className: 'text-right tabular-nums', cell: (u) => u.bookings },
    { key: 'wallet', header: 'Wallet', className: 'text-right tabular-nums', cell: (u) => inr(u.walletBalancePaise) },
    { key: 'login', header: 'Last login', cell: (u) => <span className="text-xs text-slate-600">{u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : 'Never'}</span> },
    { key: 'act', header: '', className: 'text-right', cell: (u) => u.id === me?.id ? <span className="text-xs text-slate-400">You</span> : (
      <button type="button" disabled={toggle.isPending} onClick={() => { if (u.disabled || confirm(`Disable ${u.email}? Their sessions will be revoked.`)) toggle.mutate(u); }} className={u.disabled ? 'h-9 rounded-lg px-3 text-xs font-semibold text-brand-700 hover:bg-brand-50' : 'h-9 rounded-lg px-3 text-xs font-semibold text-red-700 hover:bg-red-50'}>{u.disabled ? 'Enable' : 'Disable'}</button>
    ) },
  ];
  return (
    <div>
      <AdminPageTitle title="Users" subtitle="Registered demo accounts" />
      <Toolbar q={q} setQ={setQ} placeholder="Search name, email or phone">
        <FilterSelect label="Role" value={filters.role!} onChange={(v) => setFilter('role', v)} options={[['USER', 'User'], ['ADMIN', 'Admin']]} />
        <FilterSelect label="Status" value={filters.disabled!} onChange={(v) => setFilter('disabled', v)} options={[['false', 'Active'], ['true', 'Disabled']]} />
      </Toolbar>
      <DataTable columns={cols} rows={query.data?.users} loading={query.isPending} error={query.error} onRetry={() => void query.refetch()} meta={query.data?.meta} onPage={setPage} />
    </div>
  );
}
