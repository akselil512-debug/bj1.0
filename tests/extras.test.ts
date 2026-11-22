import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/game/cards';
import { BetKey, colorOf, OUTSIDE_BETS, pays, POCKETS, RED_NUMBERS, settle, spinNumber, straight, totalStake, WHEEL_ORDER, wins } from '../src/game/roulette';
import { canSpin, dayKey, emptyDaily, spinWheel, STREAK_BONUS, streakDay, WHEEL_PRIZES } from '../src/game/daily';
import { applyDaily, applyRoulette, newProfile, START_BALANCE } from '../src/game/progress';
import { exportCode, importCode } from '../src/game/storage';

describe('STORY-021 roulette', () => {
  it('has 18 red, 18 black and one green pocket', () => {
    const counts = { red: 0, black: 0, green: 0 };
    for (let n = 0; n < POCKETS; n++) counts[colorOf(n)]++;
    expect(counts).toEqual({ red: 18, black: 18, green: 1 });
    expect(RED_NUMBERS.has(17)).toBe(false);
  });

  it('the wheel shows every number once, with red and black alternating around it', () => {
    expect(WHEEL_ORDER).toHaveLength(POCKETS);
    expect([...WHEEL_ORDER].sort((a, b) => a - b)).toEqual(Array.from({ length: POCKETS }, (_, n) => n));
    expect(WHEEL_ORDER[0]).toBe(0);
    for (let i = 1; i < POCKETS - 1; i++) expect(colorOf(WHEEL_ORDER[i]), `pocket ${i}`).not.toBe(colorOf(WHEEL_ORDER[i + 1]));
    expect(colorOf(WHEEL_ORDER[1])).toBe('red');
  });

  it('every bet has the same expected value of -1/37', () => {
    const keys: BetKey[] = [...OUTSIDE_BETS, straight(0), straight(17), straight(36)];
    for (const key of keys) {
      let net = 0;
      for (let n = 0; n < POCKETS; n++) net += wins(key, n) ? pays(key) : -1;
      expect(net / POCKETS, key).toBeCloseTo(-1 / 37, 12);
    }
  });

  it('zero loses every outside bet', () => {
    for (const key of OUTSIDE_BETS) expect(wins(key, 0), key).toBe(false);
  });

  it('settles a mixed set of bets', () => {
    const bets = { [straight(17)]: 500, red: 1000, d2: 200 };
    expect(totalStake(bets)).toBe(1700);
    const hit = settle(bets, 17); // 17 is black and in the second dozen
    expect(hit.returned).toBe(500 * 36 + 200 * 3);
    expect(hit.net).toBe(18_600 - 1700);
    expect(hit.winners.sort()).toEqual(['d2', 'n17']);
    const miss = settle(bets, 0);
    expect(miss.returned).toBe(0);
    expect(miss.net).toBe(-1700);
    expect(settle({ red: 1000 }, 3).net).toBe(1000);
  });

  it('spins every number at an even rate', () => {
    const rng = mulberry32(11);
    const seen = new Array(POCKETS).fill(0);
    for (let i = 0; i < 74_000; i++) seen[spinNumber(rng)]++;
    for (const count of seen) expect(Math.abs(count - 2000)).toBeLessThan(250);
  });

  it('a spin updates the balance, experience and achievements', () => {
    const p = newProfile('Testi', '123', 1);
    const u = applyRoulette(p, settle({ [straight(17)]: 500 }, 17), 2);
    expect(u.profile.balance).toBe(START_BALANCE + 17_500);
    expect(u.profile.stats.rouletteSpins).toBe(1);
    expect(u.unlocked.map((a) => a.id)).toEqual(expect.arrayContaining(['roulette-first', 'roulette-straight']));
    expect(applyRoulette(p, settle({ red: 1000 }, 0), 2).profile.balance).toBe(START_BALANCE - 1000);
  });
});

describe('STORY-022 daily wheel', () => {
  const rng = () => 0; // always the first segment: 1 000 $

  it('allows one spin per calendar day', () => {
    const first = spinWheel(emptyDaily(), '2026-11-22', rng);
    expect(first.state).toEqual({ lastSpin: '2026-11-22', streak: 1 });
    expect(canSpin(first.state, '2026-11-22')).toBe(false);
    expect(() => spinWheel(first.state, '2026-11-22', rng)).toThrow();
    expect(canSpin(first.state, '2026-11-23')).toBe(true);
  });

  it('pays the wheel prize plus the streak bonus', () => {
    expect(spinWheel(emptyDaily(), '2026-11-22', rng).total).toBe(1000 + 500);
    expect(spinWheel({ lastSpin: '2026-11-22', streak: 4 }, '2026-11-23', rng).total).toBe(1000 + STREAK_BONUS[4]);
  });

  it('continues a streak across a month end and resets after a missed day', () => {
    expect(streakDay({ lastSpin: '2026-11-30', streak: 3 }, '2026-12-01')).toBe(4);
    expect(streakDay({ lastSpin: '2026-11-28', streak: 3 }, '2026-12-01')).toBe(1);
  });

  it('doubles the prize on day seven and then starts a new week', () => {
    const seventh = spinWheel({ lastSpin: '2026-11-22', streak: 6 }, '2026-11-23', rng);
    expect(seventh.doubled).toBe(true);
    expect(seventh.total).toBe(2000);
    expect(streakDay(seventh.state, '2026-11-24')).toBe(1);
  });

  it('lands on every segment', () => {
    const r = mulberry32(5);
    const seen = new Set<number>();
    for (let i = 0; i < 400; i++) seen.add(spinWheel(emptyDaily(), '2026-11-22', r).index);
    expect(seen.size).toBe(WHEEL_PRIZES.length);
  });

  it('formats the local day', () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });

  it('a spin is saved in the profile and survives a transfer code', () => {
    const p = newProfile('Testi', '123', 1);
    const u = applyDaily(p, spinWheel(p.daily, '2026-11-22', rng), 2);
    expect(u.profile.balance).toBe(START_BALANCE + 1500);
    expect(u.profile.daily).toEqual({ lastSpin: '2026-11-22', streak: 1 });
    const restored = importCode(exportCode(u.profile));
    expect(restored.ok && restored.profile.daily).toEqual({ lastSpin: '2026-11-22', streak: 1 });
  });
});
