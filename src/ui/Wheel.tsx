import { useEffect, useRef, useState } from 'react';
import { canSpin, dayKey, spinWheel, STREAK_BONUS, streakDay, STREAK_LENGTH, WHEEL_PRIZES, WheelResult } from '../game/daily';
import { applyDaily, Profile, Update } from '../game/progress';
import { money } from './common';

const SPIN_MS = 4000;
const prefersStill = () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function Wheel({ profile, onUpdate }: { profile: Profile; onUpdate: (u: Update) => void }) {
  const today = dayKey(new Date());
  const [rot, setRot] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<WheelResult | null>(null);
  const latest = useRef(profile);
  latest.current = profile;
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const still = profile.settings.calm || prefersStill();
  const ready = canSpin(profile.daily, today);
  const day = streakDay(profile.daily, today);

  const spin = () => {
    if (!ready || spinning) return;
    const outcome = spinWheel(profile.daily, today, Math.random);
    setSpinning(true);
    setRot(1800 + 360 - outcome.index * 45);
    timer.current = setTimeout(
      () => {
        onUpdate(applyDaily(latest.current, outcome, Date.now()));
        setResult(outcome);
        setSpinning(false);
      },
      still ? 0 : SPIN_MS,
    );
  };

  return (
    <div className="page wheel-page">
      <section className="wheel-card" aria-label="Onnenpyörä">
        <h1>Päivän pyörä</h1>
        <p className="note">Yksi ilmainen pyöräytys joka päivä</p>

        <div className="d-wheel">
          <div className="d-rim" aria-hidden="true" />
          <ul className="d-disc" aria-label="Pyörän palkinnot" style={{ transform: `rotate(${rot}deg)`, transitionDuration: still ? '0s' : `${SPIN_MS}ms` }}>
            {WHEEL_PRIZES.map((prize, i) => (
              <li key={i} className={i === WHEEL_PRIZES.length - 1 ? 'top-prize' : ''} style={{ transform: `rotate(${i * 45}deg) translateY(-102px)` }}>
                {money(prize)}
              </li>
            ))}
          </ul>
          <div className="d-hub" aria-hidden="true">21</div>
          <div className="d-pointer" aria-hidden="true" />
        </div>

        <div className="d-result" aria-live="polite">
          {result ? (
            <>
              <p className="d-win">Voitit {money(result.total)}</p>
              <p className="note">
                Pyörä {money(result.prize)}
                {result.doubled && ' tuplana'}
                {result.bonus > 0 && ` · putkibonus ${money(result.bonus)}`}
              </p>
            </>
          ) : (
            <p className="note">{spinning ? 'Pyörä pyörii…' : 'Voitot ovat pelirahaa ja menevät suoraan saldoosi.'}</p>
          )}
        </div>

        {ready && !result ? (
          <button className="btn primary big wide" disabled={spinning} onClick={spin}>Pyöräytä</button>
        ) : (
          <button className="btn wide" disabled>Seuraava pyöräytys huomenna</button>
        )}
      </section>

      <section className="panel">
        <div className="streak-head">
          <h2>Päiväputki</h2>
          <span>{ready && !result ? `Tänään päivä ${day}` : day === 1 ? '1 päivä putkeen' : `${day} päivää putkeen`}</span>
        </div>
        <ol className="streak">
          {STREAK_BONUS.map((bonus, i) => {
            const n = i + 1;
            const claimed = n < day || (n === day && (!ready || !!result));
            const current = n === day && !claimed;
            return (
              <li key={n} className={claimed ? 'claimed' : current ? 'current' : ''}>
                <span className="streak-day">{n === day ? 'Tänään' : `Pv ${n}`}</span>
                <span className="streak-dot" aria-hidden="true">{claimed ? '✓' : n === STREAK_LENGTH ? '★' : ''}</span>
                <span className="streak-bonus">
                  {n === STREAK_LENGTH ? 'Tupla' : `+${bonus.toLocaleString('fi-FI')}`}
                  <span className="sr-only">{claimed ? ', lunastettu' : ''}</span>
                </span>
              </li>
            );
          })}
        </ol>
        <p className="note">Seitsemäntenä päivänä pyörän palkinto maksetaan tuplana. Jos päivä jää väliin, putki alkaa alusta.</p>
      </section>
    </div>
  );
}
