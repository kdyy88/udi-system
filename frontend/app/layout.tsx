import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";
import { Providers } from "@/app/providers";
import { Navbar } from "@/components/shared/Navbar";
import { AnimatePresenceProvider } from "@/components/shared/AnimatePresenceProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "GS1 UDI System",
  description: "GS1-compliant UDI generation platform for medical devices/pharma.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>
          <Navbar />
          <AnimatePresenceProvider>
            {children}
          </AnimatePresenceProvider>
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
