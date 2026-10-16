import type { GameId } from "./games";

export type AchievementId =
  | "first-punch"
  | "flex-appeal"
  | "street-champion"
  | "first-shortcut"
  | "shortcut-king"
  | "dirty-driver"
  | "millionaire"
  | "lucky-guess"
  | "hot-streak"
  | "master-scammer"
  | "arcade-legend";

export interface Achievement {
  id: AchievementId;
  title: string;
  description: string;
  game: GameId | "arcade";
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first-punch", title: "FIRST PUNCH", description: "Land your first punch.", game: "street-rampage" },
  { id: "flex-appeal", title: "FLEX APPEAL", description: "Hit 3 thugs with one Flex Blast.", game: "street-rampage" },
  { id: "street-champion", title: "STREET CHAMPION", description: "Defeat the Big Boss.", game: "street-rampage" },
  { id: "first-shortcut", title: "SNEAKY", description: "Discover your first shortcut.", game: "dirty-racing" },
  { id: "shortcut-king", title: "SHORTCUT KING", description: "Discover 6 different shortcuts.", game: "dirty-racing" },
  { id: "dirty-driver", title: "DIRTY DRIVER", description: "Win a race using 3+ shortcuts.", game: "dirty-racing" },
  { id: "millionaire", title: "MILLIONAIRE", description: "Win on Millionaire Boulevard.", game: "dirty-racing" },
  { id: "lucky-guess", title: "LUCKY GUESS", description: "Find the stone for the first time.", game: "shell-game" },
  { id: "hot-streak", title: "HOT STREAK", description: "5 correct guesses in a row.", game: "shell-game" },
  { id: "master-scammer", title: "MASTER SCAMMER", description: "Beat level 10 of the Shell Game.", game: "shell-game" },
  { id: "arcade-legend", title: "ARCADE LEGEND", description: "Complete all three games.", game: "arcade" },
];

export const achievementById = (id: string) => ACHIEVEMENTS.find((a) => a.id === id);
