"use client";

import { HEART_CLIP, STAR_CLIP, type ShapeId } from "@/lib/shapes";

const MATERIAL: Record<string, { base: string; edge: string; fallback: string }> = {
  "edible-images": { base: "#fdfaf3", edge: "#ffffff", fallback: "🖼️" },
  "cookie-cutters": { base: "#e3a95f", edge: "#b9793a", fallback: "🍪" },
  "custom-chocolates": { base: "#5b3a2a", edge: "#3a2318", fallback: "🍫" },
  "cake-toppers": { base: "#fffaf0", edge: "#d8a94d", fallback: "🎂" },
};

function isDarkHex(hex?: string) {
  if (!hex) return false;
  const n = parseInt(hex.replace("#", ""), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b < 130;
}

// Derives a matching edge/border tone from the chosen fill colour so the
// outline never clashes with it (e.g. a white category edge showing
// through a dark custom fill on the heart/star notch).
function darken(hex: string, amount = 0.28) {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = Math.round(((n >> 16) & 255) * (1 - amount));
  const g = Math.round(((n >> 8) & 255) * (1 - amount));
  const b = Math.round((n & 255) * (1 - amount));
  return `rgb(${r}, ${g}, ${b})`;
}

function shapeGeometry(shape: ShapeId) {
  switch (shape) {
    case "circle":
      return { borderRadius: "9999px" };
    case "heart":
      return { clipPath: HEART_CLIP };
    case "star":
      return { clipPath: STAR_CLIP };
    default:
      return { borderRadius: "14px" };
  }
}

// Heart/star clip-paths leave a smaller readable area than their bounding
// box, so text needs tighter padding, a smaller size and a shorter cap
// than the rectangular shapes to stay inside the visible silhouette.
const TEXT_SAFE_AREA: Record<ShapeId, { classes: string; maxChars: number }> = {
  circle: { classes: "px-7 text-xs", maxChars: 22 },
  square: { classes: "px-3 text-sm", maxChars: 26 },
  heart: { classes: "px-9 pt-8 text-[0.65rem] leading-tight", maxChars: 16 },
  star: { classes: "px-10 text-[0.6rem] leading-tight", maxChars: 14 },
  number: { classes: "text-sm", maxChars: 26 },
  letter: { classes: "text-sm", maxChars: 26 },
};

function ShapeFrame({
  category,
  shape,
  imageDataUrl,
  message,
  fillColor,
  className = "h-36 w-36",
}: {
  category: string;
  shape: ShapeId;
  imageDataUrl?: string | null;
  message?: string;
  fillColor?: string;
  className?: string;
}) {
  const material = MATERIAL[category] ?? MATERIAL["cookie-cutters"];
  const geometry = shapeGeometry(shape);
  const borderColor = fillColor ? darken(fillColor) : material.edge;

  return (
    <div
      className={`relative flex items-center justify-center border-4 shadow-lg transition-all duration-300 ${className}`}
      style={{
        ...geometry,
        borderColor,
        backgroundColor: fillColor ?? material.base,
        backgroundImage: imageDataUrl ? `url(${imageDataUrl})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {!imageDataUrl && message && (
        <span
          className={`font-display text-center font-semibold italic ${
            isDarkHex(fillColor ?? material.base) ? "text-white" : "text-berry-dark"
          } ${TEXT_SAFE_AREA[shape].classes}`}
        >
          {message.slice(0, TEXT_SAFE_AREA[shape].maxChars)}
        </span>
      )}
      {!imageDataUrl && !message && (
        <span
          className={`flex items-center justify-center rounded-full bg-white/60 text-3xl shadow-sm ${
            shape === "heart" || shape === "star" ? "mt-6 h-14 w-14" : "h-14 w-14"
          }`}
        >
          {material.fallback}
        </span>
      )}
    </div>
  );
}

function GlyphFrame({
  category,
  character,
  imageDataUrl,
  fillColor,
}: {
  category: string;
  character: string;
  imageDataUrl?: string | null;
  fillColor?: string;
}) {
  const material = MATERIAL[category] ?? MATERIAL["cookie-cutters"];
  const ch = (character || "1").slice(0, 2).toUpperCase();
  const solidColor = fillColor ?? material.edge;

  return (
    <div
      className="flex h-40 w-40 items-center justify-center transition-all duration-300"
      style={{
        fontSize: ch.length > 1 ? "4.5rem" : "7rem",
        fontWeight: 800,
        lineHeight: 1,
        fontFamily: "var(--font-display, serif)",
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        WebkitTextFillColor: imageDataUrl ? "transparent" : solidColor,
        color: imageDataUrl ? "transparent" : solidColor,
        backgroundImage: imageDataUrl ? `url(${imageDataUrl})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
        filter: "drop-shadow(0 3px 2px rgba(0,0,0,0.18))",
      }}
    >
      {ch}
    </div>
  );
}

export default function LivePreview({
  category,
  size,
  shape = "circle",
  character = "1",
  imageDataUrl,
  message,
  color,
}: {
  category: string;
  size?: string;
  shape?: ShapeId;
  character?: string;
  imageDataUrl?: string | null;
  message?: string;
  color?: string;
}) {
  const hasContent = Boolean(imageDataUrl || message);

  return (
    <div className="flex h-72 flex-col items-center justify-center gap-3 rounded-2xl bg-blush p-6">
      {renderPreview()}
      {hasContent && (
        <p className="text-center text-xs font-medium text-berry-dark">
          Live preview - what you see is what will be made
        </p>
      )}
    </div>
  );

  function renderPreview() {
    if (category === "edible-images" && size?.toLowerCase().includes("cupcake")) {
      return (
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-9 w-9 overflow-hidden rounded-full border-2 border-white bg-cover bg-center shadow"
              style={{
                backgroundColor: color ?? "#ffffff",
                ...(imageDataUrl ? { backgroundImage: `url(${imageDataUrl})` } : {}),
              }}
            />
          ))}
        </div>
      );
    }

    if (category === "custom-chocolates") {
      const boxMatch = size?.match(/box of (\d+)/i);
      if (boxMatch) {
        const count = Math.min(9, Number(boxMatch[1]));
        if (shape === "number" || shape === "letter") {
          return (
            <GlyphFrame
              category={category}
              character={character}
              imageDataUrl={imageDataUrl}
              fillColor={color}
            />
          );
        }
        return (
          <div className="grid w-44 grid-cols-3 gap-2 rounded-lg bg-[#3a2318] p-3 shadow-lg">
            {Array.from({ length: count }).map((_, i) => (
              <div
                key={i}
                className="aspect-square overflow-hidden border border-[#3a2318] bg-cover bg-center"
                style={{
                  ...shapeGeometry(shape),
                  backgroundColor: color ?? "#5b3a2a",
                  ...(imageDataUrl ? { backgroundImage: `url(${imageDataUrl})` } : {}),
                }}
              />
            ))}
          </div>
        );
      }
    }

    if (shape === "number" || shape === "letter") {
      return (
        <GlyphFrameWithStand
          category={category}
          character={character}
          imageDataUrl={imageDataUrl}
          fillColor={color}
        />
      );
    }

    if (category === "custom-chocolates") {
      return (
        <ShapeFrame
          category={category}
          shape={shape}
          imageDataUrl={imageDataUrl}
          message={message}
          fillColor={color}
          className="h-28 w-44"
        />
      );
    }

    if (category === "cake-toppers") {
      return (
        <div className="flex flex-col items-center">
          <ShapeFrame
            category={category}
            shape={shape}
            imageDataUrl={imageDataUrl}
            message={message}
            fillColor={color}
            className="h-32 w-32"
          />
          <div className="h-10 w-1.5 bg-gold" />
        </div>
      );
    }

    return (
      <ShapeFrame
        category={category}
        shape={shape}
        imageDataUrl={imageDataUrl}
        message={message}
        fillColor={color}
      />
    );
  }
}

function GlyphFrameWithStand({
  category,
  character,
  imageDataUrl,
  fillColor,
}: {
  category: string;
  character: string;
  imageDataUrl?: string | null;
  fillColor?: string;
}) {
  if (category === "cake-toppers") {
    return (
      <div className="flex flex-col items-center">
        <GlyphFrame category={category} character={character} imageDataUrl={imageDataUrl} fillColor={fillColor} />
        <div className="h-10 w-1.5 bg-gold" />
      </div>
    );
  }
  return <GlyphFrame category={category} character={character} imageDataUrl={imageDataUrl} fillColor={fillColor} />;
}
