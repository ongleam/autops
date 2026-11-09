/* eslint-disable no-restricted-syntax -- ImageResponse requires inline styles to render the social image. */
import { ImageResponse } from "next/og";

export const alt = "autops — Build alone. Operate with AI.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#18181b", color: "#ffffff", padding: 72 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 24, fontSize: 44, fontWeight: 700 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 64, height: 64, border: "3px solid #ffffff", borderRadius: 14, fontSize: 42 }}>↻</div>
        autops.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.1 }}>Build alone.<br />Operate with AI.</div>
        <div style={{ fontSize: 28, color: "#d4d4d8" }}>AI DevOps for solo builders</div>
      </div>
    </div>,
    size,
  );
}
