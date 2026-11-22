// The daily wheel: one free spin per calendar day and a seven-day streak. Pure logic.
// The day comes from the device clock, which is fine for play money.

import type { Rng } from './cards';

/** Wheel segments clockwise from the pointer. */
export const WHEEL_PRIZES = [1000, 500, 5000, 500, 2500, 1000, 10000, 25000];
/** Extra chips for days 1-6 of a streak. On day 7 the wheel prize is doubled instead. */
export const STREAK_BONUS = [500, 500, 1000, 1000, 2500, 2500, 0];
export const STREAK_LENGTH = 7;

export interface DailyState {
  lastSpin: string | null; // local date, YYYY-MM-DD
  streak: number; // day of the streak reached at the last spin, 0 before the first
}

export const emptyDaily = (): DailyState => ({ lastSpin: null, streak: 0 });

export function dayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function previousDay(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d - 1));
}

export const canSpin = (state: DailyState, today: string) => state.lastSpin !== today;

/** The streak day a spin today would be: continues from yesterday, otherwise starts over. */
export function streakDay(state: DailyState, today: string): number {
  if (state.lastSpin === today) return state.streak;
  return state.lastSpin === previousDay(today) ? (state.streak % STREAK_LENGTH) + 1 : 1;
}

export interface WheelResult {
  index: number;
  prize: number; // what the segment shows
  doubled: boolean;
  bonus: number;
  total: number; // credited to the balance
  state: DailyState;
}

export function spinWheel(state: DailyState, today: string, rng: Rng): WheelResult {
  if (!canSpin(state, today)) throw new Error('Already spun today');
  const day = streakDay(state, today);
  const index = Math.floor(rng() * WHEEL_PRIZES.length);
  const prize = WHEEL_PRIZES[index];
  const doubled = day === STREAK_LENGTH;
  const bonus = STREAK_BONUS[day - 1];
  return { index, prize, doubled, bonus, total: prize * (doubled ? 2 : 1) + bonus, state: { lastSpin: today, streak: day } };
}
