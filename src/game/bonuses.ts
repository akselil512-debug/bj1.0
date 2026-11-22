// Special hands and side bets. Multipliers are design choices; their effect on
// the player's expected value is measured by scripts/sim.ts, never assumed.

import { Card, isBlack, isBlackjack, isRed } from './cards';

export interface Special {
  id: string;
  name: string;
  multiplier: number; // paid on the original main bet
  desc: string;
}

export const SPECIALS: Special[] = [
  { id: 'black-kings', name: 'Mustat kuninkaat', multiplier: 1000, desc: 'Aloituskätesi on kaksi mustaa kuningasta.' },
  { id: 'lucky-sevens', name: 'Kolme seiskaa', multiplier: 77, desc: 'Käden kolme ensimmäistä korttia ovat seiskoja (ei jaetussa kädessä).' },
  { id: 'dead-mans-hand', name: 'Kuolleen miehen käsi', multiplier: 25, desc: 'Aloituskätesi on musta ässä ja musta kasi.' },
  { id: 'saloon-queens', name: 'Saluunan kuningattaret', multiplier: 10, desc: 'Aloituskätesi on kaksi punaista kuningatarta.' },
  { id: 'suited-blackjack', name: 'Maablackjack', multiplier: 2, desc: 'Blackjack, jonka molemmat kortit ovat samaa maata.' },
];

export const specialById = (id: string) => SPECIALS.find((s) => s.id === id)!;

/** Specials that trigger from the player's first two cards. */
export function initialSpecials(cards: Card[]): Special[] {
  const [a, b] = cards;
  const out: Special[] = [];
  if (a.r === 13 && b.r === 13 && isBlack(a) && isBlack(b)) out.push(specialById('black-kings'));
  if (isBlack(a) && isBlack(b) && ((a.r === 1 && b.r === 8) || (a.r === 8 && b.r === 1)))
    out.push(specialById('dead-mans-hand'));
  if (a.r === 12 && b.r === 12 && isRed(a) && isRed(b)) out.push(specialById('saloon-queens'));
  if (isBlackjack(cards) && a.s === b.s) out.push(specialById('suited-blackjack'));
  return out;
}

export const isLuckySevens = (cards: Card[]) => cards.length === 3 && cards.every((c) => c.r === 7);

export interface PayRow {
  name: string;
  pays: number; // X to 1
}

export const PERFECT_PAIRS_TABLE: PayRow[] = [
  { name: 'Täydellinen pari (sama maa)', pays: 25 },
  { name: 'Värillinen pari (sama väri)', pays: 12 },
  { name: 'Sekapari', pays: 6 },
];

export const TWENTY_ONE_PLUS_THREE_TABLE: PayRow[] = [
  { name: 'Kolmoset samaa maata', pays: 100 },
  { name: 'Värisuora', pays: 40 },
  { name: 'Kolmoset', pays: 30 },
  { name: 'Suora', pays: 10 },
  { name: 'Väri', pays: 5 },
];

/** Returns the winning row or null. Uses the player's first two cards. */
export function evalPerfectPairs(a: Card, b: Card): PayRow | null {
  if (a.r !== b.r) return null;
  if (a.s === b.s) return PERFECT_PAIRS_TABLE[0];
  if (isBlack(a) === isBlack(b)) return PERFECT_PAIRS_TABLE[1];
  return PERFECT_PAIRS_TABLE[2];
}

/** Returns the winning row or null. Uses the player's first two cards and the dealer's upcard. */
export function evalTwentyOnePlusThree(a: Card, b: Card, c: Card): PayRow | null {
  const ranks = [a.r, b.r, c.r].sort((x, y) => x - y);
  const flush = a.s === b.s && b.s === c.s;
  const trips = ranks[0] === ranks[2];
  const straight =
    (ranks[1] === ranks[0] + 1 && ranks[2] === ranks[1] + 1) || (ranks[0] === 1 && ranks[1] === 12 && ranks[2] === 13);
  const t = TWENTY_ONE_PLUS_THREE_TABLE;
  if (trips && flush) return t[0];
  if (straight && flush) return t[1];
  if (trips) return t[2];
  if (straight) return t[3];
  if (flush) return t[4];
  return null;
}
