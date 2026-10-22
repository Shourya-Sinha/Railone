import clsx from 'clsx';
import { DoorOpen, TrainFront } from 'lucide-react';
import { fmtDateTime, fmtDay, inr, METHOD_LABEL, TRAIN_TYPE_LABEL } from '@/lib/format';
import type { Booking } from '@/lib/types';
import { LogoMark } from './Logo';
import { DemoOnlyBanner } from './DemoBanner';
import { QRCode } from './QRCode';

function Detail({ label, value, mono, wide }: { label: string; value: React.ReactNode; mono?: boolean; wide?: boolean }) {
  return (
    <div className={wide ? 'col-span-2' : undefined}>
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className={clsx('mt-0.5 text-[15px] font-semibold text-slate-900', mono && 'font-mono tracking-wide')}>{value}</dd>
    </div>
  );
}

/**
 * Professional ticket layout for a DEMO booking. The red DEMO ONLY banner and the
 * watermark are always present and cannot be hidden by the user.
 */
export function TicketCard({ b }: { b: Booking }) {
  const isPf = b.type === 'PLATFORM';
  const voided = b.status !== 'CONFIRMED';
  const pax = isPf
    ? `${b.adults} person${b.adults > 1 ? 's' : ''}`
    : [b.adults && `${b.adults} Adult${b.adults > 1 ? 's' : ''}`, b.children && `${b.children} Child${b.children > 1 ? 'ren' : ''}`].filter(Boolean).join(', ');

  return (
    <article aria-label={`Demo ticket ${b.bookingRef}`} className="print-area relative mx-auto max-w-md overflow-hidden rounded-3xl bg-white shadow-raised ring-1 ring-slate-200">
      {/* Watermark */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0 flex flex-col items-center justify-center gap-16 overflow-hidden">
        {[0, 1, 2].map((i) => (
          <span key={i} className="-rotate-[24deg] whitespace-nowrap text-6xl font-black tracking-widest text-red-600/[0.05]">DEMO · DEMO · DEMO</span>
        ))}
      </div>

      <header className="relative z-10 bg-gradient-to-br from-brand-900 via-brand-800 to-brand-700 px-5 pb-4 pt-5 text-white">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <LogoMark className="size-9 ring-1 ring-white/20 rounded-xl" />
            <div className="leading-tight">
              <p className="font-extrabold tracking-tight">RailwayOne <span className="text-saffron-400">Pro</span></p>
              <p className="text-[11px] text-brand-200">Demo prototype ticket</p>
            </div>
          </div>
          <div className="text-right">
            <p className="rounded-md bg-white/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider">{isPf ? 'Platform' : 'Unreserved'}</p>
            <p className="mt-1 text-[11px] text-brand-200">{isPf ? 'Visitor pass' : 'Second class (II)'}</p>
          </div>
        </div>
      </header>
      <div className="relative z-10 h-1 bg-saffron-500" />
      <DemoOnlyBanner className="relative z-10" />

      <div className="relative z-10 px-5 pb-2 pt-5">
        {isPf ? (
          <div className="flex items-center gap-3">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-saffron-50 text-saffron-600"><DoorOpen className="size-6" /></span>
            <div>
              <p className="text-3xl font-black tracking-tight text-slate-900">{b.source.code}</p>
              <p className="text-sm text-slate-600">{b.source.name}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-3xl font-black tracking-tight text-slate-900">{b.source.code}</p>
              <p className="truncate text-xs text-slate-600">{b.source.name}</p>
            </div>
            <div className="flex flex-col items-center px-1 text-brand-700">
              <TrainFront className="size-5" aria-hidden />
              <span className="mt-1 h-px w-16 border-t-2 border-dashed border-brand-200" />
              {b.distanceKm && <span className="mt-1 text-[11px] font-medium text-slate-500">~{b.distanceKm} km</span>}
            </div>
            <div className="min-w-0 flex-1 text-right">
              <p className="text-3xl font-black tracking-tight text-slate-900">{b.destination?.code}</p>
              <p className="truncate text-xs text-slate-600">{b.destination?.name}</p>
            </div>
          </div>
        )}

        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3.5">
          <Detail label="Demo booking ID" value={b.bookingRef} mono wide />
          <Detail label={isPf ? 'Date' : 'Journey date'} value={fmtDay(b.journeyDate)} />
          <Detail label="Passengers" value={pax} />
          {!isPf && <Detail label="Train type" value={TRAIN_TYPE_LABEL[b.trainType ?? ''] ?? '—'} />}
          {!isPf && <Detail label="Train (mock)" value={b.trainNumber ? `${b.trainNumber}` : 'Any of type'} />}
          <Detail label="Demo fare" value={inr(b.totalPaise)} />
          <Detail label="Payment" value={b.paymentMethod ? METHOD_LABEL[b.paymentMethod] : 'Unpaid'} />
          <Detail label="Booked at" value={fmtDateTime(b.createdAt)} wide />
          {b.validUntil && b.status === 'CONFIRMED' && <Detail label="Demo validity until" value={fmtDateTime(b.validUntil)} wide />}
          {b.status === 'CANCELLED' && b.refundPaise != null && <Detail label="Demo refund to wallet" value={inr(b.refundPaise)} wide />}
        </dl>
      </div>

      {/* Perforation */}
      <div className="relative z-10 my-3 flex items-center" aria-hidden>
        <span className="-ml-3 size-6 rounded-full bg-slate-50 ring-1 ring-inset ring-slate-200" />
        <span className="mx-2 flex-1 border-t-2 border-dashed border-slate-200" />
        <span className="-mr-3 size-6 rounded-full bg-slate-50 ring-1 ring-inset ring-slate-200" />
      </div>

      <div className="relative z-10 flex flex-col items-center px-5 pb-5">
        <div className="relative">
          <div className="rounded-2xl bg-white p-2 ring-1 ring-slate-200">
            <QRCode value={b.qrPayload ?? `RAILWAYONE-PRO-DEMO|DEMO ONLY — NOT VALID FOR TRAVEL|REF:${b.bookingRef}|VOID`} void={voided} />
          </div>
          {voided && (
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="-rotate-12 rounded-lg border-4 border-red-600 bg-white/90 px-3 py-1 text-xl font-black uppercase tracking-widest text-red-600">
                {b.status === 'CANCELLED' ? 'Cancelled' : b.status === 'EXPIRED' ? 'Expired' : 'Unpaid'}
              </span>
            </span>
          )}
        </div>
        <p className="mt-3 text-center text-xs font-bold uppercase tracking-wider text-red-600">Simulated QR · not a travel credential</p>
        <p className="mt-2 text-center text-[11px] leading-snug text-slate-500">
          Generated by an independent software prototype using mock data and a sandbox payment. Not issued by or affiliated with Indian Railways. Do not present for travel.
        </p>
      </div>
      <DemoOnlyBanner compact className="relative z-10" />
    </article>
  );
}
