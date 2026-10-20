import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS のホーム画面用（SVG を受け付けないため PNG を作る）
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f172a",
        }}
      >
        <svg width="120" height="120" viewBox="0 0 64 64">
          <circle cx="32" cy="34" r="18" fill="none" stroke="#fff" strokeWidth="5" />
          <path d="M32 22v12l8 6" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="27" y="8" width="10" height="5" rx="2" fill="#fff" />
        </svg>
      </div>
    ),
    size,
  );
}
