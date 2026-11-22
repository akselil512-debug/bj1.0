// Basic strategy for this game's rules: 6 decks, dealer stands on all 17s,
// double after split allowed, late surrender. Source and verification status
// are recorded in docs/strategy-source.md.

import { Card, cardValue, handValue } from './cards';
import type { Action } from './engine';

export interface Advice {
  action: Action;
  reason: string;
}

const REASONS = {
  surrender: 'Tämä käsi häviää useimmiten. Luovuttamalla pelastat puolet panoksesta.',
  split: 'Tämä pari tuottaa enemmän kahtena kätenä kuin yhtenä.',
  splitNever: 'Kaksikymmentä on liian hyvä käsi rikottavaksi.',
  double: 'Olet tässä vahvoilla, joten panos kannattaa tuplata.',
  standWeakDealer: 'Jakajalla on heikko kortti ja hän menee helposti yli. Älä ota riskiä.',
  standStrong: 'Kätesi on jo vahva. Lisäkortti veisi sinut todennäköisesti yli.',
  hitStrongDealer: 'Jakajalla on vahva kortti, joten kätesi tarvitsee parannusta.',
  hitSafe: 'Et voi mennä yli yhdellä kortilla, joten ota kortti.',
  hitSoft: 'Pehmeä käsi ei voi mennä yli yhdellä kortilla, ja se kaipaa parannusta.',
  hitTwelve: 'Kaksitoista on liian heikko jakajan korttia vastaan. Ota kortti.',
};

type Code = 'H' | 'S' | 'D' | 'Ds' | 'P' | 'R';

function hard(total: number, d: number): Code {
  if (total >= 17) return 'S';
  if (total >= 13) return d <= 6 ? 'S' : 'H';
  if (total === 12) return d >= 4 && d <= 6 ? 'S' : 'H';
  if (total === 11) return d <= 10 ? 'D' : 'H';
  if (total === 10) return d <= 9 ? 'D' : 'H';
  if (total === 9) return d >= 3 && d <= 6 ? 'D' : 'H';
  return 'H';
}

function soft(total: number, d: number): Code {
  if (total >= 19) return 'S';
  if (total === 18) return d >= 3 && d <= 6 ? 'Ds' : d === 2 || d === 7 || d === 8 ? 'S' : 'H';
  if (total === 17) return d >= 3 && d <= 6 ? 'D' : 'H';
  if (total >= 15) return d >= 4 && d <= 6 ? 'D' : 'H';
  return d >= 5 && d <= 6 ? 'D' : 'H';
}

/** Returns 'P' when the pair should be split, otherwise null (play it as a total). */
function pair(v: number, d: number): 'P' | 'S' | null {
  switch (v) {
    case 11:
    case 8:
      return 'P';
    case 10:
      return 'S';
    case 9:
      return d === 7 || d >= 10 ? 'S' : 'P';
    case 7:
    case 3:
    case 2:
      return d <= 7 ? 'P' : null;
    case 6:
      return d <= 6 ? 'P' : null;
    case 4:
      return d === 5 || d === 6 ? 'P' : null;
    default:
      return null;
  }
}

export function bestAction(cards: Card[], dealerUp: Card, legal: Action[]): Advice {
  const d = cardValue(dealerUp);
  const { total, soft: isSoft } = handValue(cards);
  const can = (a: Action) => legal.includes(a);
  const isPair = cards.length === 2 && cards[0].r === cards[1].r;

  if (isPair) {
    const p = pair(cardValue(cards[0]), d);
    if (p === 'P' && can('split')) return { action: 'split', reason: REASONS.split };
    if (p === 'S') return { action: 'stand', reason: REASONS.splitNever };
  }

  if (!isSoft && can('surrender') && !(isPair && cards[0].r === 8)) {
    if ((total === 16 && d >= 9) || (total === 15 && d === 10)) return { action: 'surrender', reason: REASONS.surrender };
  }

  const code = isSoft ? soft(total, d) : hard(total, d);
  if (code === 'D' || code === 'Ds') {
    if (can('double')) return { action: 'double', reason: REASONS.double };
    if (code === 'Ds') return { action: 'stand', reason: REASONS.standStrong };
    return { action: 'hit', reason: isSoft ? REASONS.hitSoft : REASONS.hitSafe };
  }
  if (code === 'S') {
    return { action: 'stand', reason: total >= 17 ? REASONS.standStrong : REASONS.standWeakDealer };
  }
  if (isSoft) return { action: 'hit', reason: REASONS.hitSoft };
  if (total <= 11) return { action: 'hit', reason: REASONS.hitSafe };
  if (total === 12 && d <= 3) return { action: 'hit', reason: REASONS.hitTwelve };
  return { action: 'hit', reason: REASONS.hitStrongDealer };
}

/** Insurance is never the best play under basic strategy. */
export const INSURANCE_ADVICE = {
  take: false,
  reason: 'Vakuutus on pitkällä aikavälillä tappiollinen sivupanos. Jätä se ottamatta.',
};

export const ACTION_NAMES: Record<Action, string> = {
  hit: 'Ota kortti',
  stand: 'Jää',
  double: 'Tuplaa',
  split: 'Jaa',
  surrender: 'Luovuta',
};
