import type { Metadata, Viewport } from "next";
import { Press_Start_2P, Rubik } from "next/font/google";
import "./globals.css";

const pixel = Press_Start_2P({
  variable: "--font-pixel",
  weight: "400",
  subsets: ["latin"],
});

const rubik = Rubik({
  variable: "--font-ui",
  weight: ["400", "500", "700", "800", "900"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SCAMBOY Arcade — Cheat the game. Own the score.",
  description:
    "A playable retro handheld in your browser. Three original games: Street Rampage, Dirty Racing and the Shell Game.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#f1ede4",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${pixel.variable} ${rubik.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
