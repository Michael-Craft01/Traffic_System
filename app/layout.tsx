import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Route Brain | AI Traffic Management",
  description: "Advanced traffic congestion monitoring and route analysis for Zimbabwe.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Content Security Policy to allow Google Maps to load without ERR_BLOCKED_BY_CLIENT */}
        <meta 
          httpEquiv="Content-Security-Policy" 
          content="default-src 'self' * 'unsafe-inline' 'unsafe-eval' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com https://maps.google.com; img-src 'self' data: blob: https://*.gstatic.com https://*.googleapis.com https://*.google.com https://*.ggpht.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; frame-src 'self' https://www.google.com; worker-src 'self' blob:;" 
        />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
