# Pulse (Web)

Level selection and playing field based on Next.js (App Router), PixiJS and localStorage.

```bash
npm install
npm run dev
npm test
```

## Build

| Path | Purpose |
|---|---|
| `src/app/page.tsx` | Level Selection (`/`) |
| `src/app/play/[id]/page.tsx` | Game page (`/play/4`) |
| `src/components/LevelSelect.tsx` | Grid with status: locked, open, solved, perfect |
| `src/components/GameScreen.tsx` | Unlock Check, PixiJS start, undo, Hint, Restart, win dialog |
| `src/components/Playfield.tsx` | Playing field with PixiJS, used by campaign and own levels |
| `src/components/editor` | Level-Editor (`/editor`): artboard and operation |
| `src/components/CustomGame.tsx` | Plays a level from the link (`/play/custom#P1.…`) |
| `src/components/SettingsPanel.tsx` | Settings (`/settings`): Color palette and pulse color with preview |
| `src/lib/store.ts` | Generic localStorage store (basis for progress and settings) |
| `src/lib/progress.ts` | Progress (best value per level) |
| `src/lib/settings.ts` | Settings: palette, pulse color, sound |
| `src/lib/userLevels.ts` | Self-built levels and editor design in localStorage |
| `src/lib/useProgress.ts` | React-Hook without hydration error |
| `src/lib/levels.ts` | Level list and par (shortest solution per solver) |
| `src/game/` | Game logic, renderer, solver, `theme.ts` (pallets), `music.ts` (keys and assignment), `pulse audio.ts` (sound), `analysis.ts` (key figures), `editor.ts` (edit functions), `codec.ts` (level code), `generator.ts` (random level) |
| `src/levels/` | level as JSON |

## Add new level

1. Put JSON after `src/levels/level-20.json`.
2. In `src/lib/levels.ts` import and add to `LEVELS`.

Progress is under the key `pulse:progress:v1`. If the format changes, count up the key.

## Accessibility features

- Each color has a shape: circle (neutral), triangle and rhombus (the two colors). Color knots, gates and the impulse wear them, the color is never the only clue.
- Palette "Colorblind-friendly" (orange and sky blue, Okabe-Ito).
- Pulse color freely selectable, too dark colors are rejected (contrast at least 3:1 to the background).
- The pulsation of the rings is omitted in `prefers-reduced-motion`.

## Sound

- No audio files: everything is synthesized via web audio (synthesizer, piano, electric guitar, drums).
- Each node has a fixed tone according to its height on the screen, all the tones are from a pentatonic. Levels 1 to 5 are in C major, 6 to 9 in G major, 10 to 14 in A minor (darker for the tricky levels), 15 to 19 in D major (new mechanics). The sections are in `WORLDS` in `music.ts`.
- Drums have no pitch: kick at the bottom of the screen, then Tom, snare, hi-hat, open hi-hat. The solution path becomes a rhythm.
- The audio context starts only at the first tap, because otherwise browsers block.
- The sounds are synthetic and belong adjusted by ear: Constants in `pulse_audio.ts` (e.g. guitar distortion, piano decay time, volume of the background sound).
- The background sound is off by default (disturbing in the test) and can be switched on in the settings.

## Node

| Type | Rule | Representation |
|---|---|---|
| `normal` | can be visited as often as desired | circle |
| `once` | disappears as soon as the impulse leaves it | circle with double ring |
| `color` | `gate` | color node sets the pulse color, tor only lets this color through | circle or ring with shape (triangle, rhombus) |
| `timer` (`limit`) | can only be entered as long as fewer than `limit` moves have been made, after which it disintegrates; it must be activated before that | circle with segment ring, one segment per remaining move |
| `mirror` (`pair`) | Whoever enters it appears on the twin (both are considered activated) | square with slash, twins connected by dashed line |

The timer is turn-based, there is no time pressure in real time. This keeps the game fair and playable for everyone.

Optionally, a level carries a `tip` (a sentence) that appears above the playing field. It is intended for levels that introduce a new mechanics.

## Level editor, generator and Share

- **Editor** under `/editor`: Set nodes to a 7 x 5 grid, edges (double-sided or one-way), node types, start. Undo, automatic draft, Save to "My Level" (up to 50).
- **Exam live:** Error, solvability, shortest solution, number of solution paths, dead end percentage and a difficulty estimate. Testing and sharing are only possible when the level is error-free and solvable.
- **Generator:** Select number of nodes, level and mechanics. Time nodes and mirrors are taken over only if they really change the level. Currently running in the main thread (at most 2 seconds), a Web worker would be the next improvement.
- **Share:** The level is completely in the link: `/play/custom#P1.<Code>` There is no server and no accounts.
- **Security:** Codes from links are strictly checked (length, characters, node types, coordinates, references, solvability) and never executed as a code. Names are displayed as text and cleaned up.
- **Expand campaign:** In the editor under "For developers" copy the level as JSON, as `src/levels/level-NN.json`, set `id` and put it in `src/lib/levels.ts`. `game_levels.test.ts` then checks validity and solvability.