import { canSpin, dayKey } from '../game/daily';
import { Profile } from '../game/progress';
import type { Screen } from './App';

export function Lobby({ profile, go }: { profile: Profile; go: (s: Screen) => void }) {
  const wheelReady = canSpin(profile.daily, dayKey(new Date()));

  return (
    <div className="page lobby">
      <div className="lights" aria-hidden="true" />

      <section className="hero">
        <div className="hero-felt" aria-hidden="true" />
        <div className="hero-cards" aria-hidden="true">
          <span className="hero-card">K<small>♠</small></span>
          <span className="hero-card">A<small>♣</small></span>
        </div>
        <div className="hero-text">
          <span className="eyebrow">Blackjack · 1–5 kättä</span>
          <h1>Jakaja odottaa pöydässä</h1>
          <span className="note">Panokset 100 $ alkaen</span>
          <button className="btn primary" onClick={() => go('table')}>Istu pöytään</button>
        </div>
      </section>

      <div className="tiles">
        <section className="panel tile">
          <div className="mini-roulette" aria-hidden="true" />
          <h2>Ruletti</h2>
          <span className="note">Eurooppalainen, 0–36</span>
          <button className="btn wide" onClick={() => go('roulette')}>Pelaa rulettia</button>
        </section>
        <section className="panel tile">
          <div className="mini-wheel" aria-hidden="true" />
          <h2>Päivän pyörä</h2>
          <span className="note">{wheelReady ? 'Ilmainen pyöräytys valmiina' : 'Pyöräytetty tänään'}</span>
          <button className="btn wide" onClick={() => go('wheel')}>{wheelReady ? 'Pyöräytä pyörää' : 'Katso putki'}</button>
        </section>
      </div>

      <section className="panel soon">
        <h2>Tulossa</h2>
        <p className="note">Moninpelipöydät, tulostaulu ja live-jakaja ovat suunnitteilla. Ne vaativat palvelimen, jota pelissä ei vielä ole.</p>
      </section>
    </div>
  );
}
