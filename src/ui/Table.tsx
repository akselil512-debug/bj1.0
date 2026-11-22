import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, cardValue, handValue } from '../game/cards';
import {
  act, Action, canAffordInsurance, decideInsurance, Hand, insuranceCost, legalActions, MAX_HANDS, MIN_BET, Modifiers,
  Outcome, prepareShoe, Round, roundNet, startRound, Win,
} from '../game/engine';
import { ACTION_NAMES, bestAction, INSURANCE_ADVICE } from '../game/strategy';
import { FREE_CHIPS, GameEvent, makeBarrels, makeCarts, modifiersFor, Prize, prizeAmount, rollEvent } from '../game/extras';
import { applyBonusGame, applyEvent, applyRound, Decision, Profile, refillIfBroke, START_BALANCE, Update } from '../game/progress';
import { PERFECT_PAIRS_TABLE, TWENTY_ONE_PLUS_THREE_TABLE } from '../game/bonuses';
import { CardView, Modal, money } from './common';

interface Props {
  profile: Profile;
  onUpdate: (u: Update) => void;
  onSave: (p: Profile) => void;
  onBalance: (n: number | null) => void;
  notify: (title: string, text: string) => void;
}

type Overlay =
  | { kind: 'event'; event: GameEvent }
  | { kind: 'celebrate'; wins: Win[] }
  | { kind: 'bonus'; bet: number }
  | null;

const CHIPS = [100, 500, 1000, 5000, 25000];
const ACTION_ORDER: Action[] = ['hit', 'stand', 'double', 'split', 'surrender'];
const OUTCOME_LABELS: Record<Outcome, string> = {
  blackjack: 'Blackjack!', win: 'Voitto', push: 'Tasapeli', lose: 'Häviö', bust: 'Yli 21', surrender: 'Luovutettu',
};

const totalText = (cards: Card[]) => {
  const { total, soft } = handValue(cards);
  return soft && total < 21 ? `pehmeä ${total}` : `${total}`;
};

export function Table({ profile, onUpdate, onSave, onBalance, notify }: Props) {
  const shoe = useRef<Card[] | null>(null);
  const [round, setRound] = useState<Round | null>(null);
  const [bet, setBet] = useState(500);
  const [seats, setSeats] = useState(1);
  const [pp, setPp] = useState(false);
  const [t3, setT3] = useState(false);
  const [showPaytables, setShowPaytables] = useState(false);
  const [mods, setMods] = useState<{ mods: Modifiers; name: string } | null>(null);
  const [roundModName, setRoundModName] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [pendingBonus, setPendingBonus] = useState<number | null>(null);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [coach, setCoach] = useState(!profile.tutorialDone);

  const inPlay = round !== null && round.phase !== 'result';
  const balance = inPlay ? round.balance : profile.balance;
  const sideStake = Math.max(10, Math.round(bet / 10));
  const perHand = bet + (pp ? sideStake : 0) + (t3 ? sideStake : 0);
  const totalStake = perHand * seats;
  const canDeal = bet >= MIN_BET && totalStake <= profile.balance;

  useEffect(() => {
    onBalance(inPlay ? round.balance : null);
    return () => onBalance(null);
  }, [inPlay, round, onBalance]);

  useEffect(() => {
    if (!profile.tutorialDone) setCoach(true);
  }, [profile.tutorialDone]);

  // Free refill when the player cannot afford the minimum bet.
  useEffect(() => {
    if (inPlay) return;
    const refill = refillIfBroke(profile, MIN_BET, Date.now());
    if (refill) {
      onUpdate(refill);
      notify('Talo tarjoaa', `Taskusi olivat tyhjät, joten saldosi täytettiin: ${money(START_BALANCE)}.`);
    }
  }, [profile, inPlay, onUpdate, notify]);

  useEffect(() => {
    if (!inPlay && bet > profile.balance) setBet(Math.max(MIN_BET, Math.floor(profile.balance / 100) * 100));
  }, [profile.balance, inPlay, bet]);

  const settle = (r: Round, all: Decision[]) => {
    onUpdate(applyRound(profile, r, all, Date.now()));
    if (r.triggerBonusGame) setPendingBonus(r.baseBet);
  };

  const celebrateNew = (before: number, r: Round) => {
    if (r.bonusWins.length > before) setOverlay({ kind: 'celebrate', wins: r.bonusWins.slice(before) });
  };

  const deal = () => {
    if (!canDeal) return;
    shoe.current = prepareShoe(shoe.current, Math.random);
    const r = startRound({
      shoe: shoe.current,
      rng: Math.random,
      balance: profile.balance,
      bet,
      hands: seats,
      side: { pp: pp ? sideStake : 0, t3: t3 ? sideStake : 0 },
      mods: mods?.mods,
    });
    setRoundModName(mods?.name ?? null);
    setMods(null);
    setDecisions([]);
    setRound(r);
    celebrateNew(0, r);
    if (r.phase === 'result') settle(r, []);
  };

  const onAction = (action: Action) => {
    if (!round || round.phase !== 'player') return;
    const hand = round.hands[round.active];
    const best = bestAction(hand.cards, round.dealer[0], legalActions(round)).action;
    const all = [...decisions, { chosen: ACTION_NAMES[action], best: ACTION_NAMES[best], correct: best === action }];
    const r = act(round, action);
    setDecisions(all);
    setRound(r);
    celebrateNew(round.bonusWins.length, r);
    if (r.phase === 'result') settle(r, all);
  };

  const onInsurance = (take: boolean) => {
    if (!round || round.phase !== 'insurance') return;
    const all = [...decisions, { chosen: take ? 'Vakuutus' : 'Ei vakuutusta', best: 'Ei vakuutusta', correct: !take }];
    const r = decideInsurance(round, take);
    setDecisions(all);
    setRound(r);
    if (r.phase === 'result') settle(r, all);
  };

  const nextRound = () => {
    setRound(null);
    setDecisions([]);
    setRoundModName(null);
    setCoach(false);
    const event = rollEvent(Math.random);
    if (event) setOverlay({ kind: 'event', event });
  };

  const acceptEvent = (event: GameEvent) => {
    onUpdate(applyEvent(profile, event.id === 'stagecoach' ? FREE_CHIPS : 0, Date.now()));
    if (event.id === 'back-room') setOverlay({ kind: 'bonus', bet: Math.max(MIN_BET, bet) });
    else {
      if (event.id !== 'stagecoach') setMods({ mods: modifiersFor(event.id), name: event.name });
      setOverlay(null);
    }
  };

  const finishBonus = (result: { amount: number; enteredMine: boolean; jackpot: boolean }) => {
    onUpdate(applyBonusGame(profile, result, Date.now()));
    setPendingBonus(null);
    setOverlay(null);
  };

  const skipCoach = () => {
    setCoach(false);
    if (!profile.tutorialDone) onSave({ ...profile, tutorialDone: true });
  };

  const legal = round ? legalActions(round) : [];
  const advice =
    round && round.phase === 'player' ? bestAction(round.hands[round.active].cards, round.dealer[0], legal) : null;
  const showHints = profile.settings.hints || coach;
  const net = round && round.phase === 'result' ? roundNet(round) : 0;
  const wrong = decisions.filter((d) => !d.correct);

  const status = !round
    ? 'Aseta panos.'
    : round.phase === 'insurance'
      ? 'Jakajalla on ässä. Haluatko vakuutuksen?'
      : round.phase === 'player'
        ? `Kätesi on ${totalText(round.hands[round.active].cards)}. Jakajan kortti on ${cardValue(round.dealer[0])}.`
        : net > 0
          ? `Voitit ${money(net)}.`
          : net < 0
            ? `Hävisit ${money(-net)}.`
            : 'Kierros päättyi tasan.';

  return (
    <div className="table">
      <p className="sr-only" aria-live="polite">{status}</p>

      {coach && (
        <aside className="coach" aria-label="Opastus">
          {!round && (
            <p><strong>1/3 Panos.</strong> Tavoitteesi on päästä lähemmäs lukua 21 kuin jakaja menemättä yli. Kuvakortit ovat 10, ässä on 1 tai 11. Valitse panos pelimerkeillä ja paina Jaa kortit. Saldosi näkyy oikeassa yläkulmassa.</p>
          )}
          {round && round.phase !== 'result' && (
            <p><strong>2/3 Siirrot.</strong> Ota kortti lisää tai jää tähän. Tuplaus kaksinkertaistaa panoksen ja antaa yhden kortin. Parin voi jakaa kahdeksi kädeksi. Luovutus pelastaa puolet panoksesta. Tähti näyttää parhaan siirron.</p>
          )}
          {round && round.phase === 'result' && (
            <p><strong>3/3 Voitonmaksu.</strong> Voitto maksaa panoksen verran, blackjack maksaa 3:2 ja tasapeli palauttaa panoksen. Erikoiskädet ja bonuspelit maksavat tämän päälle. Kaikki kertoimet löydät Säännöt-sivulta.</p>
          )}
          <button className="btn ghost small" onClick={skipCoach}>Ohita opastus</button>
        </aside>
      )}

      <section className={round ? 'felt' : 'felt idle'} aria-label="Pelipöytä">
        <div className="rack" aria-hidden="true" />
        <div className="seat">
          <h2 className="seat-title">
            Jakaja
            {round && <span className="total">{round.dealerRevealed ? totalText(round.dealer) : cardValue(round.dealer[0])}</span>}
          </h2>
          <div className="cards">
            {round ? (
              round.dealer.map((c, i) => <CardView key={i} card={c} index={i} hidden={i === 1 && !round.dealerRevealed} />)
            ) : (
              <div className="card card-slot" aria-hidden="true" />
            )}
          </div>
        </div>

        <p className="felt-rule">Blackjack maksaa 3:2 · Jakaja jää 17:ään</p>

        <div className={`hands count-${Math.min(round?.hands.length ?? 1, 5)}`}>
          {round ? (
            round.hands.map((h, i) => (
              <HandView key={i} hand={h} index={i} many={round.hands.length > 1} active={round.phase === 'player' && i === round.active} />
            ))
          ) : (
            <div className="seat"><div className="cards"><div className="card card-slot" aria-hidden="true" /></div></div>
          )}
        </div>
        {(roundModName || mods) && <p className="mod-chip">Voimassa: {roundModName ?? mods?.name}</p>}
      </section>

      {!round && (
        <section className="controls" aria-label="Panostus">
          <div className="bet-row">
            <span className="bet-label">Panos / käsi</span>
            <span className="bet-value">{money(bet)}</span>
            <button className="btn ghost small" aria-expanded={showPaytables} aria-label="Sivupanosten kertoimet" onClick={() => setShowPaytables(!showPaytables)}>
              Kertoimet
            </button>
            <button className="btn ghost small" onClick={() => setBet(MIN_BET)}>Nollaa</button>
          </div>
          <div className="chips">
            {CHIPS.map((chip) => (
              <button key={chip} className="chip" disabled={(perHand + chip) * seats > profile.balance} onClick={() => setBet(bet + chip)} aria-label={`+${chip >= 1000 ? `${chip / 1000}k` : chip}, lisää panokseen ${money(chip)}`}>
                +{chip >= 1000 ? `${chip / 1000}k` : chip}
              </button>
            ))}
          </div>
          <div className="seats-row">
            <span className="bet-label" id="seats-label">Käsiä</span>
            <button className="btn small step" aria-label="Vähemmän käsiä" disabled={seats <= 1} onClick={() => setSeats(seats - 1)}>−</button>
            <output className="seats-value" aria-labelledby="seats-label">{seats}</output>
            <button className="btn small step" aria-label="Enemmän käsiä" disabled={seats >= MAX_HANDS} onClick={() => setSeats(seats + 1)}>+</button>
            <span className="stake-total">Yhteensä <b>{money(totalStake)}</b></span>
          </div>
          <div className="sides">
            <label className="check">
              <input type="checkbox" checked={pp} onChange={(e) => setPp(e.target.checked)} />
              <span>Perfect Pairs ({money(sideStake)})</span>
            </label>
            <label className="check">
              <input type="checkbox" checked={t3} onChange={(e) => setT3(e.target.checked)} />
              <span>21+3 ({money(sideStake)})</span>
            </label>
          </div>
          {showPaytables && (
            <div className="paytables">
              <div>
                <h3>Perfect Pairs</h3>
                <ul>{PERFECT_PAIRS_TABLE.map((r) => <li key={r.name}><span>{r.name}</span><b>{r.pays}:1</b></li>)}</ul>
              </div>
              <div>
                <h3>21+3</h3>
                <ul>{TWENTY_ONE_PLUS_THREE_TABLE.map((r) => <li key={r.name}><span>{r.name}</span><b>{r.pays}:1</b></li>)}</ul>
              </div>
            </div>
          )}
          {!canDeal && <p className="error" role="alert">Saldo ei riitä tähän panokseen.</p>}
          <button className="btn primary wide big" disabled={!canDeal} onClick={deal}>Jaa kortit</button>
        </section>
      )}

      {round && round.phase === 'insurance' && (
        <section className="controls" aria-label="Vakuutus">
          <p className="prompt">Jakajalla on ässä. Vakuutus maksaa {money(insuranceCost(round))} ja voittaa 2:1, jos jakajalla on blackjack.</p>
          {showHints && <p className="hint"><span aria-hidden="true">★ </span><strong>Paras siirto: Ei vakuutusta.</strong> {INSURANCE_ADVICE.reason}</p>}
          <div className="actions two">
            <button className={`btn action ${showHints ? 'best' : ''}`} onClick={() => onInsurance(false)}>{showHints && <span aria-hidden="true">★ </span>}Ei vakuutusta</button>
            <button className="btn action" disabled={!canAffordInsurance(round)} onClick={() => onInsurance(true)}>Ota vakuutus</button>
          </div>
        </section>
      )}

      {round && round.phase === 'player' && advice && (
        <section className="controls" aria-label="Siirrot">
          {showHints && (
            <p className="hint"><span aria-hidden="true">★ </span><strong>Paras siirto: {ACTION_NAMES[advice.action]}.</strong> {advice.reason}</p>
          )}
          <div className="actions">
            {ACTION_ORDER.map((a) => {
              const best = showHints && advice.action === a;
              return (
                <button key={a} className={`btn action ${best ? 'best' : ''} ${a === 'hit' || a === 'stand' ? 'main-action' : ''}`} disabled={!legal.includes(a)} onClick={() => onAction(a)}>
                  {best && <span aria-hidden="true">★ </span>}
                  {ACTION_NAMES[a]}
                  {best && <span className="sr-only"> (paras siirto)</span>}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {round && round.phase === 'result' && (
        <section className="controls result" aria-label="Kierroksen tulos">
          <p className={`result-line ${net > 0 ? 'won' : net < 0 ? 'lost' : ''}`}>
            {net > 0 ? `Voitit ${money(net)}` : net < 0 ? `Hävisit ${money(-net)}` : 'Tasapeli, panos palautuu'}
          </p>
          <ul className="result-details">
            {round.bonusWins.map((w, i) => <li key={`b${i}`}>{w.name}: {w.multiplier} × panos = {money(w.amount)}</li>)}
            {round.sideWins.map((w, i) => <li key={`s${i}`}>{w.name} {w.multiplier}:1 = {money(w.amount)}</li>)}
            {round.insurance > 0 && <li>{round.insuranceWon ? `Vakuutus voitti ${money(round.insurance * 2)}` : `Vakuutus hävisi ${money(round.insurance)}`}</li>}
            {round.hands.some((h) => h.shielded) && <li>Sheriffin suojelus palautti hävityn panoksen.</li>}
          </ul>
          {decisions.length > 0 && (
            <p className="feedback">
              {wrong.length === 0
                ? decisions.length === 1
                  ? 'Siirtosi oli perusstrategian mukainen.'
                  : `Kaikki ${decisions.length} siirtoasi olivat perusstrategian mukaisia.`
                : `${decisions.length - wrong.length}/${decisions.length} siirtoa oikein. Valitsit: ${wrong[0].chosen}. Paras siirto olisi ollut: ${wrong[0].best}.`}
            </p>
          )}
          {pendingBonus !== null ? (
            <button className="btn primary wide big" onClick={() => setOverlay({ kind: 'bonus', bet: pendingBonus })}>Blackjack avasi bonuspelin</button>
          ) : (
            <button className="btn primary wide big" onClick={nextRound}>Uusi kierros</button>
          )}
        </section>
      )}

      {overlay?.kind === 'celebrate' && (
        <Modal title={overlay.wins.length === 1 ? `${overlay.wins[0].name}!` : 'Erikoiskädet!'} className="celebrate">
          <div className="burst" aria-hidden="true" />
          {overlay.wins.map((w, i) => (
            <p key={i} className="celebrate-line">
              {overlay.wins.length > 1 && <span>{w.name}: </span>}
              <b>{w.multiplier} × panos</b>
              <span className="celebrate-amount">{money(w.amount)}</span>
            </p>
          ))}
          <button className="btn primary wide" data-autofocus onClick={() => setOverlay(null)}>Jatka peliä</button>
        </Modal>
      )}

      {overlay?.kind === 'event' && (
        <Modal title={overlay.event.name} className="event">
          <p>{overlay.event.desc}</p>
          <button className="btn primary wide" data-autofocus onClick={() => acceptEvent(overlay.event)}>
            {overlay.event.id === 'back-room' ? 'Astu takahuoneeseen' : 'Selvä'}
          </button>
        </Modal>
      )}

      {overlay?.kind === 'bonus' && <BonusGame bet={overlay.bet} onDone={finishBonus} />}
    </div>
  );
}

function HandView({ hand, index, many, active }: { hand: Hand; index: number; many: boolean; active: boolean }) {
  return (
    <div className={`seat hand ${active ? 'active' : ''}`} aria-current={active ? 'true' : undefined}>
      <h2 className="seat-title">
        {many ? `Käsi ${index + 1}` : 'Sinä'}
        <span className="total">{totalText(hand.cards)}</span>
        {active && many && <span className="turn">vuorossa</span>}
      </h2>
      <div className="cards">
        {hand.cards.map((c, i) => <CardView key={i} card={c} index={i} />)}
      </div>
      <p className="hand-bet">
        {money(hand.bet)}
        {hand.extra > 0 && ' + talon tupla'}
        {hand.outcome && <span className={`badge ${hand.outcome}`}>{OUTCOME_LABELS[hand.outcome]}</span>}
      </p>
    </div>
  );
}

const prizeLabel = (p: Prize) => (p === 'mine' ? 'Kaivoksen avain' : p === 'jackpot' ? 'PÄÄVOITTO' : `${p} ×`);

function BonusGame({ bet, onDone }: { bet: number; onDone: (r: { amount: number; enteredMine: boolean; jackpot: boolean }) => void }) {
  const barrels = useMemo(() => makeBarrels(Math.random), []);
  const carts = useMemo(() => makeCarts(Math.random), []);
  const [stage, setStage] = useState<'barrels' | 'mine'>('barrels');
  const [barrel, setBarrel] = useState<number | null>(null);
  const [cart, setCart] = useState<number | null>(null);

  const inMine = stage === 'mine';
  const prizes = inMine ? carts : barrels;
  const picked = inMine ? cart : barrel;
  const prize = picked === null ? null : prizes[picked];
  const foundMine = !inMine && prize === 'mine';

  return (
    <Modal title={inMine ? 'Kultakaivos' : 'Bonuspeli: saluunan kellari'} className={`bonus ${inMine ? 'mine' : ''}`}>
      <p>
        {inMine
          ? `Bonuspelin bonuspeli. Valitse yksi kaivosvaunu. Yhdessä niistä on päävoitto: tuhat blackjack-voittoa eli ${money(prizeAmount('jackpot', bet))}.`
          : `Valitse yksi viskitynnyri. Palkinnot lasketaan panoksesta ${money(bet)}. Yhdessä tynnyrissä on kultakaivoksen avain.`}
      </p>
      <div className={`picks ${inMine ? 'carts' : 'barrels'}`}>
        {prizes.map((p, i) => (
          <button
            key={`${stage}${i}`}
            className={`pick ${picked === i ? 'chosen' : ''} ${picked !== null ? 'open' : ''}`}
            disabled={picked !== null}
            data-autofocus={i === 0 ? true : undefined}
            onClick={() => (inMine ? setCart(i) : setBarrel(i))}
            aria-label={picked === null ? `${inMine ? 'Vaunu' : 'Tynnyri'} ${i + 1}` : `${inMine ? 'Vaunu' : 'Tynnyri'} ${i + 1}: ${prizeLabel(p)}${picked === i ? ', valintasi' : ''}`}
          >
            {picked === null ? i + 1 : prizeLabel(p)}
          </button>
        ))}
      </div>
      <div aria-live="polite">
        {prize !== null && foundMine && <p className="bonus-result">Löysit kultakaivoksen avaimen!</p>}
        {prize !== null && !foundMine && (
          <p className="bonus-result">
            {prize === 'jackpot' ? 'Emäsuoni! Päävoitto on sinun: ' : `${prizeLabel(prize)} panos: `}
            <b>{money(prizeAmount(prize, bet))}</b>
          </p>
        )}
      </div>
      {prize !== null && foundMine && <button className="btn primary wide" onClick={() => setStage('mine')}>Laskeudu kaivokseen</button>}
      {prize !== null && !foundMine && (
        <button className="btn primary wide" onClick={() => onDone({ amount: prizeAmount(prize, bet), enteredMine: inMine, jackpot: prize === 'jackpot' })}>
          Kerää voitto
        </button>
      )}
    </Modal>
  );
}
