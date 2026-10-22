import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { safeNext } from '@/lib/safeNext';
import { Lock, Mail, ShieldCheck, Sparkles, UserCog } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/api';
import { isValidEmail } from '@/lib/validation';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Field';
import { Alert } from '@/components/ui/feedback';
import { AuthLayout } from './AuthLayout';

const DEMO = { email: 'demo@railwayone.dev', password: 'Demo@12345' };
const ADMIN = { email: 'admin@railwayone.dev', password: 'Admin@12345' };

export function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e?: FormEvent, creds?: { email: string; password: string }) => {
    e?.preventDefault();
    const em = creds?.email ?? email;
    const pw = creds?.password ?? password;
    const errs: Record<string, string> = {};
    if (!isValidEmail(em)) errs.email = 'Enter a valid email address';
    if (!pw) errs.password = 'Enter your password';
    setErrors(errs);
    setFormError('');
    if (Object.keys(errs).length) return;
    setLoading(true);
    try {
      // GuestOnly performs the redirect as soon as the session exists; tell it where to go.
      const next = safeNext(params.get('next')) ?? (creds === ADMIN ? '/admin' : null);
      if (next) setParams({ next }, { replace: true });
      await login(em, pw);
      nav(next ?? '/', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fieldErrors);
        setFormError(err.message);
      } else setFormError('Unable to sign in right now');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your RailwayOne Pro demo account">
      <form onSubmit={submit} noValidate className="space-y-4">
        {formError && <Alert tone="error">{formError}</Alert>}
        <TextField label="Email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} leading={<Mail className="size-5" />} placeholder="you@example.com" />
        <TextField label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} leading={<Lock className="size-5" />} placeholder="Your password" />
        <Button type="submit" block size="lg" loading={loading}>Sign in</Button>
      </form>

      <div className="my-6 flex items-center gap-3 text-xs font-medium uppercase tracking-wider text-slate-400">
        <span className="h-px flex-1 bg-slate-200" /> or try instantly <span className="h-px flex-1 bg-slate-200" />
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <Button variant="secondary" icon={<Sparkles className="size-4" />} onClick={() => { setEmail(DEMO.email); setPassword(DEMO.password); void submit(undefined, DEMO); }} disabled={loading}>
          Demo traveller
        </Button>
        <Button variant="outline" icon={<UserCog className="size-4" />} onClick={() => { setEmail(ADMIN.email); setPassword(ADMIN.password); void submit(undefined, ADMIN); }} disabled={loading}>
          Demo admin
        </Button>
      </div>
      <p className="mt-6 text-center text-sm text-slate-600">
        New here? <Link to="/register" className="font-semibold text-brand-700 hover:underline">Create a demo account</Link>
      </p>
      <p className="mt-6 flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
        <ShieldCheck className="size-4 shrink-0 text-slate-400" />
        Passwords are hashed with scrypt; sessions use httpOnly cookies. Demo credentials are seeded from the example environment file.
      </p>
    </AuthLayout>
  );
}
