import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Download, HelpCircle, History, LayoutDashboard, LogOut, Smartphone, Ticket } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { fmtDate, initials } from '@/lib/format';
import { passwordIssues } from '@/lib/validation';
import type { User } from '@/lib/types';
import { useAuth, ME_KEY } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { PageHeader } from '@/components/PageHeader';
import { Card, SectionTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SelectField, TextField, Toggle } from '@/components/ui/Field';
import { Alert } from '@/components/ui/feedback';
import { Badge } from '@/components/ui/Badge';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const nav = useNavigate();
  const install = useInstallPrompt();
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pw, setPw] = useState({ current: '', next: '' });
  const [pwErrors, setPwErrors] = useState<Record<string, string>>({});
  const prefs = user?.preferences ?? {};

  useEffect(() => { setName(user?.name ?? ''); setPhone(user?.phone ?? ''); }, [user]);

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => api<{ user: User }>('/me', { method: 'PATCH', body }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ME_KEY }); },
  });
  const changePw = useMutation({
    mutationFn: () => api('/me/password', { body: { currentPassword: pw.current, newPassword: pw.next } }),
    onSuccess: () => { setPw({ current: '', next: '' }); toast('Password updated · other sessions signed out'); },
    onError: (e) => e instanceof ApiError && setPwErrors(e.fieldErrors),
  });

  const submitProfile = (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (name.trim().length < 2) errs.name = 'Enter your full name';
    if (phone && !/^[6-9]\d{9}$/.test(phone)) errs.phone = 'Enter a valid 10-digit mobile number';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    save.mutate({ name: name.trim(), phone: phone || null }, { onSuccess: () => toast('Profile saved'), onError: (er) => er instanceof ApiError && setErrors(er.fieldErrors) });
  };
  const setPref = (k: string, v: unknown) => save.mutate({ preferences: { [k]: v } }, { onSuccess: () => toast('Setting updated') });

  const submitPw = (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!pw.current) errs.currentPassword = 'Enter your current password';
    const issues = passwordIssues(pw.next);
    if (issues.length) errs.newPassword = `Needs: ${issues.join(', ').toLowerCase()}`;
    setPwErrors(errs);
    if (!Object.keys(errs).length) changePw.mutate();
  };

  if (!user) return null;
  return (
    <div className="space-y-5">
      <PageHeader title="Profile & settings" back={false} />
      <Card className="flex items-center gap-4 p-4 md:p-5">
        <span className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-saffron-400 to-saffron-600 text-2xl font-extrabold text-white">{initials(user.name)}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold">{user.name}</p>
          <p className="truncate text-sm text-slate-500">{user.email}</p>
          <div className="mt-1 flex items-center gap-2"><Badge tone={user.role === 'ADMIN' ? 'saffron' : 'blue'}>{user.role === 'ADMIN' ? 'Administrator' : 'Demo traveller'}</Badge><span className="text-xs text-slate-400">since {fmtDate(user.createdAt)}</span></div>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-2">
        {[{ to: '/tickets', icon: Ticket, l: 'My tickets' }, { to: '/history', icon: History, l: 'History' }, { to: '/help', icon: HelpCircle, l: 'Help' }].map(({ to, icon: Icon, l }) => (
          <Link key={to} to={to} className="flex flex-col items-center gap-1.5 rounded-2xl bg-white py-3 text-xs font-semibold text-slate-700 shadow-card ring-1 ring-slate-200/60 hover:ring-brand-200"><Icon className="size-5 text-brand-700" />{l}</Link>
        ))}
      </div>

      {user.role === 'ADMIN' && (
        <Link to="/admin" className="flex items-center gap-3 rounded-2xl bg-brand-900 p-4 text-white shadow-raised">
          <LayoutDashboard className="size-6 text-saffron-400" />
          <span className="flex-1"><span className="block font-bold">Admin dashboard</span><span className="block text-xs text-brand-200">Users, bookings, stations, health & logs</span></span>
          <ChevronRight className="size-5" />
        </Link>
      )}

      <Card className="p-4 md:p-5">
        <SectionTitle>Personal details</SectionTitle>
        <form onSubmit={submitProfile} noValidate className="space-y-4">
          <TextField label="Full name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} autoComplete="name" />
          <TextField label="Email" value={user.email} disabled hint="Email cannot be changed in this demo" />
          <TextField label="Mobile number" optional inputMode="numeric" maxLength={10} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} error={errors.phone} />
          <Button type="submit" loading={save.isPending && !!save.variables && 'name' in (save.variables as object)}>Save changes</Button>
        </form>
      </Card>

      <Card className="p-4 md:p-5">
        <SectionTitle>App settings</SectionTitle>
        <div className="divide-y divide-slate-100">
          <Toggle label="Booking notifications" description="Confirmation & cancellation alerts" checked={prefs.notifyBookings ?? true} onChange={(v) => setPref('notifyBookings', v)} />
          <Toggle label="Offers & tips" description="Occasional demo feature tips" checked={prefs.notifyOffers ?? false} onChange={(v) => setPref('notifyOffers', v)} />
          <Toggle label="Paperless ticket" description="Show tickets in-app (demo)" checked={prefs.paperlessTicket ?? true} onChange={(v) => setPref('paperlessTicket', v)} />
          <div className="grid gap-4 py-3 sm:grid-cols-2">
            <SelectField label="Language" value={prefs.language ?? 'en'} onChange={(e) => setPref('language', e.target.value)} hint="Interface translation is a placeholder in this demo">
              <option value="en">English</option>
              <option value="hi">हिन्दी (Hindi)</option>
            </SelectField>
            <SelectField label="Default train type" value={prefs.defaultTrainType ?? 'EXPRESS'} onChange={(e) => setPref('defaultTrainType', e.target.value)}>
              <option value="ORDINARY">Ordinary</option>
              <option value="EXPRESS">Mail/Express</option>
              <option value="SUPERFAST">Superfast</option>
            </SelectField>
          </div>
        </div>
      </Card>

      <Card className="p-4 md:p-5">
        <SectionTitle>Change password</SectionTitle>
        <form onSubmit={submitPw} noValidate className="space-y-4">
          <TextField label="Current password" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} error={pwErrors.currentPassword} />
          <TextField label="New password" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} error={pwErrors.newPassword} hint="8+ characters with a letter and a number" />
          {changePw.isError && !Object.keys(pwErrors).length && <Alert tone="error">{(changePw.error as Error).message}</Alert>}
          <Button type="submit" variant="secondary" loading={changePw.isPending}>Update password</Button>
        </form>
      </Card>

      <Card id="install" className="p-4 md:p-5">
        <SectionTitle>Install app</SectionTitle>
        <div className="flex items-start gap-3">
          <Smartphone className="mt-0.5 size-6 shrink-0 text-brand-700" />
          <div className="flex-1 text-sm text-slate-600">
            {install.installed ? 'RailwayOne Pro is installed on this device.' : install.canInstall ? 'Install RailwayOne Pro on your home screen for a full-screen, app-like experience.' : 'On Android Chrome, open the browser menu and choose “Install app” or “Add to Home screen”.'}
          </div>
        </div>
        {install.canInstall && <Button className="mt-3" icon={<Download className="size-4" />} onClick={() => void install.install()}>Install app</Button>}
      </Card>

      <Card className="p-4 text-xs leading-relaxed text-slate-500 md:p-5">
        <p className="font-semibold text-slate-700">About RailwayOne Pro</p>
        <p className="mt-1">Version 1.0.0 · An original railway booking prototype built for demonstration. It is not affiliated with, endorsed by, or connected to Indian Railways, CRIS, IRCTC or RailOne. All stations, trains, fares and tickets are sample or simulated data. Tickets are <strong className="text-red-600">DEMO ONLY — NOT VALID FOR TRAVEL</strong>.</p>
      </Card>

      <Button variant="outline" block size="lg" icon={<LogOut className="size-5" />} className="!text-red-700" onClick={async () => { await logout(); nav('/login'); }}>Sign out</Button>
    </div>
  );
}
