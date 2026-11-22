import { useCallback, useEffect, useMemo, useState } from 'react';
import { levelFor, Profile, titleFor, Update } from '../game/progress';
import { loadProfiles, safeStore, saveProfiles } from '../game/storage';
import { Gate } from './Gate';
import { Table } from './Table';
import { ProfileScreen, RulesScreen, SettingsScreen } from './Screens';
import { money } from './common';

type Screen = 'table' | 'profile' | 'rules' | 'settings';
const TABS: [Screen, string][] = [
  ['table', 'Pöytä'],
  ['profile', 'Profiili'],
  ['rules', 'Säännöt'],
  ['settings', 'Asetukset'],
];

interface Toast {
  id: number;
  title: string;
  text: string;
}

const store = safeStore();
let toastId = 0;

export function App() {
  const [profiles, setProfiles] = useState<Profile[]>(() => loadProfiles(store));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>('table');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [liveBalance, setLiveBalance] = useState<number | null>(null);

  const profile = useMemo(() => profiles.find((p) => p.id === activeId) ?? null, [profiles, activeId]);

  useEffect(() => saveProfiles(store, profiles), [profiles]);

  const toast = useCallback((title: string, text: string) => {
    const id = ++toastId;
    setToasts((t) => [...t.slice(-2), { id, title, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  const saveProfile = useCallback((next: Profile) => {
    setProfiles((list) => (list.some((p) => p.id === next.id) ? list.map((p) => (p.id === next.id ? next : p)) : [...list, next]));
  }, []);

  const applyUpdate = useCallback(
    (update: Update) => {
      saveProfile(update.profile);
      if (update.leveledUp) {
        const level = levelFor(update.profile.xp);
        toast(`Nousit tasolle ${level}`, `Arvonimesi: ${titleFor(level)}.`);
      }
      for (const a of update.unlocked) toast(`Saavutus: ${a.name}`, a.desc);
    },
    [saveProfile, toast],
  );

  if (!profile) {
    return (
      <div className="app">
        <Gate
          profiles={profiles}
          onEnter={(p) => {
            saveProfile(p);
            setActiveId(p.id);
            setScreen('table');
          }}
        />
      </div>
    );
  }

  const level = levelFor(profile.xp);
  const balance = liveBalance ?? profile.balance;

  return (
    <div className={`app ${profile.settings.calm ? 'calm' : ''}`}>
      <header className="topbar">
        <div className="brand">
          <span className="brand-name">Saloon 21</span>
          <span className="brand-sub">
            {profile.name} · taso {level} · {titleFor(level)}
          </span>
        </div>
        <div className="balance" aria-label={`Saldo ${money(balance)}`}>
          <span className="balance-label">Saldo</span>
          <span className="balance-value">{money(balance)}</span>
        </div>
      </header>

      <nav className="tabs" aria-label="Päävalikko">
        {TABS.map(([id, label]) => (
          <button key={id} className={screen === id ? 'tab active' : 'tab'} aria-current={screen === id ? 'page' : undefined} onClick={() => setScreen(id)}>
            {label}
          </button>
        ))}
      </nav>

      <main className="main">
        {/* The table stays mounted so that leaving it mid-hand does not cancel the round. */}
        <div className="table-wrap" hidden={screen !== 'table'}>
          <Table key={profile.id} profile={profile} onUpdate={applyUpdate} onSave={saveProfile} onBalance={setLiveBalance} notify={toast} />
        </div>
        {screen === 'profile' && <ProfileScreen profile={profile} />}
        {screen === 'rules' && <RulesScreen />}
        {screen === 'settings' && (
          <SettingsScreen
            profile={profile}
            onSave={saveProfile}
            onLock={() => setActiveId(null)}
            onDelete={() => {
              setProfiles((list) => list.filter((p) => p.id !== profile.id));
              setActiveId(null);
            }}
            notify={toast}
          />
        )}
      </main>

      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            <strong>{t.title}</strong>
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
