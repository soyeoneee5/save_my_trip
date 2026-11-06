import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./flight-rescue-theme.css";
import { ServiceWorker } from "@/components/service-worker";

export const metadata: Metadata = {
  title: "Save my Trip | 인천공항 지연·결항 대응",
  description: "인천공항 국제선 지연·결항 상황에서 필요한 행동과 증빙을 안내합니다.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#071b33",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body><ServiceWorker />{children}</body>
    </html>
  );
}
