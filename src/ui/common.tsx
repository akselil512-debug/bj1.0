import { ReactNode, useEffect, useRef } from 'react';
import { Card, cardLabel, isBlack, rankShort, SUIT_SYMBOLS } from '../game/cards';

export const money = (n: number) => `${Math.round(n).toLocaleString('fi-FI')} $`;
export const percent = (x: number, digits = 0) => `${(x * 100).toFixed(digits).replace('.', ',')} %`;

export function CardView({ card, hidden, index = 0 }: { card: Card; hidden?: boolean; index?: number }) {
  const style = { animationDelay: `${index * 90}ms` };
  if (hidden)
    return <div className="card card-back" role="img" aria-label="Piilotettu kortti" style={style} />;
  return (
    <div className={`card ${isBlack(card) ? 'black' : 'red'}`} role="img" aria-label={cardLabel(card)} style={style}>
      <span className="card-rank">
        {rankShort(card)}
        <small>{SUIT_SYMBOLS[card.s]}</small>
      </span>
      <span className="card-suit">{SUIT_SYMBOLS[card.s]}</span>
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
