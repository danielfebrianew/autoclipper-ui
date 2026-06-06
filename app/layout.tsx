import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AutoClipper",
  description: "TikTok-style clip renderer",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#0f0f0f] text-gray-100">
        <nav className="border-b border-white/10 px-6 py-4 flex items-center gap-6">
          <Link href="/" className="text-lg font-bold tracking-tight text-white">
            ✂️ AutoClipper
          </Link>
          <Link href="/" className="text-sm text-gray-400 hover:text-white transition-colors">
            Render
          </Link>
          <Link href="/outputs" className="text-sm text-gray-400 hover:text-white transition-colors">
            Outputs
          </Link>
        </nav>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
