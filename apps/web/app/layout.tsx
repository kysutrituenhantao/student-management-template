import type { Metadata, Viewport } from "next";
import { Baloo_2, Be_Vietnam_Pro, Mali } from "next/font/google";
import type { ReactNode } from "react";
import { APP_NAME } from "@lhhp/shared";
import { SITE_URL } from "@/lib/site";
import { Providers } from "./providers";
import "./globals.css";

const baloo = Baloo_2({ subsets: ["latin", "vietnamese"], weight: ["600", "700", "800"], variable: "--font-baloo", display: "swap" });
const bevn = Be_Vietnam_Pro({ subsets: ["latin", "vietnamese"], weight: ["400", "500", "600", "700"], variable: "--font-bevn", display: "swap" });
const mali = Mali({ subsets: ["latin", "vietnamese"], weight: ["500", "600"], variable: "--font-mali", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: APP_NAME, template: `%s | ${APP_NAME}` },
  description: "Quản lý lớp học, thi đua bằng vườn hoa điểm tốt, giao nhiệm vụ Toán và Tiếng Việt, và kết nối với phụ huynh.",
  applicationName: APP_NAME,
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/apple-touch-icon.png" },
  // Children's accounts: nothing here belongs in a search engine except the front door.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#ff8fb8",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi" className={`${baloo.variable} ${bevn.variable} ${mali.variable}`}>
      <body>
        <a href="#main" className="skip-link">
          Bỏ qua, vào nội dung chính
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
