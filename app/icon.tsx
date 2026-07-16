import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#000000", 
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 115, /* Perfecte Apple squircle curve */
        }}
      >
        <span
          style={{
            fontSize: 270,
            color: "#ffffff", /* Knalwitte H */
            fontFamily: "sans-serif",
            fontWeight: 900,
            textShadow: `
              0 0 20px rgba(99, 102, 241, 0.8),  
              0 0 40px rgba(168, 85, 247, 0.6),  
              0 0 60px rgba(168, 85, 247, 0.4)
            `,
          }}
        >
          H
        </span>
      </div>
    ),
    { ...size }
  );
}