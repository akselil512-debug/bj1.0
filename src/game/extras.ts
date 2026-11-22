// Random pop-up events and the nested bonus games. Pure logic.

import { Rng, shuffle } from './cards';
import type { Modifiers } from './engine';

export interface GameEvent {
  id: string;
  name: string;
  desc: string;
  weight: number;
}

/** Chance that an event appears between two rounds. */
export const EVENT_CHANCE = 0.12;
export const FREE_CHIPS = 5000;

export const EVENTS: GameEvent[] = [
  { id: 'gold-rush', name: 'Kultaryntäys', desc: 'Seuraavan kierroksen voitot maksetaan kaksinkertaisina.', weight: 25 },
  { id: 'free-double', name: 'Talo tarjoaa tuplauksen', desc: 'Seuraavalla kierroksella tuplaus ei maksa sinulle mitään.', weight: 25 },
  { id: 'stagecoach', name: 'Postivaunut saapuivat', desc: `Saat ${FREE_CHIPS.toLocaleString('fi-FI')} $ pelirahaa.`, weight: 20 },
  { id: 'horseshoe', name: 'Onnen hevosenkenkä', desc: 'Seuraavalla kierroksella blackjack maksaa 5:1.', weight: 15 },
  { id: 'sheriff', name: 'Sheriffin suojelus', desc: 'Seuraavalla kierroksella ensimmäinen hävitty käsi saa panoksensa takaisin.', weight: 10 },
  { id: 'back-room', name: 'Kutsu takahuoneeseen', desc: 'Pääset suoraan bonuspeliin.', weight: 5 },
];

const TOTAL_WEIGHT = EVENTS.reduce((sum, e) => sum + e.weight, 0);

/** Probability that this specific event appears between two rounds. */
export const eventProbability = (e: GameEvent) => (EVENT_CHANCE * e.weight) / TOTAL_WEIGHT;

export function rollEvent(rng: Rng): GameEvent | null {
  if (rng() >= EVENT_CHANCE) return null;
  let pick = rng() * TOTAL_WEIGHT;
  for (const e of EVENTS) {
    pick -= e.weight;
    if (pick < 0) return e;
  }
  return EVENTS[EVENTS.length - 1];
}

export function modifiersFor(eventId: string): Modifiers {
  switch (eventId) {
    case 'gold-rush':
      return { winMultiplier: 2 };
    case 'free-double':
      return { freeDouble: true };
    case 'horseshoe':
      return { blackjackPays: 5 };
    case 'sheriff':
      return { lossShield: true };
    default:
      return {};
  }
}

// Bonus game: pick one of five whiskey barrels. One hides the key to the gold
// mine, a second bonus game inside the first. Prizes are multiples of the bet.

export type Prize = number | 'mine' | 'jackpot';

export const BARREL_PRIZES: Prize[] = [1, 2, 3, 5, 'mine'];
export const CART_PRIZES: Prize[] = [5, 5, 5, 10, 10, 10, 20, 20, 25, 50, 50, 'jackpot'];

/** The jackpot is 1000 times a blackjack win. A blackjack win is 1.5 × bet. */
export const JACKPOT_MULTIPLIER = 1000 * 1.5;

export const makeBarrels = (rng: Rng): Prize[] => shuffle([...BARREL_PRIZES], rng);
export const makeCarts = (rng: Rng): Prize[] => shuffle([...CART_PRIZES], rng);

export function prizeAmount(prize: Prize, bet: number): number {
  if (prize === 'mine') return 0;
  if (prize === 'jackpot') return JACKPOT_MULTIPLIER * bet;
  return prize * bet;
}

/** Average payout of one bonus game as a multiple of the bet, when barrels and carts are picked blindly. */
export function bonusGameExpectedMultiplier(): number {
  const avg = (prizes: Prize[], inner: number) =>
    prizes.reduce<number>((sum, p) => sum + (p === 'mine' ? inner : p === 'jackpot' ? JACKPOT_MULTIPLIER : p), 0) / prizes.length;
  return avg(BARREL_PRIZES, avg(CART_PRIZES, 0));
}
