import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "GAES 2026 Dashboard · Ghana Statistical Service",
  description: "Fieldwork monitoring, data quality and preliminary statistics for the Ghana Annual Economic Survey 2026.",
  icons: { icon: "/gss-logo.png" },
};

export const viewport: Viewport = { themeColor: "#241b5a", width: "device-width", initialScale: 1 };

const themeScript = `try{var t=localStorage.getItem('gaes-theme');var d=t?t==='dark':matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.dataset.theme=d?'dark':'light'}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
