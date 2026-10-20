import type { Metadata, Viewport } from "next";
import "./globals.css";

// 全ページを毎リクエスト描画する（ビルド時に DB へ繋ぎに行かせない）
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "worklog",
  description: "一人用の作業時間記録",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f172a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
