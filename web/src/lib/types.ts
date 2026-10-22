export type Role = 'USER' | 'ADMIN';
export type TrainType = 'ORDINARY' | 'EXPRESS' | 'SUPERFAST';
export type BookingStatus = 'PENDING_PAYMENT' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED';
export type PaymentMethod = 'WALLET' | 'DEMO_UPI' | 'DEMO_CARD';

export interface User {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: Role;
  walletBalancePaise: number;
  preferences: { language?: 'en' | 'hi'; notifyBookings?: boolean; notifyOffers?: boolean; defaultTrainType?: TrainType; paperlessTicket?: boolean };
  createdAt: string;
}

export interface Station {
  code: string;
  name: string;
  city: string;
  state?: string;
  zone?: string;
  isPopular?: boolean;
}

export interface FareLine { label: string; quantity: number; unitPaise: number; amountPaise: number }
export interface FareQuote {
  fareTableVersion: string;
  disclaimer: string;
  distanceKm?: number;
  trainType?: TrainType;
  classCode: string;
  baseAdultRupees?: number;
  surchargeRupees?: number;
  perAdultPaise: number;
  perChildPaise: number;
  adults: number;
  children: number;
  lines: FareLine[];
  totalPaise: number;
}

export interface Booking {
  id: string;
  bookingRef: string;
  type: 'UNRESERVED' | 'PLATFORM';
  status: BookingStatus;
  source: { code: string; name: string; city: string };
  destination: { code: string; name: string; city: string } | null;
  journeyDate: string;
  trainType: TrainType | null;
  trainNumber: string | null;
  trainName: string | null;
  classCode: string;
  adults: number;
  children: number;
  passengers: number;
  distanceKm: number | null;
  fare: FareQuote;
  totalPaise: number;
  fareTableVersion: string;
  paymentMethod: PaymentMethod | null;
  qrPayload: string | null;
  holdExpiresAt: string | null;
  validFrom: string | null;
  validUntil: string | null;
  paidAt: string | null;
  cancelledAt: string | null;
  refundPaise: number | null;
  createdAt: string;
  cancellable: boolean;
  demoWarning: string;
}

export interface PageMeta { page: number; pageSize: number; total: number; totalPages: number }

export interface MockTrain {
  number: string;
  name: string;
  type: TrainType;
  fromCode: string;
  toCode: string;
  departure: string;
  arrival: string;
  durationMin: number;
  dayOffset: number;
  runsOn: boolean[];
  stops: number;
  reservedClasses: string[];
  unreservedFarePaise?: number;
  classes?: { code: string; label: string; fareRupees: number; availability: { status: 'AVAILABLE' | 'RAC' | 'WAITLIST' | 'REGRET'; count: number; label: string } }[];
}

export interface TrainSearch {
  mock: true;
  notice: string;
  from: Station;
  to: Station;
  date: string;
  distanceKm: number;
  via: { code: string; name: string }[];
  trains: MockTrain[];
}

export interface Transaction {
  id: string;
  txnRef: string;
  type: 'BOOKING_PAYMENT' | 'REFUND' | 'WALLET_TOPUP';
  status: 'SUCCESS' | 'FAILED';
  method: PaymentMethod;
  amountPaise: number;
  balanceAfterPaise: number | null;
  failureReason: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
  booking?: { id: string; bookingRef: string } | null;
}

export interface Notification { id: string; kind: string; title: string; body: string; link: string | null; read: boolean; createdAt: string }

export type PaymentInput =
  | { method: 'WALLET' }
  | { method: 'DEMO_UPI'; upiId: string }
  | { method: 'DEMO_CARD'; cardNumber: string; expiry: string; cvv: string; nameOnCard?: string };
