import { dayDiff } from './date';
import type { Station } from './types';

export const MAX_PASSENGERS = 4;

/** Client-side mirror of the server's journey rules for instant feedback. The server remains authoritative. */
export function validateJourney(input: { from: Station | null; to: Station | null; date: string; today: string; maxDaysAhead?: number }) {
  const errors: Partial<Record<'from' | 'to' | 'date', string>> = {};
  if (!input.from) errors.from = 'Select a departure station';
  if (!input.to) errors.to = 'Select a destination station';
  if (input.from && input.to && input.from.code === input.to.code) errors.to = 'Departure and destination must be different';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) errors.date = 'Select a journey date';
  else {
    const diff = dayDiff(input.today, input.date);
    const max = input.maxDaysAhead ?? 1;
    if (diff < 0) errors.date = 'Journey date cannot be in the past';
    else if (diff > max) errors.date = max === 1 ? 'Unreserved tickets can be booked for today or tomorrow only' : `Choose a date within ${max} days`;
  }
  return errors;
}

export function validatePassengers(adults: number, children: number): string | null {
  const total = adults + children;
  if (total < 1) return 'Add at least one passenger';
  if (total > MAX_PASSENGERS) return `Maximum ${MAX_PASSENGERS} passengers per ticket`;
  if (adults < 1) return 'Children must travel with at least one adult';
  return null;
}

export const isValidPnr = (s: string) => /^\d{10}$/.test(s);
export const isValidTrainNumber = (s: string) => /^\d{5}$/.test(s);
export const isValidEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());

export function passwordIssues(pw: string): string[] {
  const out: string[] = [];
  if (pw.length < 8) out.push('At least 8 characters');
  if (!/[A-Za-z]/.test(pw)) out.push('A letter');
  if (!/\d/.test(pw)) out.push('A number');
  return out;
}
