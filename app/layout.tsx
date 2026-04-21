import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import BottomNav from "@/components/BottomNav";
import MapProvider from "@/components/MapProvider";
import NotificationEngine from "@/components/NotificationEngine";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#ffffff",
};

export const metadata: Metadata = {
  title: { default: "Traffic Brain", template: "%s · Traffic Brain" },
  description:
    "Real-time AI-powered traffic orchestration — live congestion monitoring, smart commute recommendations, and crowd-sourced incident reporting.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Traffic Brain" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.className}>
      <body className="bg-slate-50 text-slate-900 antialiased flex flex-col overflow-hidden" style={{ height: "100dvh" }}>
        <MapProvider>
          <NotificationEngine />
          <div className="flex-1 overflow-hidden relative">{children}</div>
          <BottomNav />
        </MapProvider>
      </body>
    </html>
  );
}
