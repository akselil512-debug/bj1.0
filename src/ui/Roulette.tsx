import { useEffect, useRef, useState } from 'react';
import { applyRoulette, Profile, Update } from '../game/progress';
import {
  BetKey, Bets, COLOR_LABELS, colorOf, OUTSIDE_LABELS, OutsideBet, POCKETS, settle, SpinResult, spinNumber, straight, totalStake, WHEEL_ORDER,
} from '../game/roulette';
import { money } from './common';

const ROWS = [0, 1, 2].map((row) => Array.from({ length: 12 }, (_, col) => col * 3 + 3 - row));
const DOZENS: OutsideBet[] = ['d1', 'd2', 'd3'];
const EVEN_MONEY: OutsideBet[] = ['low', 'even', 'red', 'black', 'odd', 'high'];
const CHIPS = [100, 500, 1000, 5000];
const SPIN_MS = 3600;
const STEP = 360 / POCKETS;
const POCKET_FILL = { red: 'oklch(0.5 0.19 27)', black: 'oklch(0.16 0.02 60)', green: 'oklch(0.4 0.12 150)' };

/** A ring segment of the wheel, centred on the top and `STEP` degrees wide. */
const WEDGE = (() => {
  const point = (r: number, deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return `${(r * Math.cos(rad)).toFixed(2)} ${(r * Math.sin(rad)).toFixed(2)}`;
  };
  const half = STEP / 2;
  return `M ${point(96, -half)} A 96 96 0 0 1 ${point(96, half)} L ${point(64, half)} A 64 64 0 0 0 ${point(64, -half)} Z`;
})();

const short = (v: number) => (v >= 1000 ? `${String(v / 1000).replace('.', ',')}k` : `${v}`);
const prefersStill = () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function Roulette({ profile, onUpdate }: { profile: Profile; onUpdate: (u: Update) => void }) {
  const [bets, setBets] = useState<Bets>({});
  const [chip, setChip] = useState(500);
  const [spinning, setSpinning] = useState(false);
  const [rot, setRot] = useState(0);
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
    // Four full turns, then stop with the winning pocket under the ball at the top.
    setRot((r) => Math.ceil(r / 360) * 360 + 1440 - WHEEL_ORDER.indexOf(outcome.number) * STEP);
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
          <svg className="r-pockets" viewBox="-100 -100 200 200" style={{ transform: `rotate(${rot}deg)`, transitionDuration: still ? '0s' : `${SPIN_MS}ms` }}>
            {WHEEL_ORDER.map((n, i) => (
              <g key={n} transform={`rotate(${(i * STEP).toFixed(3)})`}>
                <path d={WEDGE} fill={POCKET_FILL[colorOf(n)]} stroke="oklch(0.82 0.14 85)" strokeWidth="0.6" />
                <text y="-77" textAnchor="middle" fontSize="10.5" fontWeight="700" fill="white">{n}</text>
              </g>
            ))}
            <circle r="64" fill="oklch(0.24 0.04 55)" stroke="oklch(0.68 0.14 75)" strokeWidth="2" />
            <path d="M0 -60 V60 M-60 0 H60 M-42 -42 L42 42 M42 -42 L-42 42" stroke="oklch(0.68 0.14 75)" strokeWidth="1.5" />
          </svg>
          <div className="r-ball" />
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
