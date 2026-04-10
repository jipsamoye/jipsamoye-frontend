import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "집사모여 — 우리 애 자랑하러",
  description: "강아지·고양이를 키우는 집사들이 반려동물을 자랑하고 소통하는 커뮤니티",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${geistSans.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full">
        <Header />
        <Sidebar />
        <main className="pt-16 lg:pl-52 pb-16 lg:pb-0">
          <div className="max-w-7xl mx-auto px-4 py-6">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
