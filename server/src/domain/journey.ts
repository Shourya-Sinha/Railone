import { DEMO_FARE_TABLE as T } from './fareTable.js';
import { dayDiff, isValidDateString } from '../lib/time.js';

export interface StationLike {
  code: string;
  name: string;
  isActive?: boolean;
}

export interface JourneyIssue {
  field: 'source' | 'destination' | 'journeyDate' | 'passengers' | 'station' | 'persons';
  message: string;
}

/** Business rules for an unreserved journey. Returns a list of human-readable issues. */
export function validateUnreservedJourney(input: {
  source?: StationLike | null;
  destination?: StationLike | null;
  sourceCode?: string;
  destinationCode?: string;
  journeyDate: string;
  today: string;
  adults: number;
  children: number;
}): JourneyIssue[] {
  const issues: JourneyIssue[] = [];
  const { source, destination, journeyDate, today, adults, children } = input;

  if (!source) issues.push({ field: 'source', message: input.sourceCode ? `Unknown departure station "${input.sourceCode}"` : 'Select a departure station' });
  else if (source.isActive === false) issues.push({ field: 'source', message: `${source.name} is not available for booking` });

  if (!destination)
    issues.push({ field: 'destination', message: input.destinationCode ? `Unknown destination station "${input.destinationCode}"` : 'Select a destination station' });
  else if (destination.isActive === false) issues.push({ field: 'destination', message: `${destination.name} is not available for booking` });

  if (source && destination && source.code === destination.code) {
    issues.push({ field: 'destination', message: 'Departure and destination stations must be different' });
  }

  if (!isValidDateString(journeyDate)) {
    issues.push({ field: 'journeyDate', message: 'Enter a valid journey date' });
  } else {
    const diff = dayDiff(today, journeyDate);
    if (diff < 0) issues.push({ field: 'journeyDate', message: 'Journey date cannot be in the past' });
    else if (diff > T.unreservedBookingWindowDays)
      issues.push({ field: 'journeyDate', message: 'Unreserved demo tickets can only be booked for today or tomorrow' });
  }

  issues.push(...validatePassengers(adults, children));
  return issues;
}

export function validatePassengers(adults: number, children: number): JourneyIssue[] {
  const out: JourneyIssue[] = [];
  const total = adults + children;
  if (!Number.isInteger(adults) || !Number.isInteger(children) || adults < 0 || children < 0)
    out.push({ field: 'passengers', message: 'Passenger counts must be whole numbers' });
  else if (total < 1) out.push({ field: 'passengers', message: 'Add at least one passenger' });
  else if (total > T.maxPassengersPerTicket)
    out.push({ field: 'passengers', message: `A maximum of ${T.maxPassengersPerTicket} passengers is allowed per ticket` });
  else if (adults < 1) out.push({ field: 'passengers', message: 'Children must travel with at least one adult' });
  return out;
}

export function validateReservedSearchDate(journeyDate: string, today: string): string | null {
  if (!isValidDateString(journeyDate)) return 'Enter a valid journey date';
  const diff = dayDiff(today, journeyDate);
  if (diff < 0) return 'Journey date cannot be in the past';
  if (diff > 60) return 'Demo reserved search is open up to 60 days in advance';
  return null;
}
