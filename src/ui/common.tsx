import { ReactNode, useEffect, useRef } from 'react';
import { Card, cardLabel, isBlack, rankShort, SUIT_SYMBOLS } from '../game/cards';

export const money = (n: number) => `${Math.round(n).toLocaleString('fi-FI')} $`;
export const percent = (x: number, digits = 0) => `${(x * 100).toFixed(digits).replace('.', ',')} %`;

/** Pip positions as [x %, y %, upside down] for the number cards, laid out like a real deck. */
const PIPS: Record<number, [number, number, boolean?][]> = {
  1: [[50, 50]],
  2: [[50, 22], [50, 78, true]],
  3: [[50, 22], [50, 50], [50, 78, true]],
  4: [[34, 22], [66, 22], [34, 78, true], [66, 78, true]],
  5: [[34, 22], [66, 22], [50, 50], [34, 78, true], [66, 78, true]],
  6: [[34, 22], [66, 22], [34, 50], [66, 50], [34, 78, true], [66, 78, true]],
  7: [[34, 22], [66, 22], [50, 36], [34, 50], [66, 50], [34, 78, true], [66, 78, true]],
  8: [[34, 22], [66, 22], [50, 36], [34, 50], [66, 50], [50, 64, true], [34, 78, true], [66, 78, true]],
  9: [[34, 22], [66, 22], [34, 41], [66, 41], [50, 50], [34, 59, true], [66, 59, true], [34, 78, true], [66, 78, true]],
  10: [[34, 22], [66, 22], [50, 31], [34, 41], [66, 41], [34, 59, true], [66, 59, true], [50, 69, true], [34, 78, true], [66, 78, true]],
};

export function CardView({ card, hidden, index = 0 }: { card: Card; hidden?: boolean; index?: number }) {
  const style = { animationDelay: `${index * 90}ms` };
  if (hidden)
    return (
      <div className="card card-back" role="img" aria-label="Piilotettu kortti" style={style}>
        <span className="back-inner" aria-hidden="true" />
      </div>
    );
  const suit = SUIT_SYMBOLS[card.s];
  const rank = rankShort(card);
  const corner = (side: string) => (
    <span className={`card-corner ${side}`} aria-hidden="true">
      {rank}
      <small>{suit}</small>
    </span>
  );
  return (
    <div className={`card ${isBlack(card) ? 'black' : 'red'} ${card.r === 1 ? 'ace' : ''}`} role="img" aria-label={cardLabel(card)} style={style}>
      {corner('tl')}
      {corner('br')}
      {card.r > 10 ? (
        <span className="card-court" aria-hidden="true">
          <b>{rank}</b>
          <i>{suit}</i>
          <b className="flip">{rank}</b>
        </span>
      ) : (
        <span className="card-pips" aria-hidden="true">
          {PIPS[card.r].map(([x, y, flip], i) => (
            <span key={i} className={flip ? 'pip flip' : 'pip'} style={{ left: `${x}%`, top: `${y}%` }}>
              {suit}
            </span>
          ))}
        </span>
      )}
    </div>
  );
}

/** Modal dialog that keeps keyboard focus inside itself. */
export function Modal({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const focusables = () =>
      Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, textarea, [href]') ?? []);
    (ref.current?.querySelector<HTMLElement>('[data-autofocus]') ?? focusables()[0])?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, []);

  return (
    <div className="overlay">
      <div ref={ref} className={`modal ${className}`} role="dialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}
