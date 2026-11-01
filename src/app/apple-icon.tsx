import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** The icon phones use when Junbi is added to the home screen. */
export default function AppleIcon() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#1d1d1f", color: "#ffffff", fontSize: 120, fontWeight: 700, fontFamily: "sans-serif", paddingBottom: 16 }}>j</div>,
    size,
  );
}
