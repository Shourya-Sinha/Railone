import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import clsx from 'clsx';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';

interface FieldWrapProps {
  label: string;
  error?: string;
  hint?: ReactNode;
  id: string;
  children: ReactNode;
  optional?: boolean;
}

export function FieldWrap({ label, error, hint, id, children, optional }: FieldWrapProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label} {optional && <span className="font-normal text-slate-400">(optional)</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 flex items-start gap-1 text-sm text-red-600">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

export const inputClass = (error?: string) =>
  clsx(
    'block w-full rounded-xl border bg-white px-3.5 h-12 text-[15px] text-slate-900 placeholder:text-slate-400 transition',
    'focus:outline-none focus:ring-4',
    error ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : 'border-slate-300 focus:border-brand-500 focus:ring-brand-100',
  );

type InputProps = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: ReactNode; optional?: boolean; leading?: ReactNode };

export const TextField = forwardRef<HTMLInputElement, InputProps>(function TextField({ label, error, hint, optional, id, className, leading, type, ...rest }, ref) {
  const autoId = useId();
  const fid = id ?? autoId;
  const [show, setShow] = useState(false);
  const isPw = type === 'password';
  return (
    <FieldWrap label={label} error={error} hint={hint} id={fid} optional={optional}>
      <div className="relative">
        {leading && <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-slate-400">{leading}</span>}
        <input
          ref={ref}
          id={fid}
          type={isPw && show ? 'text' : type}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? `${fid}-error` : hint ? `${fid}-hint` : undefined}
          className={clsx(inputClass(error), leading && 'pl-10', isPw && 'pr-12', className)}
          {...rest}
        />
        {isPw && (
          <button type="button" onClick={() => setShow((s) => !s)} className="absolute inset-y-0 right-1 flex w-11 items-center justify-center text-slate-500 hover:text-slate-700" aria-label={show ? 'Hide password' : 'Show password'}>
            {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          </button>
        )}
      </div>
    </FieldWrap>
  );
});

export function SelectField({ label, error, hint, id, children, className, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { label: string; error?: string; hint?: ReactNode }) {
  const autoId = useId();
  const fid = id ?? autoId;
  return (
    <FieldWrap label={label} error={error} hint={hint} id={fid}>
      <select id={fid} aria-invalid={!!error || undefined} className={clsx(inputClass(error), 'appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-10', className)} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }} {...rest}>
        {children}
      </select>
    </FieldWrap>
  );
}

export function TextAreaField({ label, error, hint, id, className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string; hint?: ReactNode }) {
  const autoId = useId();
  const fid = id ?? autoId;
  return (
    <FieldWrap label={label} error={error} hint={hint} id={fid}>
      <textarea id={fid} aria-invalid={!!error || undefined} aria-describedby={error ? `${fid}-error` : undefined} className={clsx(inputClass(error), 'h-auto min-h-28 py-3', className)} {...rest} />
    </FieldWrap>
  );
}

export function Checkbox({ checked, onChange, children, id, error }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; id?: string; error?: string }) {
  const autoId = useId();
  const fid = id ?? autoId;
  return (
    <div>
      <label htmlFor={fid} className="flex cursor-pointer items-start gap-3 rounded-xl py-1 text-sm text-slate-700">
        <input id={fid} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-5 shrink-0 rounded border-slate-300 accent-brand-800" aria-invalid={!!error || undefined} />
        <span>{children}</span>
      </label>
      {error && <p role="alert" className="ml-8 mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <p id={id} className="text-[15px] font-medium text-slate-800">{label}</p>
        {description && <p className="text-xs text-slate-500">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={id}
        onClick={() => onChange(!checked)}
        className={clsx('relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors', checked ? 'bg-brand-800' : 'bg-slate-300')}
      >
        <span className={clsx('inline-block size-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-6' : 'translate-x-1')} />
      </button>
    </div>
  );
}
