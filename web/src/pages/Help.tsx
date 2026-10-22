import { useEffect, useState, type FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, CreditCard, LifeBuoy, MessageSquare, Search, ShieldAlert, Ticket, Undo2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';
import { useToast } from '@/hooks/useToast';
import { PageHeader } from '@/components/PageHeader';
import { Card, SectionTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SelectField, TextAreaField, TextField } from '@/components/ui/Field';
import { Alert } from '@/components/ui/feedback';
import { Badge } from '@/components/ui/Badge';

type Faq = { q: string; a: string; topic: 'general' | 'tickets' | 'payments' | 'refunds' };
const FAQS: Faq[] = [
  { topic: 'general', q: 'Is RailwayOne Pro an official railway app?', a: 'No. RailwayOne Pro is an original demonstration prototype. It is not affiliated with Indian Railways, CRIS, IRCTC or RailOne and is not connected to any railway system. Every ticket is labelled “DEMO ONLY — NOT VALID FOR TRAVEL”.' },
  { topic: 'general', q: 'Where does train, PNR and running-status data come from?', a: 'From mock generators inside this app. Train names, timings, availability, PNR results and live positions are simulated and deterministic for demo purposes. Nothing reflects real operations.' },
  { topic: 'tickets', q: 'Can I travel with a demo ticket?', a: 'No. Demo tickets, their QR codes and PDF receipts are simulated artefacts and must never be shown as a travel credential. For real travel use official Indian Railways channels.' },
  { topic: 'tickets', q: 'Which unreserved journeys can I book?', a: 'Between any two different stations in the sample dataset, for today or tomorrow (IST), with 1–4 passengers including at least one adult.' },
  { topic: 'tickets', q: 'How long is a demo platform ticket valid?', a: 'Two hours from simulated payment. Platform tickets cannot be cancelled.' },
  { topic: 'payments', q: 'How do I pay in the sandbox?', a: 'Use the demo wallet, the demo UPI ID success@demoupi, or the test card 4111 1111 1111 1111 with any future expiry and any 3-digit CVV. No real money moves and no real payment gateway is contacted.' },
  { topic: 'payments', q: 'How do I test a failed payment?', a: 'Use a UPI ID starting with “fail” (e.g. fail@demoupi) or the card 4000 0000 0000 0002. The booking stays on hold for 15 minutes so you can retry.' },
  { topic: 'payments', q: 'How do I add demo money?', a: 'Open Wallet → Add demo money. You can add ₹100–₹10,000 at a time up to a ₹20,000 balance. Credits have no monetary value.' },
  { topic: 'refunds', q: 'How are cancellation refunds calculated?', a: 'Confirmed unreserved demo tickets can be cancelled before their validity ends. The refund is the ticket total minus a demo clerkage of ₹15 per passenger and is credited to the demo wallet.' },
];
const TOPICS = [
  { id: 'tickets', icon: Ticket, label: 'Tickets' },
  { id: 'payments', icon: CreditCard, label: 'Payments' },
  { id: 'refunds', icon: Undo2, label: 'Refunds' },
  { id: 'contact', icon: MessageSquare, label: 'Contact' },
] as const;
type SupportReq = { id: string; category: string; subject: string; status: string; createdAt: string };

function FaqItem({ f }: { f: Faq }) {
  return (
    <details className="group border-b border-slate-100 last:border-0">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 py-3 font-semibold text-slate-800 [&::-webkit-details-marker]:hidden">
        <span className="flex-1">{f.q}</span>
        <ChevronDown className="size-5 shrink-0 text-slate-400 transition group-open:rotate-180" />
      </summary>
      <p className="pb-4 text-sm leading-relaxed text-slate-600">{f.a}</p>
    </details>
  );
}

export default function HelpPage() {
  const { hash } = useLocation();
  const qc = useQueryClient();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ category: 'BOOKING', subject: '', message: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!hash) return;
    const t = setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    return () => clearTimeout(t);
  }, [hash]);

  const reqs = useQuery({ queryKey: ['support'], queryFn: () => api<{ requests: SupportReq[] }>('/support/requests') });
  const send = useMutation({
    mutationFn: () => api('/support/requests', { body: form }),
    onSuccess: () => { setForm({ category: 'BOOKING', subject: '', message: '' }); qc.invalidateQueries({ queryKey: ['support'] }); toast('Demo support request submitted'); },
    onError: (e) => e instanceof ApiError && setErrors(e.fieldErrors),
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (form.subject.trim().length < 4) errs.subject = 'Subject is too short';
    if (form.message.trim().length < 10) errs.message = 'Please describe the issue in at least 10 characters';
    setErrors(errs);
    if (!Object.keys(errs).length) send.mutate();
  };

  const s = search.trim().toLowerCase();
  const filtered = s ? FAQS.filter((f) => (f.q + f.a).toLowerCase().includes(s)) : FAQS;
  const section = (topic: Faq['topic'] | 'general', title: string, id?: string) => {
    const list = filtered.filter((f) => f.topic === topic);
    if (!list.length) return null;
    return (
      <Card id={id} className="scroll-mt-20 px-4 pt-2 md:px-5">
        <h2 className="pt-2 text-sm font-bold uppercase tracking-wide text-brand-700">{title}</h2>
        {list.map((f) => <FaqItem key={f.q} f={f} />)}
      </Card>
    );
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Help & support" subtitle="FAQs for this demo prototype" />
      <Alert tone="warning" title="This is a demo — not official railway support">
        For real tickets, refunds, complaints or emergencies, use official Indian Railways channels (the official website/app or the published railway helpline). This app cannot help with real bookings.
      </Alert>

      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search help articles" aria-label="Search help articles" className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 shadow-card focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100" />
      </div>

      <nav aria-label="Help topics" className="grid grid-cols-4 gap-2">
        {TOPICS.map(({ id, icon: Icon, label }) => (
          <a key={id} href={`#${id}`} onClick={(e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); }} className="flex flex-col items-center gap-1.5 rounded-2xl bg-white py-3 text-xs font-semibold text-slate-700 shadow-card ring-1 ring-slate-200/60 hover:ring-brand-200">
            <Icon className="size-5 text-brand-700" />{label}
          </a>
        ))}
      </nav>

      {section('general', 'About this demo')}
      {section('tickets', 'Tickets', 'tickets')}
      {section('payments', 'Sandbox payments', 'payments')}
      {section('refunds', 'Cancellations & refunds', 'refunds')}
      {filtered.length === 0 && <p className="py-6 text-center text-sm text-slate-500">No articles match “{search}”. Try “refund”, “UPI” or “platform”.</p>}

      <Card className="flex gap-3 p-4 md:p-5">
        <ShieldAlert className="size-6 shrink-0 text-red-600" />
        <div className="text-sm text-slate-600">
          <p className="font-semibold text-slate-800">Safety & security emergencies</p>
          <p className="mt-0.5">During real travel, contact railway staff, the Railway Protection Force or the official railway helpline published by Indian Railways. Do not rely on this demo app.</p>
        </div>
      </Card>

      <Card id="contact" className="scroll-mt-20 p-4 md:p-5">
        <SectionTitle>Contact demo support</SectionTitle>
        <p className="-mt-1 mb-4 text-sm text-slate-500">Requests are stored in the demo database and visible only to you and demo administrators. No real agent will respond.</p>
        <form onSubmit={submit} noValidate className="space-y-4">
          <SelectField label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {['BOOKING', 'PAYMENT', 'REFUND', 'ACCOUNT', 'FEEDBACK', 'OTHER'].map((c) => <option key={c} value={c}>{c[0] + c.slice(1).toLowerCase()}</option>)}
          </SelectField>
          <TextField label="Subject" value={form.subject} maxLength={120} onChange={(e) => setForm({ ...form, subject: e.target.value })} error={errors.subject} />
          <TextAreaField label="Message" rows={4} value={form.message} maxLength={2000} onChange={(e) => setForm({ ...form, message: e.target.value })} error={errors.message} hint={`${form.message.length}/2000`} />
          {send.isError && !Object.keys(errors).length && <Alert tone="error">{(send.error as Error).message}</Alert>}
          <Button type="submit" icon={<LifeBuoy className="size-4" />} loading={send.isPending}>Submit request</Button>
        </form>
        {!!reqs.data?.requests.length && (
          <div className="mt-6">
            <h3 className="mb-2 text-sm font-semibold text-slate-700">Your requests</h3>
            <ul className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
              {reqs.data.requests.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                  <span className="min-w-0 flex-1"><span className="block truncate font-medium text-slate-800">{r.subject}</span><span className="text-xs text-slate-500">{r.category} · {fmtDateTime(r.createdAt)}</span></span>
                  <Badge tone={r.status === 'OPEN' ? 'amber' : 'green'}>{r.status}</Badge>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    </div>
  );
}
