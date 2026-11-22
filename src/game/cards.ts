// Cards, shoe and hand values. Pure logic, no UI.

export type Suit = 0 | 1 | 2 | 3; // 0 spades, 1 hearts, 2 diamonds, 3 clubs
export interface Card {
  r: number; // 1 = ace ... 11 = jack, 12 = queen, 13 = king
  s: Suit;
}
export type Rng = () => number;

export const DECKS = 6;
export const SHOE_SIZE = DECKS * 52;
export const RESHUFFLE_AT = Math.floor(SHOE_SIZE / 4);

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: T[], rng: Rng): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

export function newShoe(rng: Rng, decks = DECKS): Card[] {
  const cards: Card[] = [];
  for (let d = 0; d < decks; d++)
    for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) cards.push({ r, s: s as Suit });
  return shuffle(cards, rng);
}

export const isBlack = (c: Card) => c.s === 0 || c.s === 3;
export const isRed = (c: Card) => !isBlack(c);
export const cardValue = (c: Card) => (c.r === 1 ? 11 : Math.min(c.r, 10));

export function handValue(cards: Card[]): { total: number; soft: boolean } {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    total += cardValue(c);
    if (c.r === 1) aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return { total, soft: aces > 0 };
}

export const isBlackjack = (cards: Card[]) => cards.length === 2 && handValue(cards).total === 21;

export const SUIT_SYMBOLS = ['♠', '♥', '♦', '♣'];
const SUIT_NAMES = ['pata', 'hertta', 'ruutu', 'risti'];
const RANK_NAMES = ['', 'ässä', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'jätkä', 'kuningatar', 'kuningas'];
const RANK_SHORT = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export const rankShort = (c: Card) => RANK_SHORT[c.r];
export const cardLabel = (c: Card) => `${SUIT_NAMES[c.s]}${RANK_NAMES[c.r]}`;
