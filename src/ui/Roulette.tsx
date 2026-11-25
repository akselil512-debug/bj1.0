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
const SPIN_MS = 4600;
const STEP = 360 / POCKETS;
const POCKET_FILL = { red: 'oklch(0.5 0.19 27)', black: 'oklch(0.16 0.02 60)', green: 'oklch(0.4 0.12 150)' };

/** A ring segment centred on the top and `STEP` degrees wide, between two radii. */
function wedge(outer: number, inner: number): string {
  const point = (r: number, deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return `${(r * Math.cos(rad)).toFixed(2)} ${(r * Math.sin(rad)).toFixed(2)}`;
  };
  const half = STEP / 2;
  return `M ${point(outer, -half)} A ${outer} ${outer} 0 0 1 ${point(outer, half)} L ${point(inner, half)} A ${inner} ${inner} 0 0 0 ${point(inner, -half)} Z`;
}
const NUMBER_WEDGE = wedge(86, 67);
const POCKET_WEDGE = wedge(67, 52);
const WIN_WEDGE = wedge(86, 52);
const POCKET_SHADE = { red: 'oklch(0.4 0.16 27)', black: 'oklch(0.11 0.01 60)', green: 'oklch(0.32 0.1 150)' };

const short = (v: number) => (v >= 1000 ? `${String(v / 1000).replace('.', ',')}k` : `${v}`);
const prefersStill = () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function Roulette({ profile, onUpdate }: { profile: Profile; onUpdate: (u: Update) => void }) {
  const [bets, setBets] = useState<Bets>({});
  const [chip, setChip] = useState(500);
  const [spinning, setSpinning] = useState(false);
  const [rot, setRot] = useState(0);
  const [ballRot, setBallRot] = useState(0);
  const [ballIn, setBallIn] = useState(false);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const [message, setMessage] = useState('');
  const latest = useRef(profile);
  latest.current = profile;
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const dropTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => { clearTimeout(timer.current); clearTimeout(dropTimer.current); }, []);

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
    // The wheel turns clockwise and the ball runs the other way, then drops into the winning pocket.
    const wheelTo = Math.ceil(rot / 360) * 360 + 720 + Math.floor(Math.random() * 360);
    const pocketAt = wheelTo + WHEEL_ORDER.indexOf(outcome.number) * STEP;
    const ballTo = pocketAt - 360 * Math.ceil((pocketAt - (ballRot - 1440)) / 360);
    setRot(wheelTo);
    setBallRot(ballTo);
    setBallIn(still);
    if (!still) dropTimer.current = setTimeout(() => setBallIn(true), 300);
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
          <svg className="r-static" viewBox="-100 -100 200 200">
            <defs>
              <radialGradient id="r-wood" cx="35%" cy="30%" r="80%">
                <stop offset="0" stopColor="oklch(0.5 0.1 55)" />
                <stop offset="0.55" stopColor="oklch(0.33 0.08 45)" />
                <stop offset="1" stopColor="oklch(0.18 0.04 40)" />
              </radialGradient>
              <linearGradient id="r-brass" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="oklch(0.97 0.05 95)" />
                <stop offset="0.4" stopColor="oklch(0.78 0.13 85)" />
                <stop offset="0.6" stopColor="oklch(0.55 0.11 75)" />
                <stop offset="1" stopColor="oklch(0.88 0.1 90)" />
              </linearGradient>
              <radialGradient id="r-track" cx="50%" cy="50%" r="50%">
                <stop offset="0.86" stopColor="oklch(0.2 0.04 45)" />
                <stop offset="0.93" stopColor="oklch(0.42 0.09 55)" />
                <stop offset="1" stopColor="oklch(0.26 0.06 45)" />
              </radialGradient>
              <radialGradient id="r-cone" cx="50%" cy="50%" r="50%">
                <stop offset="0" stopColor="oklch(0.56 0.11 60)" />
                <stop offset="0.7" stopColor="oklch(0.38 0.09 50)" />
                <stop offset="1" stopColor="oklch(0.24 0.06 45)" />
              </radialGradient>
            </defs>
            <circle r="100" fill="url(#r-wood)" />
            <circle r="97.5" fill="none" stroke="url(#r-brass)" strokeWidth="1.2" />
            <circle r="93" fill="url(#r-track)" />
            <circle r="86.6" fill="none" stroke="url(#r-brass)" strokeWidth="1.2" />
            {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
              <rect key={deg} x="-1.6" y="-92" width="3.2" height="5" rx="1.2" fill="url(#r-brass)" transform={`rotate(${deg + 22})`} />
            ))}
          </svg>

          <svg className="r-rotor" viewBox="-100 -100 200 200" style={{ transform: `rotate(${rot}deg)`, transitionDuration: still ? '0s' : `${SPIN_MS}ms` }}>
            {WHEEL_ORDER.map((n, i) => (
              <g key={n} transform={`rotate(${(i * STEP).toFixed(3)})`}>
                <path d={NUMBER_WEDGE} fill={POCKET_FILL[colorOf(n)]} />
                <path d={POCKET_WEDGE} fill={POCKET_SHADE[colorOf(n)]} />
                <text y="-73" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="white" fontFamily="Georgia, 'Times New Roman', serif">{n}</text>
                <line x1="0" y1="-86" x2="0" y2="-52" stroke="url(#r-brass)" strokeWidth="0.9" transform={`rotate(${(STEP / 2).toFixed(3)})`} />
                {result && !spinning && result.number === n && <path d={WIN_WEDGE} fill="none" stroke="oklch(0.95 0.12 95)" strokeWidth="1.8" />}
              </g>
            ))}
            <circle r="67" fill="none" stroke="url(#r-brass)" strokeWidth="0.9" />
            <circle r="52" fill="url(#r-cone)" stroke="url(#r-brass)" strokeWidth="1.4" />
            <circle r="30" fill="none" stroke="oklch(0.2 0.04 45 / 0.5)" strokeWidth="0.6" />
            {[0, 90, 180, 270].map((deg) => (
              <g key={deg} transform={`rotate(${deg})`}>
                <rect x="-1.5" y="-36" width="3" height="30" rx="1.5" fill="url(#r-brass)" />
                <circle cy="-37" r="4.2" fill="url(#r-brass)" stroke="oklch(0.34 0.07 70)" strokeWidth="0.5" />
              </g>
            ))}
            <circle r="13" fill="url(#r-brass)" stroke="oklch(0.34 0.07 70)" strokeWidth="0.8" />
            <circle r="6" fill="oklch(0.9 0.08 92)" stroke="oklch(0.45 0.09 72)" strokeWidth="0.8" />
          </svg>

          <div className="r-orbit" style={{ transform: `rotate(${ballRot}deg)`, transitionDuration: still ? '0s' : `${SPIN_MS}ms` }}>
            <div className={ballIn ? 'r-ball in' : 'r-ball'} />
          </div>
          <div className="r-gloss" />
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
