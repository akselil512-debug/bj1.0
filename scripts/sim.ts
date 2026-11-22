// STORY-010: measures the player's expected value for the base game, every
// bonus, the side bets, the bonus games and the pop-up events.
// Run with: npm run sim

import { mkdirSync, writeFileSync } from 'node:fs';
import { mulberry32, Rng } from '../src/game/cards';
import { act, decideInsurance, legalActions, Modifiers, prepareShoe, Round, startRound } from '../src/game/engine';
import { SPECIALS } from '../src/game/bonuses';
import { bestAction } from '../src/game/strategy';
import { bonusGameExpectedMultiplier, FREE_CHIPS, makeBarrels, makeCarts, modifiersFor, prizeAmount, rollEvent } from '../src/game/extras';

const ROUNDS = Number(process.env.ROUNDS ?? 3_000_000);
const BET = 100;
const SIDE = 10;

interface Totals {
  rounds: number;
  main: number; // net of main hands
  specials: Record<string, { hits: number; amount: number }>;
  pp: number;
  t3: number;
  bonusGames: number;
  bonusAmount: number;
  jackpots: number;
  freeChips: number;
  events: number;
}

function playBonusGame(rng: Rng, t: Totals) {
  t.bonusGames++;
  let prize = makeBarrels(rng)[0];
  if (prize === 'mine') prize = makeCarts(rng)[0];
  if (prize === 'jackpot') t.jackpots++;
  t.bonusAmount += prizeAmount(prize, BET);
}

function simulate(seed: number, withEvents: boolean): Totals {
  const rng = mulberry32(seed);
  const t: Totals = { rounds: ROUNDS, main: 0, specials: {}, pp: 0, t3: 0, bonusGames: 0, bonusAmount: 0, jackpots: 0, freeChips: 0, events: 0 };
  for (const s of SPECIALS) t.specials[s.id] = { hits: 0, amount: 0 };
  let shoe = prepareShoe(null, rng);

  for (let i = 0; i < ROUNDS; i++) {
    let mods: Modifiers = {};
    if (withEvents) {
      const event = rollEvent(rng);
      if (event) {
        t.events++;
        if (event.id === 'stagecoach') t.freeChips += FREE_CHIPS;
        else if (event.id === 'back-room') playBonusGame(rng, t);
        else mods = modifiersFor(event.id);
      }
    }
    shoe = prepareShoe(shoe, rng);
    let round: Round = startRound({ shoe, rng, balance: 1e12, bet: BET, side: { pp: SIDE, t3: SIDE }, mods });
    if (round.phase === 'insurance') round = decideInsurance(round, false);
    while (round.phase === 'player') {
      const hand = round.hands[round.active];
      round = act(round, bestAction(hand.cards, round.dealer[0], legalActions(round)).action);
    }
    for (const h of round.hands) t.main += h.returned - h.bet;
    for (const w of round.bonusWins) {
      t.specials[w.id].hits++;
      t.specials[w.id].amount += w.amount;
    }
    t.pp -= SIDE;
    t.t3 -= SIDE;
    for (const w of round.sideWins) {
      if (w.id === 'perfect-pairs') t.pp += w.amount;
      else t.t3 += w.amount;
    }
    if (round.triggerBonusGame) playBonusGame(rng, t);
  }
  return t;
}

const perBet = (amount: number) => amount / (ROUNDS * BET);
const pct = (x: number) => `${(x * 100).toFixed(2)} %`;
const oneIn = (hits: number) => (hits === 0 ? 'ei osumia' : `1 / ${Math.round(ROUNDS / hits).toLocaleString('fi-FI')}`);

const started = Date.now();
const base = simulate(2026, false);
const wild = simulate(2027, true);

const specialsTotal = Object.values(base.specials).reduce((sum, s) => sum + s.amount, 0);
const results = {
  generatedAt: new Date().toISOString(),
  rounds: ROUNDS,
  bet: BET,
  baseGame: perBet(base.main),
  specials: SPECIALS.map((s) => ({
    id: s.id,
    name: s.name,
    multiplier: s.multiplier,
    frequency: base.specials[s.id].hits / ROUNDS,
    ev: perBet(base.specials[s.id].amount),
  })),
  specialsTotal: perBet(specialsTotal),
  perfectPairs: base.pp / (ROUNDS * SIDE),
  twentyOnePlusThree: base.t3 / (ROUNDS * SIDE),
  bonusGame: {
    frequency: base.bonusGames / ROUNDS,
    expectedMultiplier: bonusGameExpectedMultiplier(),
    ev: perBet(base.bonusAmount),
    jackpotFrequency: base.jackpots / ROUNDS,
  },
  withoutEvents: perBet(base.main + specialsTotal + base.bonusAmount),
  withEvents: perBet(
    wild.main + Object.values(wild.specials).reduce((sum, s) => sum + s.amount, 0) + wild.bonusAmount + wild.freeChips,
  ),
};

const lines = [
  '# Bonusten simulaatio (STORY-010)',
  '',
  `Ajettu ${results.generatedAt}. ${ROUNDS.toLocaleString('fi-FI')} kierrosta kumpaankin ajoon, panos ${BET} $, pelaaja pelaa perusstrategiaa eikä ota vakuutusta.`,
  '',
  'Odotusarvo on ilmoitettu prosentteina pääpanoksesta kierrosta kohden. Plusmerkkinen luku tarkoittaa, että pelaaja voittaa pitkällä aikavälillä.',
  '',
  '## Kokonaisuus',
  '',
  '| Osa | Pelaajan odotusarvo |',
  '|---|---|',
  `| Peruspeli ilman bonuksia | ${pct(results.baseGame)} |`,
  `| Erikoiskädet yhteensä | +${pct(results.specialsTotal)} |`,
  `| Bonuspelit (laukeaa blackjackista) | +${pct(results.bonusGame.ev)} |`,
  `| **Koko peli ilman tapahtumia** | **${pct(results.withoutEvents)}** |`,
  `| **Koko peli tapahtumien kanssa** | **${pct(results.withEvents)}** |`,
  '',
  '## Erikoiskädet',
  '',
  '| Käsi | Kerroin | Yleisyys | Odotusarvo |',
  '|---|---|---|---|',
  ...results.specials.map((s) => `| ${s.name} | ${s.multiplier} × | ${oneIn(base.specials[s.id].hits)} | +${pct(s.ev)} |`),
  '',
  'Tarkka laskelma: kaksi mustaa kuningasta kuudesta pakasta on 12/312 × 11/311 = 1/735,1, joten 1000 × panos tuottaa +136,0 % kierrosta kohden.',
  '',
  '## Sivupanokset',
  '',
  'Odotusarvo prosentteina sivupanoksesta.',
  '',
  '| Sivupanos | Odotusarvo |',
  '|---|---|',
  `| Perfect Pairs (25 / 12 / 6) | ${pct(results.perfectPairs)} |`,
  `| 21+3 (100 / 40 / 30 / 10 / 5) | ${pct(results.twentyOnePlusThree)} |`,
  '',
  '## Bonuspeli',
  '',
  `- Laukeaa ${oneIn(base.bonusGames)} kierroksella.`,
  `- Yksi bonuspeli maksaa keskimäärin ${results.bonusGame.expectedMultiplier.toFixed(1)} × panos.`,
  `- Päävoitto (1500 × panos) osuu ${oneIn(base.jackpots)} kierroksella.`,
  '',
  '## Johtopäätös',
  '',
  'Peli on pelaajalle vahvasti voitollinen, kuten tuoteomistaja halusi pelirahaversioon. Tällä kertoimistolla peliä ei voi käyttää oikealla rahalla. Kertoimet lukitaan vasta, kun tuoteomistaja on käynyt tämän tuloksen läpi.',
  '',
];

mkdirSync('docs', { recursive: true });
writeFileSync('docs/simulation.md', lines.join('\n'));
writeFileSync('src/game/sim-results.json', JSON.stringify(results, null, 2) + '\n');
console.log(lines.join('\n'));
console.log(`\n${((Date.now() - started) / 1000).toFixed(1)} s`);
