import type { MetadataRoute } from "next";

// iPhone の「ホーム画面に追加」でアプリ風に開く（オフライン動作はしない。02 §7）
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "worklog",
    short_name: "worklog",
    description: "一人用の作業時間記録",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0f172a",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
