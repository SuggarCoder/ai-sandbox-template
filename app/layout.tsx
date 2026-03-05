import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";

import "@/app/globals.css";
import { Navbar } from "@/components/layout/navbar";
import { Toaster } from "@/components/ui/sonner";

const sans = Geist({
  variable: "--font-sans",
  subsets: ["latin"]
});

const mono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"]
});

export const metadata: Metadata = {
  title: "Slack Thread UI Workspace",
  description: "Thread-driven UI template powered by Next.js App Router."
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${mono.variable} min-h-screen font-sans`}>
        <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pb-8 md:px-8">
          <Navbar />
          <main className="flex-1 py-8">{children}</main>
        </div>
        <Toaster />
      </body>
    </html>
  );
}
