// Saving profiles on the device and moving them between devices with a transfer code.

import { emptyStats, Profile } from './progress';

const KEY = 'saloon21.v1';
const PREFIX = 'S21';

export interface Store {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Falls back to memory when the browser refuses storage. */
export function safeStore(): Store {
  const memory = new Map<string, string>();
  const fallback: Store = { getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => void memory.set(k, v) };
  try {
    const ls = globalThis.localStorage;
    ls.setItem(`${KEY}.probe`, '1');
    ls.removeItem(`${KEY}.probe`);
    return {
      getItem: (k) => {
        try {
          return ls.getItem(k);
        } catch {
          return fallback.getItem(k);
        }
      },
      setItem: (k, v) => {
        try {
          ls.setItem(k, v);
        } catch {
          fallback.setItem(k, v);
        }
      },
    };
  } catch {
    return fallback;
  }
}

export function loadProfiles(store: Store): Profile[] {
  try {
    const raw = store.getItem(KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data?.profiles)) return [];
    return data.profiles.map(normalize).filter((p: Profile | null): p is Profile => p !== null);
  } catch {
    return [];
  }
}

export function saveProfiles(store: Store, profiles: Profile[]) {
  store.setItem(KEY, JSON.stringify({ profiles }));
}

const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;

export const validName = (name: string) => name.trim().length >= 1 && name.trim().length <= 20;
export const validPin = (pin: string) => /^\d{3}$/.test(pin);

/** Returns a well-formed profile, or null when the data cannot be trusted. */
function normalize(raw: any): Profile | null {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.name !== 'string' || !validName(raw.name)) return null;
  if (typeof raw.pin !== 'string' || !validPin(raw.pin)) return null;
  if (!isCount(raw.balance) || !isCount(raw.xp)) return null;
  const stats = emptyStats();
  if (raw.stats && typeof raw.stats === 'object') {
    for (const key of Object.keys(stats) as (keyof typeof stats)[]) {
      if (key === 'specials') continue;
      if (isCount(raw.stats[key])) (stats[key] as number) = raw.stats[key];
    }
    if (raw.stats.specials && typeof raw.stats.specials === 'object')
      for (const [k, v] of Object.entries(raw.stats.specials)) if (isCount(v)) stats.specials[k] = v;
  }
  const achievements: Record<string, number> = {};
  if (raw.achievements && typeof raw.achievements === 'object')
    for (const [k, v] of Object.entries(raw.achievements)) if (isCount(v)) achievements[k] = v;
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : `p${Date.now().toString(36)}`,
    name: raw.name.trim(),
    pin: raw.pin,
    balance: raw.balance,
    xp: raw.xp,
    stats,
    achievements,
    settings: { hints: raw.settings?.hints !== false, calm: raw.settings?.calm === true },
    tutorialDone: raw.tutorialDone === true,
    createdAt: isCount(raw.createdAt) ? raw.createdAt : Date.now(),
  };
}

function checksum(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(code: string): string {
  const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0)));
}

/** A code that carries the whole profile: S21.<payload>.<checksum> */
export function exportCode(profile: Profile): string {
  const payload = toBase64Url(JSON.stringify(profile));
  return `${PREFIX}.${payload}.${checksum(payload)}`;
}

export type ImportResult = { ok: true; profile: Profile } | { ok: false; error: string };

export function importCode(code: string): ImportResult {
  const parts = code.trim().split('.');
  if (parts.length !== 3 || parts[0] !== PREFIX) return { ok: false, error: 'Tämä ei ole Saloon 21 -siirtokoodi.' };
  if (checksum(parts[1]) !== parts[2]) return { ok: false, error: 'Koodi on vioittunut tai siitä puuttuu osa. Kopioi se uudelleen.' };
  try {
    const profile = normalize(JSON.parse(fromBase64Url(parts[1])));
    if (!profile) return { ok: false, error: 'Koodin sisältö ei ole kelvollinen profiili.' };
    return { ok: true, profile };
  } catch {
    return { ok: false, error: 'Koodia ei voitu lukea.' };
  }
}
