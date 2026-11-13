# Pulse (Web)

Level selection and playing field based on Next.js (App Router), PixiJS and localStorage.

```bash
npm install
npm run dev http://localhost:3000
npm test
```

## Build

/ Path / Purpose |
|---|---|
/ `src/app/page.tsx` | Level Selection (`/`) |
/ `src/app/play/[id]/page.tsx` | Game page (`/play/4`) |
/ `src/components/LevelSelect.tsx` / Grid with status: locked, open, solved, perfect |
/ `src/components/GameScreen.tsx` / Unlock Check, PixiJS start, undo, Hint, Restart, win dialog |
/ `src/components/SettingsPanel.tsx` | Settings (`/settings`): Color palette and pulse color with preview |
/ `src/lib/store.ts` / Generic localStorage store (basis for progress and settings) |
/ `src/lib/progress.ts` / Progress (best value per level) |
/ `src/lib/settings.ts` / Settings: Palette and pulse color |
/ `src/lib/useProgress.ts` / React-Hook without hydration error |
/ `src/lib/levels.ts` / Level list and par (shortest solution per solver) |
/ `src/game/` / Game logic, renderer, solver, `theme.ts` (pallets), `music.ts` (keys and assignment), `pulse audio.ts` (sound) |
/ `src/levels/` / level as JSON |

## Add new level

1. Put JSON after `src/levels/level-11.json`.
2. In `src/lib/levels.ts` import and add to `LEVELS`.

Progress is under the key `pulse:progress:v1`. If the format changes, count up the key.

## Accessibility features

- Each color has a shape: circle (neutral), triangle and rhombus (the two colors). Color knots, gates and the impulse wear them, the color is never the only clue.
- Palette "Colorblind-friendly" (orange and sky blue, Okabe-Ito).
- Pulse color freely selectable, too dark colors are rejected (contrast at least 3:1 to the background).
- The pulsation of the rings is omitted in `prefers-reduced-motion`.

## Sound

- No audio files: everything is synthesized via web audio (synthesizer, piano, electric guitar, drums).
- Each node has a fixed tone according to its height on the screen, all the tones are from a pentatonic. Levels 1 to 5 are in C major, from level 6 in A minor (same notes, darker character). Keys per 5 levels are available in `WORLDS` in `music.ts`.
- Drums have no pitch: kick at the bottom of the screen, then tom, snare, hi-hat, open hi-hat. The solution path becomes a rhythm.
- The audio context starts only at the first tap, because otherwise browsers block.
- The sounds are synthetic and belong adjusted by ear: Constants in 'pulse audio.ts' (e.g. guitar distortion, piano decay time, volume of the background sound).