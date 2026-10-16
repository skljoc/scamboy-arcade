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
npm run build   # production build (Vercel-ready)
```

## Online leaderboard (Neon Postgres)

Every finished run is uploaded to a world leaderboard (`/api/scores`) when a database is configured. Each
browser gets an anonymous player id, so a player's scores stay linked to them; the world board shows every
player's best run, with your own entry highlighted. Without a database the console keeps scores locally and
the WORLD view simply shows "offline".

**On Vercel:** import the repo, then add **Neon** from the project's *Storage* tab (Marketplace). It sets
`DATABASE_URL` for you; the `scores` table is created automatically on the first request.

**Locally:** copy `.env.example` to `.env.local`, set `DATABASE_URL` to any Postgres (a Neon branch or e.g.
`docker run -p 5432:5432 -e POSTGRES_PASSWORD=pw postgres`), then optionally create the table up front:

```bash
npm run db:setup
```

Scores are validated server-side (known game, 1–8 character name, integer score within a per-game maximum,
one submission per player every 3 s). Since scores come from the browser, treat the board as a fun arcade
board rather than a tamper-proof one.

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
  server/                 Postgres pool + score queries for the online leaderboard
  app/api/scores/         GET world board / POST a finished run
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
