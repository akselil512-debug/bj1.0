# Saloon 21

Wild West themed blackjack for the browser. Play money only. It teaches basic strategy, rewards progress with levels and achievements, and adds special hands, side bets, pop-up events and nested bonus games.

The game UI is in Finnish.

## Development

```
npm install
npm run dev     # http://localhost:5173
npm test        # unit tests (Vitest)
npm run e2e     # browser tests with accessibility checks (Playwright + axe)
npm run sim     # bonus simulation, writes docs/simulation.md
npm run build   # production build to dist/
```

`SINGLE_FILE=1 npx vite build` produces one self-contained `dist/index.html`.

## Structure

- `src/game/` — pure game logic with no UI: cards, round engine, basic strategy, bonuses, events, bonus games, progress, storage
- `src/ui/` — React user interface
- `tests/` — unit tests, grouped by story
- `e2e/` — browser tests at phone size, including WCAG 2.1 AA checks
- `scripts/sim.ts` — expected-value simulation (STORY-010)
- `docs/` — simulation results and the basic strategy source
- `CLAUDE.md`, `backlog.json`, `design-brief.md` — project memory, tickets and design brief

## Rules

Six decks, blackjack pays 3:2, push returns the bet, dealer stands on all 17s and peeks for blackjack, double on any two cards and after split, unlimited re-splits, insurance, late surrender.

## Deployment

Pushing to `main` runs the tests and deploys to GitHub Pages (`.github/workflows/deploy.yml`). In the repository settings, set Pages → Source to "GitHub Actions".

## License

MIT. See `LICENSE`. Asset sources are listed in `ASSETS-LICENSES.md`.
