import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Circle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { ApiError } from '@/lib/api';
import { isValidEmail, passwordIssues } from '@/lib/validation';
import { Button } from '@/components/ui/Button';
import { Checkbox, TextField } from '@/components/ui/Field';
import { Alert } from '@/components/ui/feedback';
import { AuthLayout } from './AuthLayout';

export function RegisterPage() {
  const { register } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '', confirm: '' });
  const [agree, setAgree] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  const pwIssues = passwordIssues(f.password);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (f.name.trim().length < 2) errs.name = 'Enter your full name';
    if (!isValidEmail(f.email)) errs.email = 'Enter a valid email address';
    if (f.phone && !/^[6-9]\d{9}$/.test(f.phone)) errs.phone = 'Enter a valid 10-digit mobile number';
    if (pwIssues.length) errs.password = `Password needs: ${pwIssues.join(', ').toLowerCase()}`;
    if (f.confirm !== f.password) errs.confirm = 'Passwords do not match';
    if (!agree) errs.agree = 'Please confirm you understand this is a demo';
    setErrors(errs);
    setFormError('');
    if (Object.keys(errs).length) return;
    setLoading(true);
    try {
      await register({ name: f.name.trim(), email: f.email.trim(), phone: f.phone || undefined, password: f.password });
      toast('Account created — ₹500 demo credits added');
      nav('/', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) { setErrors(err.fieldErrors); setFormError(err.message); }
      else setFormError('Unable to register right now');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Create your demo account" subtitle="Takes 30 seconds. You'll get ₹500 of demo wallet credits.">
      <form onSubmit={submit} noValidate className="space-y-4">
        {formError && <Alert tone="error">{formError}</Alert>}
        <TextField label="Full name" autoComplete="name" value={f.name} onChange={set('name')} error={errors.name} placeholder="e.g. Priya Verma" />
        <TextField label="Email" type="email" autoComplete="email" value={f.email} onChange={set('email')} error={errors.email} placeholder="you@example.com" />
        <TextField label="Mobile number" optional type="tel" inputMode="numeric" maxLength={10} autoComplete="tel-national" value={f.phone} onChange={(e) => setF((s) => ({ ...s, phone: e.target.value.replace(/\D/g, '') }))} error={errors.phone} placeholder="10-digit mobile" />
        <div>
          <TextField label="Password" type="password" autoComplete="new-password" value={f.password} onChange={set('password')} error={errors.password} />
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="Password requirements">
            {['At least 8 characters', 'A letter', 'A number'].map((r) => {
              const ok = f.password.length > 0 && !pwIssues.includes(r);
              return <li key={r} className={`flex items-center gap-1 ${ok ? 'text-emerald-700' : 'text-slate-500'}`}>{ok ? <Check className="size-3.5" /> : <Circle className="size-3" />} {r}</li>;
            })}
          </ul>
        </div>
        <TextField label="Confirm password" type="password" autoComplete="new-password" value={f.confirm} onChange={set('confirm')} error={errors.confirm} />
        <Checkbox checked={agree} onChange={setAgree} error={errors.agree}>
          I understand RailwayOne Pro is a <strong>demo prototype</strong>: tickets are simulated and <strong>not valid for travel</strong>, and no real payments are made.
        </Checkbox>
        <Button type="submit" block size="lg" loading={loading}>Create account</Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">
        Already have an account? <Link to="/login" className="font-semibold text-brand-700 hover:underline">Sign in</Link>
      </p>
    </AuthLayout>
  );
}
