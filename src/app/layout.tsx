import type { Metadata, Viewport } from "next";
import "./globals.css";
import ClientLayout from "@/components/layout/ClientLayout";
import { resourceHints } from "./resource-hints";

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "집사모여 — 반려동물 자랑 커뮤니티",
  description: "사진 한 장이면 세상에 하나뿐인 키캡 피규어로! 반려동물과 함께하는 일상을 공유하고 다른 집사들과 소통해보세요. AI 키캡 피규어, 사진 공유, 오픈채팅, DM까지!",
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full" suppressHydrationWarning>
      <head>
        {resourceHints.map((hint) => (
          <link key={hint.href} rel={hint.rel} href={hint.href} crossOrigin={hint.crossOrigin} />
        ))}
      </head>
      <body className="min-h-full">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
