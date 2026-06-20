import type { Metadata } from "next";
import { Fraunces, Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const display = Fraunces({ subsets:["latin"], weight:["500","600","700"], style:["normal","italic"], variable:"--font-display" });
const body = Inter({ subsets:["latin"], weight:["400","500","600"], variable:"--font-body" });
const mono = IBM_Plex_Mono({ subsets:["latin"], weight:["400","500"], variable:"--font-mono" });

export const metadata: Metadata = {
  title: "Verdict — AI Buying Research",
  description: "Live evidence from Amazon, Reddit & Google Trends via Anakin Wire. AI rules: Buy, Wait, or Skip.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="font-body text-white antialiased">{children}</body>
    </html>
  );
}
