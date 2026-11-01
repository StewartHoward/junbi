import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

/** The browser tab icon: a small "j" on black. */
export default function Icon() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#1d1d1f", color: "#ffffff", borderRadius: 14, fontSize: 46, fontWeight: 700, fontFamily: "sans-serif", paddingBottom: 6 }}>j</div>,
    size,
  );
}
