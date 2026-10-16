export type GameId = "street-rampage" | "dirty-racing" | "shell-game";

export interface GameMeta {
  id: GameId;
  number: string;
  title: string;
  short: string;
  tagline: string;
  description: string;
  controls: Array<[string, string]>;
  /** cartridge label colour */
  color: string;
  accent: string;
}

export const GAMES: GameMeta[] = [
  {
    id: "street-rampage",
    number: "01",
    title: "STREET RAMPAGE",
    short: "RAMPAGE",
    tagline: "Flex first. Ask never.",
    description:
      "Side-scrolling beat-'em-up. Muscle-bound SCAMBOY cleans up the Back Alley, Downtown and takes on the Big Boss.",
    controls: [
      ["D-PAD", "WALK"],
      ["A", "PUNCH COMBO"],
      ["B", "JUMP"],
      ["A+B", "FLEX BLAST"],
      ["2x DIR", "DASH"],
    ],
    color: "#d02a6b",
    accent: "#ffd23f",
  },
  {
    id: "dirty-racing",
    number: "02",
    title: "DIRTY RACING",
    short: "RACING",
    tagline: "Shortcuts are a lifestyle.",
    description:
      "Top-down arcade racing against three rivals. Find hidden shortcuts, tunnels and ramps to steal the win.",
    controls: [
      ["UP", "GAS"],
      ["DOWN", "BRAKE / REVERSE"],
      ["L / R", "STEER"],
      ["A", "BOOST"],
      ["B", "HANDBRAKE DRIFT"],
    ],
    color: "#3a86ff",
    accent: "#ffd23f",
  },
  {
    id: "shell-game",
    number: "03",
    title: "SHELL GAME",
    short: "SHELLS",
    tagline: "Keep your eye on the stone.",
    description:
      "SCAMBOY shuffles three cups. Track the stone through 10 levels of increasingly sneaky hustling. Just for fun — no real money.",
    controls: [
      ["L / R", "PICK CUP"],
      ["A", "CONFIRM / GO"],
      ["B", "PEEK AGAIN"],
      ["TAP", "CHOOSE CUP"],
    ],
    color: "#3fb950",
    accent: "#ece7dc",
  },
];

export const gameById = (id: GameId) => GAMES.find((g) => g.id === id)!;
