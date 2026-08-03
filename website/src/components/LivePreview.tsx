"use client";

import { HEART_CLIP, STAR_CLIP, type ShapeId } from "@/lib/shapes";

const MATERIAL: Record<string, { base: string; edge: string; fallback: string }> = {
  "edible-images": { base: "#fdfaf3", edge: "#ffffff", fallback: "🖼️" },
  "cookie-cutters": { base: "#e3a95f", edge: "#b9793a", fallback: "🍪" },
  "custom-chocolates": { base: "#5b3a2a", edge: "#3a2318", fallback: "🍫" },
  "cake-toppers": { base: "#fffaf0", edge: "#d8a94d", fallback: "🎂" },
};

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
  className = "h-36 w-36",
}: {
  category: string;
  shape: ShapeId;
  imageDataUrl?: string | null;
  message?: string;
  className?: string;
}) {
  const material = MATERIAL[category] ?? MATERIAL["cookie-cutters"];
  const geometry = shapeGeometry(shape);

  return (
    <div
      className={`relative flex items-center justify-center border-4 shadow-lg transition-all duration-300 ${className}`}
      style={{
        ...geometry,
        borderColor: material.edge,
        backgroundColor: material.base,
        backgroundImage: imageDataUrl ? `url(${imageDataUrl})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {!imageDataUrl && message && (
        <span
          className={`font-display text-center font-semibold italic text-berry-dark ${TEXT_SAFE_AREA[shape].classes}`}
        >
          {message.slice(0, TEXT_SAFE_AREA[shape].maxChars)}
        </span>
      )}
      {!imageDataUrl && !message && (
        <span className="text-3xl">{material.fallback}</span>
      )}
    </div>
  );
}

function GlyphFrame({
  category,
  character,
  imageDataUrl,
}: {
  category: string;
  character: string;
  imageDataUrl?: string | null;
}) {
  const material = MATERIAL[category] ?? MATERIAL["cookie-cutters"];
  const ch = (character || "1").slice(0, 2).toUpperCase();

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
        WebkitTextFillColor: imageDataUrl ? "transparent" : material.edge,
        color: imageDataUrl ? "transparent" : material.edge,
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
}: {
  category: string;
  size?: string;
  shape?: ShapeId;
  character?: string;
  imageDataUrl?: string | null;
  message?: string;
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
              className="h-9 w-9 overflow-hidden rounded-full border-2 border-white bg-white bg-cover bg-center shadow"
              style={imageDataUrl ? { backgroundImage: `url(${imageDataUrl})` } : undefined}
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
          return <GlyphFrame category={category} character={character} imageDataUrl={imageDataUrl} />;
        }
        return (
          <div className="grid w-44 grid-cols-3 gap-2 rounded-lg bg-[#3a2318] p-3 shadow-lg">
            {Array.from({ length: count }).map((_, i) => (
              <div
                key={i}
                className="aspect-square overflow-hidden border border-[#3a2318] bg-[#5b3a2a] bg-cover bg-center"
                style={{
                  ...shapeGeometry(shape),
                  ...(imageDataUrl ? { backgroundImage: `url(${imageDataUrl})` } : {}),
                }}
              />
            ))}
          </div>
        );
      }
    }

    if (shape === "number" || shape === "letter") {
      return <GlyphFrameWithStand category={category} character={character} imageDataUrl={imageDataUrl} />;
    }

    if (category === "custom-chocolates") {
      return (
        <ShapeFrame
          category={category}
          shape={shape}
          imageDataUrl={imageDataUrl}
          message={message}
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
            className="h-32 w-32"
          />
          <div className="h-10 w-1.5 bg-gold" />
        </div>
      );
    }

    return (
      <ShapeFrame category={category} shape={shape} imageDataUrl={imageDataUrl} message={message} />
    );
  }
}

function GlyphFrameWithStand({
  category,
  character,
  imageDataUrl,
}: {
  category: string;
  character: string;
  imageDataUrl?: string | null;
}) {
  if (category === "cake-toppers") {
    return (
      <div className="flex flex-col items-center">
        <GlyphFrame category={category} character={character} imageDataUrl={imageDataUrl} />
        <div className="h-10 w-1.5 bg-gold" />
      </div>
    );
  }
  return <GlyphFrame category={category} character={character} imageDataUrl={imageDataUrl} />;
}
