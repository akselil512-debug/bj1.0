import { FormEvent, useState } from 'react';
import { newProfile, Profile } from '../game/progress';
import { importCode, validName, validPin } from '../game/storage';

type Mode = 'list' | 'create' | 'import';

export function Gate({ profiles, onEnter }: { profiles: Profile[]; onEnter: (p: Profile) => void }) {
  const [mode, setMode] = useState<Mode>(profiles.length ? 'list' : 'create');
  const [selected, setSelected] = useState<Profile | null>(null);
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const go = (m: Mode) => {
    setMode(m);
    setError('');
    setPin('');
    setSelected(null);
  };

  const unlock = (e: FormEvent) => {
    e.preventDefault();
    if (selected && pin === selected.pin) onEnter(selected);
    else setError('Väärä koodi. Yritä uudelleen.');
  };

  const create = (e: FormEvent) => {
    e.preventDefault();
    if (!validName(name)) return setError('Anna nimimerkki, jossa on 1–20 merkkiä.');
    if (!validPin(pin)) return setError('Koodissa pitää olla tasan kolme numeroa.');
    if (profiles.some((p) => p.name.toLowerCase() === name.trim().toLowerCase())) return setError('Tällä laitteella on jo samanniminen profiili.');
    onEnter(newProfile(name.trim(), pin, Date.now()));
  };

  const restore = (e: FormEvent) => {
    e.preventDefault();
    const result = importCode(code);
    if (!result.ok) return setError(result.error);
    const existing = profiles.find((p) => p.id === result.profile.id);
    onEnter(existing ? { ...result.profile, id: existing.id } : result.profile);
  };

  const pinInput = (
    <label>
      Kolminumeroinen koodi
      <input
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 3))}
        inputMode="numeric"
        autoComplete="off"
        maxLength={3}
        className="pin"
        data-autofocus={selected ? true : undefined}
      />
    </label>
  );

  return (
    <div className="gate">
      <h1 className="logo">
        Saloon <span>21</span>
      </h1>
      <p className="tagline">Villin lännen blackjack. Pelataan pelirahalla.</p>

      {mode === 'list' && !selected && (
        <section className="panel">
          <h2>Valitse profiili</h2>
          <div className="stack">
            {profiles.map((p) => (
              <button key={p.id} className="btn wide" onClick={() => { setSelected(p); setError(''); setPin(''); }}>
                {p.name}
              </button>
            ))}
          </div>
        </section>
      )}

      {mode === 'list' && selected && (
        <form className="panel" onSubmit={unlock}>
          <h2>{selected.name}</h2>
          {pinInput}
          <button className="btn primary wide" type="submit">Avaa profiili</button>
          <button className="btn ghost wide" type="button" onClick={() => go('list')}>Takaisin</button>
        </form>
      )}

      {mode === 'create' && (
        <form className="panel" onSubmit={create}>
          <h2>Uusi profiili</h2>
          <label>
            Nimimerkki
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} autoComplete="off" />
          </label>
          <p className="note">Käytä nimimerkkiä, älä omaa nimeäsi.</p>
          {pinInput}
          <p className="note">Koodi on kevyt lukko, joka estää vahingossa väärän profiilin avaamisen. Se ei ole salasana.</p>
          <button className="btn primary wide" type="submit">Astu saluunaan</button>
        </form>
      )}

      {mode === 'import' && (
        <form className="panel" onSubmit={restore}>
          <h2>Tuo profiili siirtokoodilla</h2>
          <label>
            Siirtokoodi
            <textarea value={code} onChange={(e) => setCode(e.target.value)} rows={5} autoComplete="off" spellCheck={false} />
          </label>
          <p className="note">Koodin saat toisen laitteen Asetukset-sivulta.</p>
          <button className="btn primary wide" type="submit">Tuo profiili</button>
        </form>
      )}

      {error && <p className="error" role="alert">{error}</p>}

      <div className="gate-links">
        {mode !== 'list' && profiles.length > 0 && <button className="btn ghost" onClick={() => go('list')}>Profiilit</button>}
        {mode !== 'create' && <button className="btn ghost" onClick={() => go('create')}>Uusi profiili</button>}
        {mode !== 'import' && <button className="btn ghost" onClick={() => go('import')}>Tuo siirtokoodilla</button>}
      </div>
    </div>
  );
}
