import { useState } from 'react';
import { accuracy, ACHIEVEMENTS, levelFor, Profile, TITLE_LADDER, titleFor, xpForLevel } from '../game/progress';
import { exportCode } from '../game/storage';
import { PERFECT_PAIRS_TABLE, SPECIALS, TWENTY_ONE_PLUS_THREE_TABLE } from '../game/bonuses';
import { BARREL_PRIZES, CART_PRIZES, EVENT_CHANCE, eventProbability, EVENTS, JACKPOT_MULTIPLIER } from '../game/extras';
import { DECKS } from '../game/cards';
import { STREAK_BONUS, WHEEL_PRIZES } from '../game/daily';
import sim from '../game/sim-results.json';
import { money, percent } from './common';

export function ProfileScreen({ profile }: { profile: Profile }) {
  const s = profile.stats;
  const level = levelFor(profile.xp);
  const from = xpForLevel(level);
  const to = xpForLevel(level + 1);
  const acc = accuracy(s);
  const unlocked = ACHIEVEMENTS.filter((a) => profile.achievements[a.id]);
  const nextTitle = TITLE_LADDER.find(([min]) => min > level);

  const stats: [string, string][] = [
    ['Pelatut kädet', s.hands.toLocaleString('fi-FI')],
    ['Voitetut kädet', s.hands ? percent(s.wins / s.hands) : 'ei vielä'],
    ['Oikeat siirrot', acc === null ? 'ei vielä' : `${percent(acc)} (${s.correct}/${s.decisions})`],
    ['Paras oikeiden siirtojen putki', `${s.bestCorrectStreak}`],
    ['Paras voittoputki', `${s.bestWinStreak} kierrosta`],
    ['Blackjackit', `${s.blackjacks}`],
    ['Suurin voitto', money(s.biggestWin)],
    ['Suurin saldo', money(s.peakBalance)],
    ['Bonuspelit', `${s.bonusGames}`],
  ];

  return (
    <div className="page">
      <section className="panel">
        <h2>{profile.name}</h2>
        <p className="level-line">Taso {level} · {titleFor(level)}</p>
        <div className="xp-bar" role="progressbar" aria-label="Kokemus seuraavaan tasoon" aria-valuemin={from} aria-valuemax={to} aria-valuenow={profile.xp}>
          <div style={{ width: `${Math.min(100, ((profile.xp - from) / (to - from)) * 100)}%` }} />
        </div>
        <p className="note">
          {profile.xp - from} / {to - from} kokemusta seuraavaan tasoon.
          {nextTitle && ` Seuraava arvonimi: ${nextTitle[1]} tasolla ${nextTitle[0]}.`}
        </p>
        <p className="note">Kokemusta kertyy pelatuista käsistä, voitoista ja oikeista siirroista. Saldo ei vaikuta tasoon.</p>
      </section>

      <section className="panel">
        <h2>Ennätykset</h2>
        <dl className="stats">
          {stats.map(([k, v]) => (
            <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
          ))}
        </dl>
      </section>

      <section className="panel">
        <h2>Saavutukset {unlocked.length}/{ACHIEVEMENTS.length}</h2>
        <ul className="achievements">
          {ACHIEVEMENTS.map((a) => {
            const done = !!profile.achievements[a.id];
            return (
              <li key={a.id} className={done ? 'done' : ''}>
                <span className="mark" aria-hidden="true">{done ? '★' : '☆'}</span>
                <span>
                  <strong>{a.name}</strong>
                  <span className="sr-only">{done ? ' (avattu)' : ' (lukittu)'}</span>
                  <br />
                  {a.desc}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

const signed = (x: number, digits = 1) => `${x > 0 ? '+' : ''}${percent(x, digits)}`;

export function RulesScreen() {
  return (
    <div className="page">
      <section className="panel">
        <h2>Pelin säännöt</h2>
        <ul className="rules">
          <li>Tavoite on päästä lähemmäs lukua 21 kuin jakaja menemättä yli.</li>
          <li>Numerokortit ovat arvonsa verran, kuvakortit 10 ja ässä 1 tai 11.</li>
          <li>Peli käyttää {DECKS} pakkaa.</li>
          <li>Blackjack eli ässä ja kymppikortti aloituskätenä maksaa 3:2.</li>
          <li>Tasapelissä saat panoksesi takaisin.</li>
          <li>Jakaja ottaa kortin 16:een asti ja jää 17:ään.</li>
          <li>Tuplata saa millä tahansa kahdella kortilla, myös jaon jälkeen.</li>
          <li>Parin saa jakaa, ja jakamista saa jatkaa niin kauan kuin pareja tulee ja saldo riittää.</li>
          <li>Vakuutusta tarjotaan, kun jakajalla on ässä. Se maksaa puolet panoksesta jokaiselta kädeltä ja voittaa 2:1.</li>
          <li>Luovutus kahdella ensimmäisellä kortilla palauttaa puolet panoksesta.</li>
          <li>Voit pelata yhdestä viiteen kättä kerralla. Jokaisella kädellä on oma panos, omat sivupanokset ja omat bonukset.</li>
          <li>Minimipanos on 100 $. Kun saldo loppuu, talo täyttää sen ilmaiseksi.</li>
        </ul>
      </section>

      <section className="panel">
        <h2>Erikoiskädet</h2>
        <p className="note">Maksetaan pääpanoksesta automaattisesti, ilman erillistä panosta.</p>
        <table>
          <thead><tr><th>Käsi</th><th>Voitto</th></tr></thead>
          <tbody>
            {SPECIALS.map((s) => (
              <tr key={s.id}><td><strong>{s.name}</strong><br />{s.desc}</td><td>{s.multiplier} × panos</td></tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <h2>Sivupanokset</h2>
        <p className="note">Sivupanos on kymmenesosa pääpanoksesta. Se asetetaan ennen jakoa ja ratkeaa ensimmäisistä korteista.</p>
        <h3>Perfect Pairs (kaksi ensimmäistä korttiasi)</h3>
        <table><tbody>{PERFECT_PAIRS_TABLE.map((r) => <tr key={r.name}><td>{r.name}</td><td>{r.pays}:1</td></tr>)}</tbody></table>
        <h3>21+3 (kaksi korttiasi ja jakajan kortti)</h3>
        <table><tbody>{TWENTY_ONE_PLUS_THREE_TABLE.map((r) => <tr key={r.name}><td>{r.name}</td><td>{r.pays}:1</td></tr>)}</tbody></table>
      </section>

      <section className="panel">
        <h2>Tapahtumat</h2>
        <p className="note">Kierrosten välissä voi tulla tapahtuma. Todennäköisyys on {percent(EVENT_CHANCE)} jokaisen kierroksen jälkeen.</p>
        <table>
          <thead><tr><th>Tapahtuma</th><th>Todennäköisyys</th></tr></thead>
          <tbody>
            {EVENTS.map((e) => (
              <tr key={e.id}><td><strong>{e.name}</strong><br />{e.desc}</td><td>{percent(eventProbability(e), 1)}</td></tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <h2>Bonuspelit</h2>
        <ul className="rules">
          <li>Bonuspeli aukeaa jokaisesta blackjackistasi ja Kutsu takahuoneeseen -tapahtumasta.</li>
          <li>Saluunan kellarissa on {BARREL_PRIZES.length} tynnyriä: {BARREL_PRIZES.filter((p) => typeof p === 'number').join(' ×, ')} × panos ja kultakaivoksen avain.</li>
          <li>Kultakaivos on bonuspelin bonuspeli. Siellä on {CART_PRIZES.length} vaunua: voitot 5–50 × panos ja yksi päävoitto.</li>
          <li>Päävoitto on tuhat blackjack-voittoa eli {JACKPOT_MULTIPLIER} × panos.</li>
        </ul>
      </section>

      <section className="panel">
        <h2>Ruletti</h2>
        <ul className="rules">
          <li>Eurooppalainen ruletti: numerot 0–36 ja yksi nolla.</li>
          <li>Yhden numeron panos maksaa 35:1.</li>
          <li>Tusinat 1–12, 13–24 ja 25–36 maksavat 2:1.</li>
          <li>Punainen, musta, parillinen, pariton, 1–18 ja 19–36 maksavat 1:1.</li>
          <li>Nolla häviää kaikki muut panokset paitsi panoksen nollalle.</li>
          <li>Talon etu on jokaisessa panoksessa sama, 1/37 eli noin 2,7 %.</li>
        </ul>
      </section>

      <section className="panel">
        <h2>Päivän pyörä</h2>
        <ul className="rules">
          <li>Yksi ilmainen pyöräytys joka päivä. Palkinnot: {WHEEL_PRIZES.slice().sort((a, b) => a - b).filter((v, i, all) => all.indexOf(v) === i).map((v) => money(v)).join(', ')}.</li>
          <li>Peräkkäisinä päivinä saat lisäksi putkibonuksen: {STREAK_BONUS.slice(0, 6).map((v) => money(v)).join(', ')}.</li>
          <li>Seitsemäntenä päivänä pyörän palkinto maksetaan tuplana, ja putki alkaa sen jälkeen alusta.</li>
          <li>Jos päivä jää väliin, putki alkaa alusta.</li>
        </ul>
      </section>

      <section className="panel">
        <h2>Pelin tasapaino</h2>
        <p className="note">
          Laskettu simuloimalla {sim.rounds.toLocaleString('fi-FI')} kierrosta perusstrategialla. Luvut ovat pelaajan odotusarvoja prosentteina panoksesta.
        </p>
        <table>
          <tbody>
            <tr><td>Peruspeli ilman bonuksia</td><td>{signed(sim.baseGame, 2)}</td></tr>
            {sim.specials.map((s) => <tr key={s.id}><td>{s.name}</td><td>{signed(s.ev)}</td></tr>)}
            <tr><td>Bonuspelit</td><td>{signed(sim.bonusGame.ev)}</td></tr>
            <tr><td><strong>Koko peli tapahtumineen</strong></td><td><strong>{signed(sim.withEvents)}</strong></td></tr>
            <tr><td>Perfect Pairs (sivupanoksesta)</td><td>{signed(sim.perfectPairs)}</td></tr>
            <tr><td>21+3 (sivupanoksesta)</td><td>{signed(sim.twentyOnePlusThree)}</td></tr>
          </tbody>
        </table>
        <p className="note">Peli on tarkoituksella pelaajalle voitollinen. Siinä pelataan vain pelirahalla.</p>
      </section>
    </div>
  );
}

interface SettingsProps {
  profile: Profile;
  onSave: (p: Profile) => void;
  onLock: () => void;
  onDelete: () => void;
  notify: (title: string, text: string) => void;
}

export function SettingsScreen({ profile, onSave, onLock, onDelete, notify }: SettingsProps) {
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = (settings: Partial<Profile['settings']>) => onSave({ ...profile, settings: { ...profile.settings, ...settings } });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied('Koodi kopioitu.');
    } catch {
      setCopied('Kopiointi ei onnistunut. Valitse koodi ja kopioi se käsin.');
    }
  };

  return (
    <div className="page">
      <section className="panel">
        <h2>Peli</h2>
        <label className="check">
          <input type="checkbox" checked={profile.settings.hints} onChange={(e) => set({ hints: e.target.checked })} />
          <span>Näytä paras siirto joka kädessä</span>
        </label>
        <label className="check">
          <input type="checkbox" checked={profile.settings.calm} onChange={(e) => set({ calm: e.target.checked })} />
          <span>Vähennä animaatioita</span>
        </label>
        <button
          className="btn wide"
          onClick={() => {
            onSave({ ...profile, tutorialDone: false });
            notify('Opastus', 'Opastus näkyy taas, kun palaat pöytään.');
          }}
        >
          Näytä opastus uudelleen
        </button>
      </section>

      <section className="panel">
        <h2>Siirrä toiselle laitteelle</h2>
        <p className="note">Edistymisesi on tallessa vain tällä laitteella. Siirtokoodi sisältää koko profiilisi. Syötä se toisella laitteella aloitussivun kohdassa Tuo siirtokoodilla.</p>
        <button className="btn wide" onClick={() => { setCode(exportCode(profile)); setCopied(''); }}>Luo siirtokoodi</button>
        {code && (
          <>
            <label>
              Siirtokoodi
              <textarea readOnly value={code} rows={5} onFocus={(e) => e.target.select()} />
            </label>
            <button className="btn primary wide" onClick={copy}>Kopioi koodi</button>
            <p className="note" role="status">{copied}</p>
          </>
        )}
      </section>

      <section className="panel">
        <h2>Profiili</h2>
        <button className="btn wide" onClick={onLock}>Vaihda profiilia</button>
        {!confirmDelete ? (
          <button className="btn ghost wide" onClick={() => setConfirmDelete(true)}>Poista profiili</button>
        ) : (
          <div className="confirm" role="alert">
            <p>Profiili {profile.name} ja kaikki sen edistyminen poistetaan tältä laitteelta. Tätä ei voi perua.</p>
            <button className="btn danger wide" onClick={onDelete}>Poista pysyvästi</button>
            <button className="btn wide" onClick={() => setConfirmDelete(false)}>Peruuta</button>
          </div>
        )}
      </section>
    </div>
  );
}
