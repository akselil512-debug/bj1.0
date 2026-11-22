import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { levelFor, Profile, titleFor, Update } from '../game/progress';
import { loadProfiles, safeStore, saveProfiles } from '../game/storage';
import { Gate } from './Gate';
import { Table } from './Table';
import { Lobby } from './Lobby';
import { Roulette } from './Roulette';
import { Wheel } from './Wheel';
import { ProfileScreen, RulesScreen, SettingsScreen } from './Screens';
import { money } from './common';

export type Screen = 'lobby' | 'table' | 'roulette' | 'wheel' | 'profile' | 'rules' | 'settings';

const icon = (paths: ReactNode) => (
  <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {paths}
  </svg>
);

const NAV: { id: Screen; label: string; icon: ReactNode }[] = [
  { id: 'lobby', label: 'Aula', icon: icon(<path d="M3 11 L12 3 L21 11 M5 10 V20 H19 V10" />) },
  { id: 'table', label: 'Blackjack', icon: icon(<path d="M4 8 H13 V20 H4 Z M9 8 V4 H20 V16 H13" />) },
  { id: 'roulette', label: 'Ruletti', icon: icon(<><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3.5" /><circle cx="12" cy="5.6" r="0.9" /></>) },
  { id: 'wheel', label: 'Pyörä', icon: icon(<><circle cx="12" cy="12" r="9" /><path d="M12 3 V21 M3 12 H21 M5.6 5.6 L18.4 18.4 M18.4 5.6 L5.6 18.4" /></>) },
  { id: 'profile', label: 'Profiili', icon: icon(<><circle cx="12" cy="8" r="4" /><path d="M4 21 C4 16 8 14 12 14 C16 14 20 16 20 21" /></>) },
];
const SUBTABS: [Screen, string][] = [
  ['profile', 'Tiedot'],
  ['rules', 'Säännöt'],
  ['settings', 'Asetukset'],
];
const isProfileArea = (s: Screen) => s === 'profile' || s === 'rules' || s === 'settings';

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
  const [screen, setScreen] = useState<Screen>('lobby');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [liveBalance, setLiveBalance] = useState<number | null>(null);

  const profile = useMemo(() => profiles.find((p) => p.id === activeId) ?? null, [profiles, activeId]);

  useEffect(() => saveProfiles(store, profiles), [profiles]);

  const toast = useCallback((title: string, text: string) => {
    setToasts((t) => [...t, { id: ++toastId, title, text }]);
  }, []);

  // Notices are shown one at a time so they never pile up over the table.
  const currentToast = toasts[0];
  useEffect(() => {
    if (!currentToast) return;
    const timer = setTimeout(() => setToasts((t) => t.slice(1)), 2600);
    return () => clearTimeout(timer);
  }, [currentToast]);

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
            setScreen('lobby');
          }}
        />
      </div>
    );
  }

  const level = levelFor(profile.xp);
  const balance = liveBalance ?? profile.balance;

  return (
    <div className={`app with-nav ${profile.settings.calm ? 'calm' : ''}`}>
      <header className="topbar">
        <div className="brand">
          <span className="brand-name">Saloon 21</span>
          <span className="brand-sub">
            {profile.name} · taso {level} · {titleFor(level)}
          </span>
        </div>
        <div className="balance" aria-label={`Saldo ${money(balance)}`}>
          <span className="balance-label">Saldosi</span>
          <span className="balance-value">{money(balance)}</span>
        </div>
      </header>

      <main className="main">
        {screen === 'lobby' && <Lobby profile={profile} go={setScreen} />}
        {/* Both tables stay mounted so that leaving one mid-round does not cancel the round. */}
        <div className="table-wrap" hidden={screen !== 'table'}>
          <Table key={profile.id} profile={profile} onUpdate={applyUpdate} onSave={saveProfile} onBalance={setLiveBalance} notify={toast} />
        </div>
        <div className="table-wrap" hidden={screen !== 'roulette'}>
          <Roulette key={profile.id} profile={profile} onUpdate={applyUpdate} />
        </div>
        {screen === 'wheel' && <Wheel profile={profile} onUpdate={applyUpdate} />}
        {isProfileArea(screen) && (
          <nav className="tabs" aria-label="Profiilin osiot">
            {SUBTABS.map(([id, label]) => (
              <button key={id} className={screen === id ? 'tab active' : 'tab'} aria-current={screen === id ? 'page' : undefined} onClick={() => setScreen(id)}>
                {label}
              </button>
            ))}
          </nav>
        )}
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

      <nav className="bottom-nav" aria-label="Päävalikko">
        {NAV.map((item) => {
          const active = item.id === screen || (item.id === 'profile' && isProfileArea(screen));
          return (
            <button key={item.id} className={active ? 'nav-item active' : 'nav-item'} aria-current={active ? 'page' : undefined} onClick={() => setScreen(item.id)}>
              {item.icon}
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="toasts" aria-live="polite">
        {currentToast && (
          <div key={currentToast.id} className="toast">
            <strong>{currentToast.title}</strong>
            <span>{currentToast.text}</span>
            {toasts.length > 1 && <span className="toast-more">+{toasts.length - 1}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
