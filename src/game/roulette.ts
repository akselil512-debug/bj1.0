// European roulette: one zero, numbers 0-36. Pure logic, no UI.
// Payouts are the standard ones; tests/extras.test.ts verifies that every bet
// has the same expected value of -1/37 of the stake.

import type { Rng } from './cards';

export const POCKETS = 37;
export const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

export type Color = 'red' | 'black' | 'green';
export const colorOf = (n: number): Color => (n === 0 ? 'green' : RED_NUMBERS.has(n) ? 'red' : 'black');

export const OUTSIDE_BETS = ['red', 'black', 'odd', 'even', 'low', 'high', 'd1', 'd2', 'd3'] as const;
export type OutsideBet = (typeof OUTSIDE_BETS)[number];
/** A straight-up bet on one number is written as 'n17'. */
export type BetKey = OutsideBet | `n${number}`;
export type Bets = Partial<Record<BetKey, number>>;

export const straight = (n: number): BetKey => `n${n}`;
const straightNumber = (key: BetKey) => (key.startsWith('n') ? Number(key.slice(1)) : null);

/** What the bet pays, as X to 1. */
export function pays(key: BetKey): number {
  if (straightNumber(key) !== null) return 35;
  if (key === 'd1' || key === 'd2' || key === 'd3') return 2;
  return 1;
}

export function wins(key: BetKey, n: number): boolean {
  const single = straightNumber(key);
  if (single !== null) return single === n;
  if (n === 0) return false;
  switch (key) {
    case 'red': return colorOf(n) === 'red';
    case 'black': return colorOf(n) === 'black';
    case 'odd': return n % 2 === 1;
    case 'even': return n % 2 === 0;
    case 'low': return n <= 18;
    case 'high': return n >= 19;
    case 'd1': return n <= 12;
    case 'd2': return n >= 13 && n <= 24;
    case 'd3': return n >= 25;
    default: return false;
  }
}

export const totalStake = (bets: Bets) => Object.values(bets).reduce<number>((sum, v) => sum + (v ?? 0), 0);

export interface SpinResult {
  number: number;
  stake: number;
  returned: number; // winning stakes plus winnings
  net: number;
  winners: BetKey[];
}

export function settle(bets: Bets, n: number): SpinResult {
  let returned = 0;
  const winners: BetKey[] = [];
  for (const [key, amount] of Object.entries(bets) as [BetKey, number][]) {
    if (amount > 0 && wins(key, n)) {
      returned += amount * (pays(key) + 1);
      winners.push(key);
    }
  }
  const stake = totalStake(bets);
  return { number: n, stake, returned, net: returned - stake, winners };
}

export const spinNumber = (rng: Rng) => Math.floor(rng() * POCKETS);

export const OUTSIDE_LABELS: Record<OutsideBet, string> = {
  red: 'Punainen', black: 'Musta', odd: 'Pariton', even: 'Parillinen',
  low: '1–18', high: '19–36', d1: '1–12', d2: '13–24', d3: '25–36',
};
export const COLOR_LABELS: Record<Color, string> = { red: 'punainen', black: 'musta', green: 'vihreä' };
