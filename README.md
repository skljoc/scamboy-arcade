# SCAMBOY Arcade

*Cheat the game. Own the score.*

A browser-based retro handheld built with **Next.js + TypeScript + Phaser 3**. The SCAMBOY console is drawn
entirely as layered SVG vectors, every button works with mouse, touch and keyboard, and three original games run
inside its 320×288 LCD:

| # | Game | What it is |
|---|------|------------|
| 01 | **Street Rampage** | Belt-scrolling beat-'em-up with a ridiculously muscular SCAMBOY. 3 stages, miniboss, Big Boss. |
| 02 | **Dirty Racing** | Top-down arcade racer vs 3 AI rivals. Win by finding visible and hidden shortcuts. 3 unlockable tracks. |
| 03 | **Shell Game** | Follow the stone under three cups through 10 levels. Fair, exactly-tracked shuffles. Points only. |

## Run it

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # production build (Vercel-ready, fully static)
```

## Controls

| Console | Keyboard |
|---|---|
| D-pad | Arrow keys / WASD |
| A | J / Z |
| B | K / X |
| START | Enter (pause) |
| SELECT | Escape (quit to menu) |

The on-screen buttons support mouse and multi-touch; optional haptics vibrate on supported phones.

## Architecture

```
src/
  app/                    Next.js app router (layout, page, global styles)
  components/             React console UI
    ScamboyConsole.tsx    the SVG handheld (body, bezel, logo, speaker, power switch)
    ConsoleButtons.tsx    D-pad, A/B, START/SELECT — independently interactive SVG groups
    ConsoleScreen.tsx     the LCD: Phaser canvas + OS layer + LCD grid / CRT effects
    BootSequence.tsx      power-on animation
    GameMenu.tsx, GameInfo.tsx, PauseMenu.tsx, NameEntry.tsx,
    ScoresScreen.tsx, TrophiesScreen.tsx, OptionsScreen.tsx   console "OS" screens
    GameDetails.tsx, Scoreboard.tsx, SettingsPanel.tsx         side panels
  games/
    engine/               shared: InputManager, AudioManager (synth chiptune), GameManager (single Phaser
                          instance), BaseScene, pixel-art toolkit, palette, SCAMBOY sprites, bridge to the OS
    street-rampage/       game 01
    dirty-racing/         game 02
    shell-game/           game 03
  store/                  Zustand stores (console state, persisted progress & settings)
  lib/                    game metadata, achievements
```

* React owns the application UI; Phaser owns game rendering. Exactly one `Phaser.Game` exists at a time and is
  destroyed when leaving a game.
* All game art is generated at runtime as pixel art (`games/engine/pixel.ts`) and registered as Phaser textures /
  sprite sheets, so assets can later be swapped for PNG sheets with the same keys.
* All audio is synthesized with the Web Audio API — no audio files. Sound starts after the first user interaction
  (browser autoplay rules).
* Progress, high scores, achievements, unlocked tracks and settings are stored in `localStorage`.
