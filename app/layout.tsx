import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "トイレの駆け込み寺",
  description: "全国の公衆トイレを地図で見つけるアプリ。多目的・24時間・無料トイレを素早く検索。",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "駆け込み寺",
  },
  icons: { apple: "/toilet-icon-192.png" },
  openGraph: {
    title: "🚻 トイレの駆け込み寺",
    description: "全国の公衆トイレを地図で見つけるアプリ。",
    url: "https://toilet-kakekomi.vercel.app",
    siteName: "トイレの駆け込み寺",
    images: [{ url: "https://toilet-kakekomi.vercel.app/toilet-icon-512.png", width: 512, height: 512 }],
    locale: "ja_JP",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="駆け込み寺" />
        <link rel="icon" href="/toilet-icon-192.png" type="image/png" />
        <link rel="apple-touch-icon" href="/toilet-icon-192.png" />
        <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-0822883607725147" crossOrigin="anonymous"></script>
      </head>
      <body>{children}</body>
    </html>
  );
}
