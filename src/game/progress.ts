// Player profile, experience, levels and achievements. Pure logic.
// Progress is driven by hands played and correct decisions, not by the balance.

import type { Round } from './engine';
import { roundNet } from './engine';

export const START_BALANCE = 100_000;

export interface Stats {
  rounds: number;
  hands: number;
  wins: number;
  losses: number;
  pushes: number;
  blackjacks: number;
  decisions: number;
  correct: number;
  winStreak: number;
  bestWinStreak: number;
  correctStreak: number;
  bestCorrectStreak: number;
  biggestWin: number;
  peakBalance: number;
  splits: number;
  mostHands: number;
  doublesWon: number;
  refills: number;
  bonusGames: number;
  mines: number;
  jackpots: number;
  events: number;
  insuranceWins: number;
  surrenders: number;
  pairsWins: number;
  t3Wins: number;
  specials: Record<string, number>;
}

export interface Profile {
  id: string;
  name: string;
  pin: string; // three digits; a convenience lock, not a security mechanism
  balance: number;
  xp: number;
  stats: Stats;
  achievements: Record<string, number>; // id -> unlock time
  settings: { hints: boolean; calm: boolean };
  tutorialDone: boolean;
  createdAt: number;
}

export const emptyStats = (): Stats => ({
  rounds: 0, hands: 0, wins: 0, losses: 0, pushes: 0, blackjacks: 0, decisions: 0, correct: 0,
  winStreak: 0, bestWinStreak: 0, correctStreak: 0, bestCorrectStreak: 0, biggestWin: 0,
  peakBalance: START_BALANCE, splits: 0, mostHands: 0, doublesWon: 0, refills: 0, bonusGames: 0,
  mines: 0, jackpots: 0, events: 0, insuranceWins: 0, surrenders: 0, pairsWins: 0, t3Wins: 0, specials: {},
});

export function newProfile(name: string, pin: string, now: number): Profile {
  return {
    id: `p${now.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
    name, pin, balance: START_BALANCE, xp: 0, stats: emptyStats(), achievements: {},
    settings: { hints: true, calm: false }, tutorialDone: false, createdAt: now,
  };
}

// Levels: level n starts at 200 × (n − 1)² experience.
export const levelFor = (xp: number) => Math.floor(Math.sqrt(xp / 200)) + 1;
export const xpForLevel = (level: number) => 200 * (level - 1) ** 2;

const TITLES: [number, string][] = [
  [1, 'Keltanokka'], [3, 'Karjapaimen'], [5, 'Korttihai'], [8, 'Uhkapeluri'],
  [12, 'Revolverisankari'], [16, 'Apulaissheriffi'], [20, 'Sheriffi'], [30, 'Lännen legenda'],
];
export const titleFor = (level: number) => TITLES.filter(([min]) => level >= min).pop()![1];
export const TITLE_LADDER = TITLES;

export const accuracy = (s: Stats) => (s.decisions === 0 ? null : s.correct / s.decisions);

export interface Achievement {
  id: string;
  name: string;
  desc: string;
  test: (p: Profile) => boolean;
}

const sp = (p: Profile, id: string) => (p.stats.specials[id] ?? 0) > 0;

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-hand', name: 'Ensimmäinen käsi', desc: 'Pelaa ensimmäinen kierroksesi.', test: (p) => p.stats.rounds >= 1 },
  { id: 'first-win', name: 'Ensimmäinen voitto', desc: 'Voita käsi.', test: (p) => p.stats.wins >= 1 },
  { id: 'first-blackjack', name: 'Kaksikymmentäyksi', desc: 'Saa blackjack.', test: (p) => p.stats.blackjacks >= 1 },
  { id: 'schooled', name: 'Koulunsa käynyt', desc: 'Pelaa ohjattu ensimmäinen kierros loppuun.', test: (p) => p.tutorialDone && p.stats.rounds >= 1 },
  { id: 'double-win', name: 'Tuplavoitto', desc: 'Voita tuplattu käsi.', test: (p) => p.stats.doublesWon >= 1 },
  { id: 'first-split', name: 'Kahtiajako', desc: 'Jaa pari.', test: (p) => p.stats.splits >= 1 },
  { id: 'posse', name: 'Koko jengi koolla', desc: 'Pelaa vähintään neljää kättä samalla kierroksella.', test: (p) => p.stats.mostHands >= 4 },
  { id: 'streak-5', name: 'Voittoputki', desc: 'Voita viisi kierrosta peräkkäin.', test: (p) => p.stats.bestWinStreak >= 5 },
  { id: 'hands-10', name: 'Kanta-asiakas', desc: 'Pelaa 10 kättä.', test: (p) => p.stats.hands >= 10 },
  { id: 'hands-100', name: 'Pöydän vakiokasvo', desc: 'Pelaa 100 kättä.', test: (p) => p.stats.hands >= 100 },
  { id: 'hands-500', name: 'Saluunan kalustoa', desc: 'Pelaa 500 kättä.', test: (p) => p.stats.hands >= 500 },
  { id: 'sharp-10', name: 'Tarkka-ampuja', desc: 'Tee 10 oikeaa siirtoa peräkkäin.', test: (p) => p.stats.bestCorrectStreak >= 10 },
  { id: 'sharp-50', name: 'Kylmähermoinen', desc: 'Tee 50 oikeaa siirtoa peräkkäin.', test: (p) => p.stats.bestCorrectStreak >= 50 },
  { id: 'scholar', name: 'Strategian mestari', desc: 'Pidä osumatarkkuus vähintään 90 %:ssa 100 siirron ajan.', test: (p) => p.stats.decisions >= 100 && p.stats.correct / p.stats.decisions >= 0.9 },
  { id: 'black-kings', name: 'Mustat kuninkaat', desc: 'Saa kaksi mustaa kuningasta aloituskädeksi.', test: (p) => sp(p, 'black-kings') },
  { id: 'dead-mans-hand', name: 'Kuolleen miehen käsi', desc: 'Saa musta ässä ja musta kasi aloituskädeksi.', test: (p) => sp(p, 'dead-mans-hand') },
  { id: 'lucky-sevens', name: 'Kolme seiskaa', desc: 'Saa kolme seiskaa käden ensimmäisiksi korteiksi.', test: (p) => sp(p, 'lucky-sevens') },
  { id: 'saloon-queens', name: 'Saluunan kuningattaret', desc: 'Saa kaksi punaista kuningatarta aloituskädeksi.', test: (p) => sp(p, 'saloon-queens') },
  { id: 'suited-blackjack', name: 'Maablackjack', desc: 'Saa blackjack samaa maata.', test: (p) => sp(p, 'suited-blackjack') },
  { id: 'pairs-win', name: 'Paripeluri', desc: 'Voita Perfect Pairs -sivupanos.', test: (p) => p.stats.pairsWins >= 1 },
  { id: 't3-win', name: 'Pokerinaama', desc: 'Voita 21+3-sivupanos.', test: (p) => p.stats.t3Wins >= 1 },
  { id: 'insured', name: 'Varman päälle', desc: 'Voita vakuutus.', test: (p) => p.stats.insuranceWins >= 1 },
  { id: 'retreat', name: 'Viisas vetäytyminen', desc: 'Luovuta käsi.', test: (p) => p.stats.surrenders >= 1 },
  { id: 'event', name: 'Yllätysvieras', desc: 'Koe pop-up-tapahtuma.', test: (p) => p.stats.events >= 1 },
  { id: 'bonus-game', name: 'Tynnyrinavaaja', desc: 'Pelaa bonuspeli.', test: (p) => p.stats.bonusGames >= 1 },
  { id: 'mine', name: 'Kullankaivaja', desc: 'Pääse kultakaivokseen.', test: (p) => p.stats.mines >= 1 },
  { id: 'jackpot', name: 'Emäsuoni', desc: 'Voita kultakaivoksen päävoitto.', test: (p) => p.stats.jackpots >= 1 },
  { id: 'millionaire', name: 'Miljonääri', desc: 'Kasvata saldosi miljoonaan.', test: (p) => p.stats.peakBalance >= 1_000_000 },
  { id: 'broke', name: 'Tyhjät taskut', desc: 'Pelaa saldosi loppuun.', test: (p) => p.stats.refills >= 1 },
  { id: 'level-5', name: 'Korttihai', desc: 'Saavuta taso 5.', test: (p) => levelFor(p.xp) >= 5 },
  { id: 'level-20', name: 'Kaupungin sheriffi', desc: 'Saavuta taso 20.', test: (p) => levelFor(p.xp) >= 20 },
];

export interface Decision {
  chosen: string;
  best: string;
  correct: boolean;
}

export interface Update {
  profile: Profile;
  xpGained: number;
  unlocked: Achievement[];
  leveledUp: boolean;
}

function finalize(before: Profile, next: Profile, now: number): Update {
  next.stats.peakBalance = Math.max(next.stats.peakBalance, next.balance);
  const unlocked = ACHIEVEMENTS.filter((a) => !next.achievements[a.id] && a.test(next));
  for (const a of unlocked) next.achievements[a.id] = now;
  return {
    profile: next,
    xpGained: next.xp - before.xp,
    unlocked,
    leveledUp: levelFor(next.xp) > levelFor(before.xp),
  };
}

const clone = (p: Profile): Profile => ({
  ...p,
  stats: { ...p.stats, specials: { ...p.stats.specials } },
  achievements: { ...p.achievements },
  settings: { ...p.settings },
});

/** Applies a finished round to the profile. */
export function applyRound(profile: Profile, round: Round, decisions: Decision[], now: number): Update {
  if (round.phase !== 'result') throw new Error('Round is not finished');
  const next = clone(profile);
  const s = next.stats;
  let xp = 0;

  s.rounds++;
  s.hands += round.hands.length;
  xp += 10 * round.hands.length;
  s.splits += round.splits;
  s.mostHands = Math.max(s.mostHands, round.hands.length);

  for (const h of round.hands) {
    if (h.outcome === 'win' || h.outcome === 'blackjack') {
      s.wins++;
      xp += 15;
      if (h.doubled) s.doublesWon++;
    } else if (h.outcome === 'push') s.pushes++;
    else s.losses++;
    if (h.outcome === 'blackjack') {
      s.blackjacks++;
      xp += 40;
    }
    if (h.outcome === 'surrender') s.surrenders++;
  }

  for (const d of decisions) {
    s.decisions++;
    if (d.correct) {
      s.correct++;
      s.correctStreak++;
      xp += 5;
    } else s.correctStreak = 0;
    s.bestCorrectStreak = Math.max(s.bestCorrectStreak, s.correctStreak);
  }

  for (const w of round.bonusWins) {
    s.specials[w.id] = (s.specials[w.id] ?? 0) + 1;
    xp += 100;
  }
  for (const w of round.sideWins) {
    if (w.id === 'perfect-pairs') s.pairsWins++;
    else s.t3Wins++;
  }
  if (round.insuranceWon) s.insuranceWins++;

  const net = roundNet(round);
  if (net > 0) s.winStreak++;
  else if (net < 0) s.winStreak = 0;
  s.bestWinStreak = Math.max(s.bestWinStreak, s.winStreak);
  s.biggestWin = Math.max(s.biggestWin, net);

  next.balance = round.balance;
  next.xp += xp;
  next.tutorialDone = true;
  return finalize(profile, next, now);
}

export function applyBonusGame(
  profile: Profile,
  result: { amount: number; enteredMine: boolean; jackpot: boolean },
  now: number,
): Update {
  const next = clone(profile);
  next.balance += result.amount;
  next.stats.bonusGames++;
  if (result.enteredMine) next.stats.mines++;
  if (result.jackpot) next.stats.jackpots++;
  next.stats.biggestWin = Math.max(next.stats.biggestWin, result.amount);
  next.xp += 50;
  return finalize(profile, next, now);
}

export function applyEvent(profile: Profile, chips: number, now: number): Update {
  const next = clone(profile);
  next.stats.events++;
  next.balance += chips;
  return finalize(profile, next, now);
}

/** Tops the balance up for free when the player cannot afford the minimum bet. */
export function refillIfBroke(profile: Profile, minBet: number, now: number): Update | null {
  if (profile.balance >= minBet) return null;
  const next = clone(profile);
  next.balance = START_BALANCE;
  next.stats.refills++;
  return finalize(profile, next, now);
}
