// Blackjack round engine. American rules:
// 6 decks, blackjack pays 3:2, push returns the bet, dealer stands on all 17s,
// dealer peeks for blackjack, double on any two cards (also after split),
// unlimited re-splits, insurance, late surrender.

import { Card, Rng, handValue, isBlackjack, newShoe, RESHUFFLE_AT, cardValue } from './cards';
import { evalPerfectPairs, evalTwentyOnePlusThree, initialSpecials, isLuckySevens, specialById } from './bonuses';

export type Action = 'hit' | 'stand' | 'double' | 'split' | 'surrender';
export type Phase = 'insurance' | 'player' | 'result';
export type Outcome = 'blackjack' | 'win' | 'push' | 'lose' | 'bust' | 'surrender';

/** One-round modifiers granted by pop-up events. */
export interface Modifiers {
  winMultiplier?: number; // multiplies winnings on main hands
  freeDouble?: boolean; // the house stakes the doubled part
  blackjackPays?: number; // replaces 1.5
  lossShield?: boolean; // first losing hand gets its bet back
}

export interface Hand {
  cards: Card[];
  bet: number; // the player's own stake on this hand
  extra: number; // stake added by the house (free double)
  doubled: boolean;
  fromSplit: boolean;
  done: boolean;
  outcome?: Outcome;
  returned: number;
  shielded?: boolean;
}

export interface Win {
  id: string;
  name: string;
  multiplier: number;
  amount: number; // total credited to the balance
}

export interface Round {
  shoe: Card[]; // shared and mutated: cards are drawn from the end
  rng: Rng;
  dealer: Card[]; // [0] is the upcard, [1] the hole card
  hands: Hand[];
  active: number;
  phase: Phase;
  baseBet: number;
  startBalance: number; // balance before any bet of this round
  balance: number;
  insurance: number;
  insuranceWon: boolean;
  side: { pp: number; t3: number };
  sideWins: Win[];
  bonusWins: Win[];
  mods: Modifiers;
  dealerRevealed: boolean;
  splits: number;
  triggerBonusGame: boolean;
}

export interface StartOptions {
  shoe: Card[];
  rng: Rng;
  balance: number;
  bet: number;
  side?: { pp?: number; t3?: number };
  mods?: Modifiers;
}

export const MIN_BET = 100;

function draw(round: Round): Card {
  if (round.shoe.length === 0) round.shoe.push(...newShoe(round.rng));
  return round.shoe.pop()!;
}

/** Returns the shoe to use for the next round, reshuffling when the cut card is reached. */
export function prepareShoe(shoe: Card[] | null, rng: Rng): Card[] {
  return shoe && shoe.length > RESHUFFLE_AT ? shoe : newShoe(rng);
}

function copy(round: Round): Round {
  return {
    ...round,
    dealer: [...round.dealer],
    hands: round.hands.map((h) => ({ ...h, cards: [...h.cards] })),
    sideWins: [...round.sideWins],
    bonusWins: [...round.bonusWins],
  };
}

function newHand(cards: Card[], bet: number, fromSplit: boolean): Hand {
  return { cards, bet, extra: 0, doubled: false, fromSplit, done: false, returned: 0 };
}

function creditSpecial(round: Round, id: string) {
  const s = specialById(id);
  const amount = s.multiplier * round.baseBet;
  round.balance += amount;
  round.bonusWins.push({ id: s.id, name: s.name, multiplier: s.multiplier, amount });
}

export function startRound(opts: StartOptions): Round {
  const pp = opts.side?.pp ?? 0;
  const t3 = opts.side?.t3 ?? 0;
  if (opts.bet < MIN_BET) throw new Error('Bet is below the minimum');
  if (opts.bet + pp + t3 > opts.balance) throw new Error('Not enough balance');

  const round: Round = {
    shoe: opts.shoe,
    rng: opts.rng,
    dealer: [],
    hands: [],
    active: 0,
    phase: 'player',
    baseBet: opts.bet,
    startBalance: opts.balance,
    balance: opts.balance - opts.bet - pp - t3,
    insurance: 0,
    insuranceWon: false,
    side: { pp, t3 },
    sideWins: [],
    bonusWins: [],
    mods: opts.mods ?? {},
    dealerRevealed: false,
    splits: 0,
    triggerBonusGame: false,
  };

  const p1 = draw(round);
  const up = draw(round);
  const p2 = draw(round);
  const hole = draw(round);
  round.dealer = [up, hole];
  round.hands = [newHand([p1, p2], opts.bet, false)];

  if (pp > 0) {
    const row = evalPerfectPairs(p1, p2);
    if (row) {
      const amount = pp * (row.pays + 1);
      round.balance += amount;
      round.sideWins.push({ id: 'perfect-pairs', name: `Perfect Pairs: ${row.name}`, multiplier: row.pays, amount });
    }
  }
  if (t3 > 0) {
    const row = evalTwentyOnePlusThree(p1, p2, up);
    if (row) {
      const amount = t3 * (row.pays + 1);
      round.balance += amount;
      round.sideWins.push({ id: 'twenty-one-plus-three', name: `21+3: ${row.name}`, multiplier: row.pays, amount });
    }
  }
  for (const s of initialSpecials([p1, p2])) creditSpecial(round, s.id);

  if (up.r === 1) {
    round.phase = 'insurance';
    return round;
  }
  return afterInsurance(round);
}

export const insuranceCost = (round: Round) => round.baseBet / 2;
export const canAffordInsurance = (round: Round) => round.balance >= insuranceCost(round);

export function decideInsurance(prev: Round, take: boolean): Round {
  if (prev.phase !== 'insurance') throw new Error('Insurance is not on offer');
  const round = copy(prev);
  if (take) {
    if (!canAffordInsurance(round)) throw new Error('Not enough balance for insurance');
    round.insurance = insuranceCost(round);
    round.balance -= round.insurance;
  }
  return afterInsurance(round);
}

function afterInsurance(round: Round): Round {
  const dealerBj = isBlackjack(round.dealer);
  const playerBj = isBlackjack(round.hands[0].cards);
  if (dealerBj) {
    if (round.insurance > 0) {
      round.balance += round.insurance * 3;
      round.insuranceWon = true;
    }
    round.hands[0].done = true;
    return finish(round);
  }
  if (playerBj) {
    round.hands[0].done = true;
    return finish(round);
  }
  round.phase = 'player';
  return round;
}

export function legalActions(round: Round): Action[] {
  if (round.phase !== 'player') return [];
  const hand = round.hands[round.active];
  const actions: Action[] = ['hit', 'stand'];
  if (hand.cards.length === 2) {
    if (round.balance >= hand.bet || round.mods.freeDouble) actions.push('double');
    if (hand.cards[0].r === hand.cards[1].r && round.balance >= hand.bet) actions.push('split');
    if (!hand.fromSplit && round.hands.length === 1) actions.push('surrender');
  }
  return actions;
}

function afterDraw(round: Round, hand: Hand) {
  if (!hand.fromSplit && isLuckySevens(hand.cards)) creditSpecial(round, 'lucky-sevens');
  const { total } = handValue(hand.cards);
  if (total > 21) {
    hand.outcome = 'bust';
    hand.done = true;
  } else if (total === 21) {
    hand.done = true;
  }
}

export function act(prev: Round, action: Action): Round {
  if (!legalActions(prev).includes(action)) throw new Error(`Illegal action: ${action}`);
  const round = copy(prev);
  const hand = round.hands[round.active];

  switch (action) {
    case 'hit':
      hand.cards.push(draw(round));
      afterDraw(round, hand);
      break;
    case 'stand':
      hand.done = true;
      break;
    case 'double':
      if (round.mods.freeDouble) {
        hand.extra += hand.bet;
      } else {
        round.balance -= hand.bet;
        hand.bet *= 2;
      }
      hand.doubled = true;
      hand.cards.push(draw(round));
      afterDraw(round, hand);
      hand.done = true;
      break;
    case 'split': {
      round.balance -= hand.bet;
      round.splits++;
      const a = newHand([hand.cards[0], draw(round)], hand.bet, true);
      const b = newHand([hand.cards[1], draw(round)], hand.bet, true);
      for (const h of [a, b]) if (handValue(h.cards).total === 21) h.done = true;
      round.hands.splice(round.active, 1, a, b);
      break;
    }
    case 'surrender':
      hand.outcome = 'surrender';
      hand.done = true;
      break;
  }

  while (round.active < round.hands.length && round.hands[round.active].done) round.active++;
  if (round.active >= round.hands.length) return finish(round);
  return round;
}

function finish(round: Round): Round {
  round.dealerRevealed = true;
  round.active = Math.min(round.active, round.hands.length - 1);
  const natural = round.hands.length === 1 && !round.hands[0].fromSplit && isBlackjack(round.hands[0].cards);
  const dealerBj = isBlackjack(round.dealer);
  const live = round.hands.some((h) => h.outcome !== 'bust' && h.outcome !== 'surrender');

  if (live && !natural && !dealerBj) {
    while (handValue(round.dealer).total < 17) round.dealer.push(draw(round));
  }
  const dealerTotal = handValue(round.dealer).total;
  const winMult = round.mods.winMultiplier ?? 1;
  let shieldLeft = !!round.mods.lossShield;

  for (const hand of round.hands) {
    const total = handValue(hand.cards).total;
    if (hand.outcome === 'surrender') {
      hand.returned = hand.bet / 2;
    } else if (hand.outcome === 'bust') {
      hand.returned = 0;
    } else if (natural && !dealerBj) {
      hand.outcome = 'blackjack';
      hand.returned = hand.bet + hand.bet * (round.mods.blackjackPays ?? 1.5) * winMult;
    } else if (dealerBj) {
      hand.outcome = natural ? 'push' : 'lose';
      hand.returned = natural ? hand.bet : 0;
    } else if (dealerTotal > 21 || total > dealerTotal) {
      hand.outcome = 'win';
      hand.returned = hand.bet + (hand.bet + hand.extra) * winMult;
    } else if (total === dealerTotal) {
      hand.outcome = 'push';
      hand.returned = hand.bet;
    } else {
      hand.outcome = 'lose';
      hand.returned = 0;
    }
    if (shieldLeft && (hand.outcome === 'lose' || hand.outcome === 'bust')) {
      hand.returned = hand.bet;
      hand.shielded = true;
      shieldLeft = false;
    }
    round.balance += hand.returned;
  }

  round.triggerBonusGame = round.hands[0].outcome === 'blackjack';
  round.phase = 'result';
  return round;
}

/** Net change of the balance over the whole round, bonuses and side bets included. */
export const roundNet = (round: Round) => round.balance - round.startBalance;

export const dealerUpValue = (round: Round) => cardValue(round.dealer[0]);
