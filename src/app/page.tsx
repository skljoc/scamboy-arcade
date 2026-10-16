import { ArcadeLoader } from "@/components/ArcadeLoader";
import { ScamboyLogo } from "@/components/ScamboyLogo";

export default function Home() {
  return (
    <main className="retro-bg relative min-h-svh overflow-x-hidden">
      <header className="flex flex-col items-center gap-3 px-4 pb-4 pt-5 lg:gap-2 lg:pb-3 lg:pt-4">
        <h1 className="float-y w-[min(78vw,440px)] lg:w-[340px]">
          <ScamboyLogo className="block h-auto w-full drop-shadow-[0_6px_0_rgba(17,26,60,0.12)]" />
        </h1>
        <p className="pixel text-center text-[9px] leading-relaxed tracking-wide text-navy sm:text-[11px]">
          CHEAT THE GAME. <span className="text-magenta">OWN THE SCORE.</span>
        </p>
      </header>

      <ArcadeLoader />

      <footer className="pixel px-4 pb-8 text-center text-[8px] leading-relaxed text-navy/50">
        SCAMBOY ARCADE · ALL GAMES ARE FOR FUN ONLY — NO REAL MONEY · PROGRESS SAVED ON THIS DEVICE
      </footer>
    </main>
  );
}
