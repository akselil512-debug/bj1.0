import { useEffect, useRef, useState } from 'react';
import { applyRoulette, Profile, Update } from '../game/progress';
import {
  BetKey, Bets, COLOR_LABELS, colorOf, OUTSIDE_LABELS, OutsideBet, settle, SpinResult, spinNumber, straight, totalStake,
} from '../game/roulette';
import { money } from './common';

const ROWS = [0, 1, 2].map((row) => Array.from({ length: 12 }, (_, col) => col * 3 + 3 - row));
const DOZENS: OutsideBet[] = ['d1', 'd2', 'd3'];
const EVEN_MONEY: OutsideBet[] = ['low', 'even', 'red', 'black', 'odd', 'high'];
const CHIPS = [100, 500, 1000, 5000];
const SPIN_MS = 2600;

const short = (v: number) => (v >= 1000 ? `${String(v / 1000).replace('.', ',')}k` : `${v}`);
const prefersStill = () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function Roulette({ profile, onUpdate }: { profile: Profile; onUpdate: (u: Update) => void }) {
  const [bets, setBets] = useState<Bets>({});
  const [chip, setChip] = useState(500);
  const [spinning, setSpinning] = useState(false);
  const [turns, setTurns] = useState(0);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const [message, setMessage] = useState('');
  const latest = useRef(profile);
  latest.current = profile;
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const stake = totalStake(bets);
  const still = profile.settings.calm || prefersStill();

  const place = (key: BetKey) => {
    if (spinning) return;
    if (stake + chip > profile.balance) return setMessage('Saldo ei riitä tähän panokseen.');
    setMessage('');
    setResult(null);
    setBets({ ...bets, [key]: (bets[key] ?? 0) + chip });
  };

  const spin = () => {
    if (spinning || stake === 0 || stake > profile.balance) return;
    const outcome = settle(bets, spinNumber(Math.random));
    setSpinning(true);
    setResult(null);
    setTurns((t) => t + 4);
    timer.current = setTimeout(
      () => {
        onUpdate(applyRoulette(latest.current, outcome, Date.now()));
        setResult(outcome);
        setHistory((h) => [outcome.number, ...h].slice(0, 6));
        setSpinning(false);
        if (outcome.stake > latest.current.balance + outcome.net) setBets({});
      },
      still ? 0 : SPIN_MS,
    );
  };

  const chipMark = (key: BetKey) =>
    bets[key] ? (
      <span className="bet-chip">
        {short(bets[key]!)}
        <span className="sr-only"> $ panos</span>
      </span>
    ) : null;

  return (
    <div className="table roulette">
      <section className="felt wheel-area" aria-label="Rulettipyörä">
        <div className="r-wheel" aria-hidden="true">
          <div className="r-pockets" style={{ transform: `rotate(${turns * 360 + (result ? result.number * 9.73 : 0)}deg)`, transitionDuration: still ? '0s' : `${SPIN_MS}ms` }} />
          <div className="r-bowl" />
          <div className={`r-hub ${result ? colorOf(result.number) : ''}`}>{result ? result.number : spinning ? '' : '?'}</div>
        </div>
        <div className="r-info" aria-live="polite">
          {spinning && <p className="r-status">Kuula pyörii…</p>}
          {!spinning && !result && <p className="r-status">Aseta panokset ja pyöräytä.</p>}
          {!spinning && result && (
            <>
              <p className="r-number">
                {result.number} <span>{COLOR_LABELS[colorOf(result.number)]}</span>
              </p>
              <p className={`result-line ${result.net > 0 ? 'won' : result.net < 0 ? 'lost' : ''}`}>
                {result.net > 0 ? `Voitit ${money(result.net)}` : result.net < 0 ? `Hävisit ${money(-result.net)}` : 'Omillesi'}
              </p>
            </>
          )}
          {history.length > 0 && (
            <ol className="r-history" aria-label="Viimeisimmät numerot">
              {history.map((n, i) => (
                <li key={i} className={`r-pill ${colorOf(n)}`}>
                  {n}
                  <span className="sr-only"> {COLOR_LABELS[colorOf(n)]}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>

      <section className="controls" aria-label="Panostusalue">
        <div className="bet-row">
          <span className="bet-label">Panokset yhteensä</span>
          <span className="bet-value">{money(stake)}</span>
          <span className="note">Vieritä pöytää sivulle</span>
        </div>

        <div className="r-scroll" tabIndex={0} role="group" aria-label="Rulettipöytä, vieritettävä">
          <div className="r-grid">
            <button className="r-cell green zero" disabled={spinning} onClick={() => place(straight(0))}>
              0<span className="sr-only"> vihreä</span>
              {chipMark(straight(0))}
            </button>
            {ROWS.flat().map((n) => (
              <button key={n} className={`r-cell ${colorOf(n)}`} disabled={spinning} onClick={() => place(straight(n))}>
                {n}
                <span className="sr-only"> {COLOR_LABELS[colorOf(n)]}</span>
                {chipMark(straight(n))}
              </button>
            ))}
            {DOZENS.map((key, i) => (
              <button key={key} className="r-cell outside" style={{ gridColumn: `${2 + i * 4} / span 4`, gridRow: 4 }} disabled={spinning} onClick={() => place(key)}>
                {OUTSIDE_LABELS[key]}
                {chipMark(key)}
              </button>
            ))}
            {EVEN_MONEY.map((key, i) => (
              <button key={key} className={`r-cell outside ${key === 'red' ? 'red' : key === 'black' ? 'black' : ''}`} style={{ gridColumn: `${2 + i * 2} / span 2`, gridRow: 5 }} disabled={spinning} onClick={() => place(key)}>
                {OUTSIDE_LABELS[key]}
                {chipMark(key)}
              </button>
            ))}
          </div>
        </div>

        <div className="r-chips" role="group" aria-label="Pelimerkin arvo">
          {CHIPS.map((value) => (
            <button key={value} className={`chip ${chip === value ? 'selected' : ''}`} aria-pressed={chip === value} onClick={() => setChip(value)}>
              {short(value)}
              <span className="sr-only"> $</span>
            </button>
          ))}
          <span className="note r-pay">Numero 35:1 · tusina 2:1 · muut 1:1</span>
        </div>

        {message && <p className="error" role="alert">{message}</p>}
        {stake > profile.balance && <p className="error" role="alert">Saldo ei riitä näihin panoksiin.</p>}

        <div className="actions two r-actions">
          <button className="btn action" disabled={spinning || stake === 0} onClick={() => { setBets({}); setResult(null); setMessage(''); }}>Tyhjennä</button>
          <button className="btn primary big" disabled={spinning || stake === 0 || stake > profile.balance} onClick={spin}>Pyöräytä</button>
        </div>
      </section>
    </div>
  );
}
