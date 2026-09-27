import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ alignItems: "center", background: "#FAF9F6", display: "flex", height: "100%", justifyContent: "center", width: "100%" }}>
        <div style={{ alignItems: "center", background: "#1C4A3C", borderRadius: "112px", color: "#FAF9F6", display: "flex", fontFamily: "serif", fontSize: 280, fontWeight: 700, height: 392, justifyContent: "center", paddingBottom: 24, width: 392 }}>C</div>
      </div>
    ),
    size,
  );
}
