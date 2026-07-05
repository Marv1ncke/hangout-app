import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 280,
          background: "#000000", /* Gitzwart */
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#ffffff", /* Knalwit */
          fontFamily: "sans-serif",
          fontWeight: 900,
          borderRadius: 110, /* Perfecte Apple squircle curve */
        }}
      >
        H
      </div>
    ),
    { ...size }
  );
}