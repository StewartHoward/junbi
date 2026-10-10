import "server-only";
import QRCode from "qrcode";

/** QR codes for a club's family sign-up link. Black on white with a quiet zone, so any phone camera reads them. */
const opts = { errorCorrectionLevel: "M" as const, margin: 2, color: { dark: "#1d1d1f", light: "#ffffff" } };

export const qrSvg = (url: string) => QRCode.toString(url, { ...opts, type: "svg" });
export const qrPng = (url: string, width = 1200) => QRCode.toBuffer(url, { ...opts, type: "png", width });
