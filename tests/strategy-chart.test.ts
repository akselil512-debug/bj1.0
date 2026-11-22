// Checks every cell of the basic strategy against the published chart for
// 4-8 decks, dealer stands on soft 17, double after split, surrender allowed.
// Source: https://wizardofodds.com/games/blackjack/strategy/4-decks/
import { describe, expect, it } from 'vitest';
import { Card } from '../src/game/cards';
import { bestAction } from '../src/game/strategy';
import type { Action } from '../src/game/engine';

const UPCARDS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 1]; // chart columns: 2 3 4 5 6 7 8 9 10 A
const CODES: Record<string, Action> = { H: 'hit', S: 'stand', D: 'double', P: 'split', R: 'surrender' };
const ALL: Action[] = ['hit', 'stand', 'double', 'split', 'surrender'];
const card = (r: number, s = 0): Card => ({ r, s: s as Card['s'] });

const HARD: Record<number, string> = {
  5: 'HHHHHHHHHH', 6: 'HHHHHHHHHH', 7: 'HHHHHHHHHH', 8: 'HHHHHHHHHH',
  9: 'HDDDDHHHHH', 10: 'DDDDDDDDHH', 11: 'DDDDDDDDDH', 12: 'HHSSSHHHHH',
  13: 'SSSSSHHHHH', 14: 'SSSSSHHHHH', 15: 'SSSSSHHHRH', 16: 'SSSSSHHRRR',
  17: 'SSSSSSSSSS', 18: 'SSSSSSSSSS', 19: 'SSSSSSSSSS',
};
const SOFT: Record<number, string> = {
  2: 'HHHDDHHHHH', 3: 'HHHDDHHHHH', 4: 'HHDDDHHHHH', 5: 'HHDDDHHHHH',
  6: 'HDDDDHHHHH', 7: 'SDDDDSSHHH', 8: 'SSSSSSSSSS', 9: 'SSSSSSSSSS',
};
const PAIRS: Record<number, string> = {
  2: 'PPPPPPHHHH', 3: 'PPPPPPHHHH', 4: 'HHHPPHHHHH', 5: 'DDDDDDDDHH', 6: 'PPPPPHHHHH',
  7: 'PPPPPPHHHH', 8: 'PPPPPPPPPP', 9: 'PPPPPSPPSS', 10: 'SSSSSSSSSS', 1: 'PPPPPPPPPP',
};

/** Two different ranks that add up to a hard total, never a pair and never an ace. */
function hardHand(total: number): Card[] {
  for (let a = 2; a <= 10; a++) {
    const b = total - a;
    if (b >= 2 && b <= 10 && b !== a) return [card(a), card(b, 1)];
  }
  throw new Error(`No hard hand for ${total}`);
}

function check(name: string, cards: Card[], row: string) {
  UPCARDS.forEach((up, i) => {
    const got = bestAction(cards, card(up, 2), ALL).action;
    expect(got, `${name} vs ${up === 1 ? 'A' : up}`).toBe(CODES[row[i]]);
  });
}

describe('basic strategy matches the published chart cell by cell', () => {
  it('hard totals', () => {
    for (const [total, row] of Object.entries(HARD)) check(`hard ${total}`, hardHand(Number(total)), row);
  });
  it('soft totals', () => {
    for (const [other, row] of Object.entries(SOFT)) check(`A-${other}`, [card(1), card(Number(other), 1)], row);
  });
  it('pairs', () => {
    for (const [rank, row] of Object.entries(PAIRS)) check(`pair of ${rank}`, [card(Number(rank)), card(Number(rank), 1)], row);
  });
});
