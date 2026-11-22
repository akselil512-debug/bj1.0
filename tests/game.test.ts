import { describe, expect, it } from 'vitest';
import { Card, DECKS, handValue, mulberry32, newShoe, Suit } from '../src/game/cards';
import { act, decideInsurance, legalActions, Round, roundNet, startRound } from '../src/game/engine';
import { evalPerfectPairs, evalTwentyOnePlusThree, initialSpecials } from '../src/game/bonuses';
import { bestAction } from '../src/game/strategy';
import { BARREL_PRIZES, bonusGameExpectedMultiplier, CART_PRIZES, EVENT_CHANCE, EVENTS, eventProbability, JACKPOT_MULTIPLIER, makeBarrels, makeCarts, modifiersFor, prizeAmount, rollEvent } from '../src/game/extras';
import { ACHIEVEMENTS, applyBonusGame, applyRound, levelFor, newProfile, refillIfBroke, START_BALANCE, titleFor, xpForLevel } from '../src/game/progress';
import { exportCode, importCode, loadProfiles, saveProfiles } from '../src/game/storage';

const S: Suit = 0, H: Suit = 1, D: Suit = 2, C: Suit = 3;
const c = (r: number, s: Suit = S): Card => ({ r, s });
const rng = mulberry32(1);

/** Builds a shoe that deals the given cards in order: player, dealer up, player, dealer hole, then draws. */
const rig = (...cards: Card[]) => [...cards].reverse();

function deal(cards: Card[], opts: Partial<Parameters<typeof startRound>[0]> = {}): Round {
  return startRound({ shoe: rig(...cards), rng, balance: 10_000, bet: 100, ...opts });
}

describe('STORY-001 basic round', () => {
  it('uses six decks', () => {
    expect(DECKS).toBe(6);
    const shoe = newShoe(mulberry32(7));
    expect(shoe).toHaveLength(312);
    expect(shoe.filter((x) => x.r === 13 && x.s === S)).toHaveLength(6);
  });

  it('counts aces as 11 or 1', () => {
    expect(handValue([c(1), c(6)])).toEqual({ total: 17, soft: true });
    expect(handValue([c(1), c(6), c(10)])).toEqual({ total: 17, soft: false });
    expect(handValue([c(1), c(1), c(9)])).toEqual({ total: 21, soft: true });
  });

  it('pays blackjack 3:2', () => {
    const r = deal([c(1, H), c(9), c(13, D), c(7)]);
    expect(r.phase).toBe('result');
    expect(r.hands[0].outcome).toBe('blackjack');
    expect(roundNet(r)).toBe(150);
  });

  it('returns the bet on a push', () => {
    const r = act(deal([c(10), c(10, H), c(9, H), c(9, D)]), 'stand');
    expect(r.hands[0].outcome).toBe('push');
    expect(roundNet(r)).toBe(0);
  });

  it('dealer draws to 16 and stands on 17, soft 17 included', () => {
    const hard = act(deal([c(10), c(10, H), c(8, H), c(6, D), c(2), c(5)]), 'stand');
    expect(hard.dealer).toHaveLength(3); // 16 -> 18, then stands
    expect(hard.hands[0].outcome).toBe('push');
    const soft = act(deal([c(10), c(6, D), c(8, H), c(1, H), c(5)]), 'stand');
    expect(soft.dealer).toHaveLength(2); // soft 17 stands
    expect(soft.hands[0].outcome).toBe('win');
  });

  it('dealer peeks for blackjack before the player acts', () => {
    const r = deal([c(10), c(10, H), c(9, H), c(1, D)]);
    expect(r.phase).toBe('result');
    expect(r.hands[0].outcome).toBe('lose');
    expect(roundNet(r)).toBe(-100);
  });

  it('player blackjack pushes against dealer blackjack', () => {
    const r = deal([c(1, H), c(13, H), c(13, D), c(1, D)]);
    expect(r.hands[0].outcome).toBe('push');
    expect(roundNet(r)).toBe(0);
  });

  it('a bust loses without the dealer drawing', () => {
    const r = act(deal([c(10), c(6, H), c(6, H), c(10, D), c(10, C)]), 'hit');
    expect(r.hands[0].outcome).toBe('bust');
    expect(r.dealer).toHaveLength(2);
    expect(roundNet(r)).toBe(-100);
  });

  it('rejects bets the player cannot afford', () => {
    expect(() => startRound({ shoe: newShoe(rng), rng, balance: 50, bet: 100 })).toThrow();
  });
});

describe('STORY-002 double and unlimited split', () => {
  it('doubles on any two cards and takes exactly one card', () => {
    const r = act(deal([c(5), c(10, H), c(6, H), c(7, D), c(10, C)]), 'double');
    expect(r.phase).toBe('result');
    expect(r.hands[0].cards).toHaveLength(3);
    expect(r.hands[0].bet).toBe(200);
    expect(roundNet(r)).toBe(200);
  });

  it('plays split hands separately with their own bets', () => {
    let r = deal([c(8), c(6, H), c(8, H), c(10, D), c(3), c(2, H), c(10, C), c(10, D), c(10, H)]);
    expect(legalActions(r)).toContain('split');
    r = act(r, 'split'); // hands: 8+3 and 8+2
    expect(r.hands).toHaveLength(2);
    expect(r.hands.map((h) => h.bet)).toEqual([100, 100]);
    expect(legalActions(r)).toContain('double'); // double after split
    r = act(r, 'double'); // 8+3+10 = 21
    r = act(r, 'hit'); // 8+2+10 = 20
    r = act(r, 'stand');
    expect(r.phase).toBe('result'); // dealer 16 draws 10 and busts
    expect(r.hands.map((h) => h.outcome)).toEqual(['win', 'win']);
    expect(roundNet(r)).toBe(300);
  });

  it('allows re-splitting without an upper limit while the balance lasts', () => {
    const eights = Array.from({ length: 20 }, (_, i) => c(8, (i % 4) as Suit));
    let r = deal([c(8), c(6, H), c(8, H), c(10, D), ...eights]);
    for (let i = 0; i < 8; i++) {
      expect(legalActions(r)).toContain('split');
      r = act(r, 'split');
    }
    expect(r.hands).toHaveLength(9);
    expect(r.splits).toBe(8);
  });

  it('does not offer a split the player cannot pay for', () => {
    const r = deal([c(8), c(6, H), c(8, H), c(10, D)], { balance: 150 });
    expect(legalActions(r)).not.toContain('split');
  });
});

describe('STORY-003 insurance and surrender', () => {
  it('offers insurance only when the dealer shows an ace', () => {
    expect(deal([c(10), c(1, H), c(9, H), c(5, D)]).phase).toBe('insurance');
    expect(deal([c(10), c(13, H), c(9, H), c(5, D)]).phase).toBe('player');
  });

  it('insurance pays 2:1 when the dealer has blackjack', () => {
    const r = decideInsurance(deal([c(10), c(1, H), c(9, H), c(13, D)]), true);
    expect(r.insuranceWon).toBe(true);
    expect(roundNet(r)).toBe(0); // loses 100, wins 100 on the 50 insurance
  });

  it('insurance is lost when the dealer has no blackjack', () => {
    let r = decideInsurance(deal([c(10), c(1, H), c(9, H), c(6, D)]), true);
    expect(r.phase).toBe('player');
    r = act(r, 'stand');
    expect(roundNet(r)).toBe(100 - 50);
  });

  it('surrender returns half the bet and ends the hand', () => {
    const r = act(deal([c(10), c(10, H), c(6, H), c(7, D)]), 'surrender');
    expect(r.phase).toBe('result');
    expect(roundNet(r)).toBe(-50);
  });

  it('surrender is not available after hitting or splitting', () => {
    const r = act(deal([c(2), c(10, H), c(3, H), c(7, D), c(4)]), 'hit');
    expect(legalActions(r)).not.toContain('surrender');
  });
});

describe('STORY-008 side bets', () => {
  it('grades Perfect Pairs', () => {
    expect(evalPerfectPairs(c(9, S), c(9, S))?.pays).toBe(25);
    expect(evalPerfectPairs(c(9, S), c(9, C))?.pays).toBe(12);
    expect(evalPerfectPairs(c(9, S), c(9, H))?.pays).toBe(6);
    expect(evalPerfectPairs(c(9, S), c(8, S))).toBeNull();
  });

  it('grades 21+3', () => {
    expect(evalTwentyOnePlusThree(c(7, H), c(7, H), c(7, H))?.pays).toBe(100);
    expect(evalTwentyOnePlusThree(c(5, H), c(6, H), c(7, H))?.pays).toBe(40);
    expect(evalTwentyOnePlusThree(c(7, H), c(7, S), c(7, D))?.pays).toBe(30);
    expect(evalTwentyOnePlusThree(c(12, H), c(13, S), c(1, D))?.pays).toBe(10);
    expect(evalTwentyOnePlusThree(c(1, H), c(2, S), c(3, D))?.pays).toBe(10);
    expect(evalTwentyOnePlusThree(c(2, H), c(9, H), c(13, H))?.pays).toBe(5);
    expect(evalTwentyOnePlusThree(c(13, H), c(1, S), c(2, D))).toBeNull();
  });

  it('settles side bets from the first cards', () => {
    const r = deal([c(9, S), c(2, H), c(9, S), c(10, D)], { side: { pp: 10, t3: 10 } });
    expect(r.sideWins.map((w) => w.id)).toEqual(['perfect-pairs']);
    expect(r.balance).toBe(10_000 - 120 + 10 * 26);
  });
});

describe('STORY-009 special hands', () => {
  it('pays 1000 × bet for two black kings as the starting hand', () => {
    const r = deal([c(13, S), c(6, H), c(13, C), c(10, D)]);
    expect(r.bonusWins).toEqual([{ id: 'black-kings', name: 'Mustat kuninkaat', multiplier: 1000, amount: 100_000 }]);
    expect(r.balance).toBe(10_000 - 100 + 100_000);
  });

  it('does not pay for a red king or for kings after a split', () => {
    expect(initialSpecials([c(13, S), c(13, H)])).toEqual([]);
    let r = deal([c(13, H), c(6, H), c(13, D), c(10, D), c(13, S), c(13, C)]);
    r = act(r, 'split');
    expect(r.bonusWins).toEqual([]);
  });

  it('recognises the other special hands', () => {
    expect(initialSpecials([c(1, S), c(8, C)]).map((s) => s.id)).toEqual(['dead-mans-hand']);
    expect(initialSpecials([c(12, H), c(12, D)]).map((s) => s.id)).toEqual(['saloon-queens']);
    expect(initialSpecials([c(1, D), c(11, D)]).map((s) => s.id)).toEqual(['suited-blackjack']);
    expect(initialSpecials([c(1, D), c(11, H)])).toEqual([]);
  });

  it('pays three sevens on the third card', () => {
    const r = act(deal([c(7, S), c(6, H), c(7, H), c(10, D), c(7, D)]), 'hit');
    expect(r.bonusWins.map((w) => w.id)).toEqual(['lucky-sevens']);
    expect(r.bonusWins[0].amount).toBe(7700);
  });
});

describe('STORY-019 events and STORY-018 bonus games', () => {
  it('has at least five events whose probabilities add up to the event chance', () => {
    expect(EVENTS.length).toBeGreaterThanOrEqual(5);
    expect(EVENTS.reduce((sum, e) => sum + eventProbability(e), 0)).toBeCloseTo(EVENT_CHANCE, 10);
  });

  it('rolls events at roughly the listed rate', () => {
    const r = mulberry32(42);
    let hits = 0;
    for (let i = 0; i < 100_000; i++) if (rollEvent(r)) hits++;
    expect(hits / 100_000).toBeCloseTo(EVENT_CHANCE, 2);
  });

  it('gold rush doubles winnings', () => {
    const r = act(deal([c(10), c(10, H), c(10, H), c(7, D)], { mods: modifiersFor('gold-rush') }), 'stand');
    expect(roundNet(r)).toBe(200);
  });

  it('free double costs nothing extra and pays on the doubled stake', () => {
    const start = deal([c(5), c(10, H), c(6, H), c(7, D), c(10, C)], { mods: modifiersFor('free-double') });
    const r = act(start, 'double');
    expect(r.hands[0].bet).toBe(100);
    expect(roundNet(r)).toBe(200);
    const lost = act(deal([c(5), c(10, H), c(6, H), c(10, D), c(2, C)], { mods: modifiersFor('free-double') }), 'double');
    expect(roundNet(lost)).toBe(-100);
  });

  it('horseshoe pays blackjack 5:1', () => {
    expect(roundNet(deal([c(1, H), c(9), c(13, D), c(7)], { mods: modifiersFor('horseshoe') }))).toBe(500);
  });

  it('sheriff returns the first lost bet', () => {
    const r = act(deal([c(10), c(10, H), c(7, H), c(10, D)], { mods: modifiersFor('sheriff') }), 'stand');
    expect(r.hands[0].outcome).toBe('lose');
    expect(roundNet(r)).toBe(0);
  });

  it('a player blackjack triggers the bonus game', () => {
    expect(deal([c(1, H), c(9), c(13, D), c(7)]).triggerBonusGame).toBe(true);
    expect(act(deal([c(10), c(10, H), c(10, H), c(7, D)]), 'stand').triggerBonusGame).toBe(false);
  });

  it('bonus game holds one mine and the mine holds one jackpot worth 1000 blackjack wins', () => {
    expect(makeBarrels(mulberry32(3)).slice().sort()).toEqual(BARREL_PRIZES.slice().sort());
    expect(makeCarts(mulberry32(3)).filter((p) => p === 'jackpot')).toHaveLength(1);
    expect(CART_PRIZES).toHaveLength(12);
    expect(JACKPOT_MULTIPLIER).toBe(1500);
    expect(prizeAmount('jackpot', 100)).toBe(150_000);
    expect(prizeAmount(5, 100)).toBe(500);
    expect(bonusGameExpectedMultiplier()).toBeCloseTo((1 + 2 + 3 + 5 + 1710 / 12) / 5, 10);
  });
});

describe('STORY-006 basic strategy', () => {
  const all = ['hit', 'stand', 'double', 'split', 'surrender'] as const;
  const best = (cards: Card[], up: number, legal: readonly string[] = all) => bestAction(cards, c(up), legal as any).action;

  it('hard totals', () => {
    expect(best([c(10), c(6, H)], 10)).toBe('surrender');
    expect(best([c(10), c(6, H)], 10, ['hit', 'stand'])).toBe('hit');
    expect(best([c(10), c(6, H)], 6)).toBe('stand');
    expect(best([c(10), c(5, H)], 10)).toBe('surrender');
    expect(best([c(10), c(5, H)], 9)).toBe('hit');
    expect(best([c(10), c(2, H)], 3)).toBe('hit');
    expect(best([c(10), c(2, H)], 4)).toBe('stand');
    expect(best([c(6), c(5, H)], 10)).toBe('double');
    expect(best([c(6), c(5, H)], 1)).toBe('hit');
    expect(best([c(6), c(4, H)], 10)).toBe('hit');
    expect(best([c(6), c(3, H)], 2)).toBe('hit');
    expect(best([c(6), c(3, H)], 3)).toBe('double');
    expect(best([c(10), c(7, H)], 1)).toBe('stand');
  });

  it('soft totals', () => {
    expect(best([c(1), c(7, H)], 9)).toBe('hit');
    expect(best([c(1), c(7, H)], 2)).toBe('stand');
    expect(best([c(1), c(7, H)], 5)).toBe('double');
    expect(best([c(1), c(7, H), c(13)], 5, ['hit', 'stand'])).toBe('stand');
    expect(best([c(1), c(2, H), c(5)], 5, ['hit', 'stand'])).toBe('stand'); // soft 18 with three cards
    expect(best([c(1), c(6, H)], 2)).toBe('hit');
    expect(best([c(1), c(2, H)], 5)).toBe('double');
    expect(best([c(1), c(8, H)], 6)).toBe('stand');
  });

  it('pairs', () => {
    expect(best([c(1), c(1, H)], 10)).toBe('split');
    expect(best([c(8), c(8, H)], 10)).toBe('split');
    expect(best([c(10), c(10, H)], 6)).toBe('stand');
    expect(best([c(9), c(9, H)], 7)).toBe('stand');
    expect(best([c(9), c(9, H)], 8)).toBe('split');
    expect(best([c(5), c(5, H)], 9)).toBe('double');
    expect(best([c(4), c(4, H)], 5)).toBe('split');
    expect(best([c(4), c(4, H)], 4)).toBe('hit');
    expect(best([c(7), c(7, H)], 8)).toBe('hit');
    expect(best([c(6), c(6, H)], 7)).toBe('hit');
  });

  it('always explains itself', () => {
    expect(bestAction([c(10), c(6, H)], c(10), all as any).reason.length).toBeGreaterThan(10);
  });
});

describe('STORY-011/012 progress', () => {
  it('levels and titles rise with experience', () => {
    expect(levelFor(0)).toBe(1);
    expect(levelFor(xpForLevel(5))).toBe(5);
    expect(levelFor(xpForLevel(5) - 1)).toBe(4);
    expect(titleFor(1)).toBe('Keltanokka');
    expect(titleFor(20)).toBe('Sheriffi');
  });

  it('has at least 15 achievements with unique ids', () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(15);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
  });

  it('a finished round updates balance, stats, experience and achievements', () => {
    const p = newProfile('Testi', '123', 1);
    const round = startRound({ shoe: rig(c(1, H), c(9), c(13, D), c(7)), rng, balance: p.balance, bet: 100 });
    const u = applyRound(p, round, [{ chosen: 'stand', best: 'stand', correct: true }], 2);
    expect(u.profile.balance).toBe(START_BALANCE + 150);
    expect(u.profile.stats.blackjacks).toBe(1);
    expect(u.profile.stats.correct).toBe(1);
    expect(u.xpGained).toBe(10 + 15 + 40 + 5);
    expect(u.unlocked.map((a) => a.id)).toEqual(expect.arrayContaining(['first-hand', 'first-win', 'first-blackjack']));
    expect(p.stats.rounds).toBe(0); // the original is untouched
  });

  it('experience does not depend on the balance', () => {
    const p = newProfile('Testi', '123', 1);
    const u = applyBonusGame(p, { amount: 150_000, enteredMine: true, jackpot: true }, 2);
    expect(u.xpGained).toBe(50);
    expect(u.unlocked.map((a) => a.id)).toEqual(expect.arrayContaining(['bonus-game', 'mine', 'jackpot']));
  });

  it('refills an empty balance for free', () => {
    const p = { ...newProfile('Testi', '123', 1), balance: 50 };
    expect(refillIfBroke(p, 100, 2)?.profile.balance).toBe(START_BALANCE);
    expect(refillIfBroke(newProfile('A', '111', 1), 100, 2)).toBeNull();
  });
});

describe('STORY-013/014 storage and transfer code', () => {
  const memory = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
  };

  it('profiles survive a reload', () => {
    const store = memory();
    const p = { ...newProfile('Villi Ville', '042', 1), balance: 777, xp: 900 };
    saveProfiles(store, [p]);
    expect(loadProfiles(store)).toEqual([p]);
  });

  it('survives corrupted storage', () => {
    const store = memory();
    store.setItem('saloon21.v1', '{not json');
    expect(loadProfiles(store)).toEqual([]);
  });

  it('a transfer code restores the same progress', () => {
    const p = newProfile('Äijä Öljymäki', '900', 1);
    p.xp = 12345;
    p.stats.specials['black-kings'] = 2;
    p.achievements['first-hand'] = 5;
    const result = importCode(exportCode(p));
    expect(result).toEqual({ ok: true, profile: p });
  });

  it('rejects broken and foreign codes with a message', () => {
    const code = exportCode(newProfile('Testi', '123', 1));
    for (const bad of ['', 'hello', code.slice(0, -3), code.replace('S21', 'X21'), code.slice(0, 20) + 'x' + code.slice(21)]) {
      const r = importCode(bad);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.length).toBeGreaterThan(5);
    }
  });
});

describe('STORY-020 several hands side by side', () => {
  // Deal order with two hands: hand 1, hand 2, dealer up, hand 1, hand 2, dealer hole.
  it('deals every hand its own cards and charges the bet for each', () => {
    const r = deal([c(10), c(9, H), c(6, D), c(8, H), c(2, D), c(10, C)], { hands: 2 });
    expect(r.hands.map((h) => h.cards.map((x) => x.r))).toEqual([[10, 8], [9, 2]]);
    expect(r.dealer.map((x) => x.r)).toEqual([6, 10]);
    expect(r.balance).toBe(10_000 - 200);
    expect(r.active).toBe(0);
  });

  it('plays the hands in turn and settles each against the dealer', () => {
    let r = deal([c(10), c(9, H), c(6, D), c(8, H), c(2, D), c(10, C), c(10, H), c(5)], { hands: 2 });
    r = act(r, 'stand'); // hand 1 stays on 18
    expect(r.active).toBe(1);
    r = act(r, 'double'); // hand 2: 11 + 10 = 21
    expect(r.phase).toBe('result'); // dealer 16 draws 5 and makes 21
    expect(r.hands.map((h) => h.outcome)).toEqual(['lose', 'push']);
    expect(roundNet(r)).toBe(-100);
  });

  it('pays a natural at once and lets the other hands play on', () => {
    let r = deal([c(1, H), c(10), c(9, D), c(13, D), c(7, H), c(8, C)], { hands: 2 });
    expect(r.phase).toBe('player');
    expect(r.active).toBe(1); // hand 1 is a blackjack and needs no decision
    r = act(r, 'stand'); // 17 against dealer 17
    expect(r.hands.map((h) => h.outcome)).toEqual(['blackjack', 'push']);
    expect(roundNet(r)).toBe(150);
    expect(r.triggerBonusGame).toBe(true);
  });

  it('dealer blackjack beats every hand except a natural', () => {
    const r = deal([c(1, H), c(10), c(13, C), c(13, D), c(9, H), c(1, C)], { hands: 2 });
    expect(r.phase).toBe('result');
    expect(r.hands.map((h) => h.outcome)).toEqual(['push', 'lose']);
    expect(roundNet(r)).toBe(-100);
  });

  it('insurance covers all hands', () => {
    const offered = deal([c(10), c(9, H), c(1, C), c(8, H), c(7, D), c(13, C)], { hands: 2 });
    expect(offered.phase).toBe('insurance');
    const r = decideInsurance(offered, true);
    expect(r.insurance).toBe(100);
    expect(roundNet(r)).toBe(0); // loses 200, wins 200 on the 100 insurance
  });

  it('each hand can surrender, split and earn its own bonuses', () => {
    let r = deal([c(13, S), c(10), c(9, D), c(13, C), c(6, H), c(8, C)], { hands: 2 });
    expect(r.bonusWins.map((w) => w.name)).toEqual(['Käsi 1: Mustat kuninkaat']);
    expect(legalActions(r)).toContain('split');
    r = act(r, 'stand');
    expect(legalActions(r)).toContain('surrender'); // hand 2: 16 against 9
    r = act(r, 'surrender');
    expect(r.hands.map((h) => h.outcome)).toEqual(['win', 'surrender']);
  });

  it('side bets are placed and settled per hand', () => {
    const r = deal([c(9, S), c(4, H), c(2, D), c(9, S), c(7, D), c(10, C)], { hands: 2, side: { pp: 10, t3: 0 } });
    expect(r.sideWins.map((w) => w.name)).toEqual(['Käsi 1: Perfect Pairs: Täydellinen pari (sama maa)']);
    expect(r.balance).toBe(10_000 - 220 + 260);
  });

  it('allows one to five hands and no more than the balance covers', () => {
    expect(deal(newShoe(mulberry32(5)), { hands: 5 }).hands).toHaveLength(5);
    expect(() => deal(newShoe(mulberry32(5)), { hands: 6 })).toThrow();
    expect(() => deal(newShoe(mulberry32(5)), { hands: 3, balance: 250 })).toThrow();
  });
});
