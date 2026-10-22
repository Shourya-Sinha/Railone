import type { ReactNode } from 'react';
import { QrCode, TrainFront, Wallet } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { DemoStrip } from '@/components/DemoBanner';

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <DemoStrip />
      <div className="flex flex-1 flex-col lg:flex-row">
        <section className="relative overflow-hidden bg-gradient-to-br from-brand-950 via-brand-900 to-brand-700 px-6 pb-10 pt-8 text-white lg:flex lg:w-[46%] lg:flex-col lg:justify-between lg:p-12">
          <svg aria-hidden className="absolute -right-24 -top-24 size-96 text-white/[0.04]" viewBox="0 0 200 200"><circle cx="100" cy="100" r="98" fill="none" stroke="currentColor" strokeWidth="26" /></svg>
          <svg aria-hidden className="absolute bottom-0 left-0 h-24 w-full text-white/[0.06] lg:h-40" viewBox="0 0 400 100" preserveAspectRatio="none">
            <path d="M0 80 L400 60" stroke="currentColor" strokeWidth="3" />
            <path d="M0 95 L400 72" stroke="currentColor" strokeWidth="3" />
            {Array.from({ length: 20 }).map((_, i) => <path key={i} d={`M${i * 20 + 5} ${82 - i} l3 14`} stroke="currentColor" strokeWidth="4" />)}
          </svg>
          <div className="relative"><Logo light /></div>
          <div className="relative mt-8 lg:mt-0">
            <h1 className="text-3xl font-extrabold leading-tight tracking-tight lg:text-5xl">
              Every journey,<br /><span className="text-saffron-400">one app.</span>
            </h1>
            <p className="mt-3 max-w-md text-sm text-brand-100 lg:text-base">A high-fidelity railway booking prototype — unreserved & platform tickets, PNR, running status and a demo wallet, all powered by mock data.</p>
            <ul className="mt-6 hidden space-y-3 text-sm text-brand-100 lg:block">
              <li className="flex items-center gap-3"><TrainFront className="size-5 text-saffron-400" /> End-to-end demo booking flow</li>
              <li className="flex items-center gap-3"><Wallet className="size-5 text-saffron-400" /> Sandbox payments — no real money</li>
              <li className="flex items-center gap-3"><QrCode className="size-5 text-saffron-400" /> Simulated QR tickets marked DEMO ONLY</li>
            </ul>
          </div>
          <p className="relative mt-6 hidden text-xs text-brand-300 lg:block">Not an official Indian Railways, CRIS, IRCTC or RailOne product.</p>
        </section>
        <section className="-mt-5 flex flex-1 items-start justify-center rounded-t-3xl bg-white px-5 pb-10 pt-8 lg:mt-0 lg:items-center lg:rounded-none">
          <div className="w-full max-w-md animate-fade-up">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h2>
            <p className="mb-6 mt-1 text-sm text-slate-500">{subtitle}</p>
            {children}
          </div>
        </section>
      </div>
    </div>
  );
}
