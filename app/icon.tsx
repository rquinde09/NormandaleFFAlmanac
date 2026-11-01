import { ImageResponse } from "next/og";

// Generated at build time: /icon/32 (favicon), /icon/192 and /icon/512 (PWA manifest)
const SIZES = [32, 192, 512];

export function generateImageMetadata() {
  return SIZES.map((size) => ({ id: String(size), size: { width: size, height: size }, contentType: "image/png" }));
}

export default async function Icon({ id }: { id: Promise<string | number> }) {
  const size = Number(await id);
  return new ImageResponse(<Mark size={size} />, { width: size, height: size });
}

function Mark({ size }: { size: number }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#dc2626",
        borderRadius: size * 0.22,
        color: "white",
        fontSize: size * 0.62,
        fontWeight: 800,
        letterSpacing: -size * 0.02,
      }}
    >
      N
    </div>
  );
}
