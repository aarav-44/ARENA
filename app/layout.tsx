import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ARENA | Sports Tournament",
  description: "Live scores and tournament winners"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
