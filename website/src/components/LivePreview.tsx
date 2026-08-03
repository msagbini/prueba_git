"use client";

const CUTTER_OUTLINE =
  "polygon(50% 8%, 61% 0%, 74% 4%, 82% 15%, 82% 30%, 68% 52%, 50% 72%, 32% 52%, 18% 30%, 18% 15%, 26% 4%, 39% 0%)";

function ChocolateTile({
  imageDataUrl,
  message,
}: {
  imageDataUrl?: string | null;
  message?: string;
}) {
  return (
    <div
      className="flex aspect-square items-center justify-center overflow-hidden rounded-md border border-[#5b3a2a] bg-[#5b3a2a] bg-cover bg-center text-[9px] font-semibold leading-tight text-amber-100"
      style={imageDataUrl ? { backgroundImage: `url(${imageDataUrl})` } : undefined}
    >
      {!imageDataUrl && (message ? message.slice(0, 10) : "")}
    </div>
  );
}

export default function LivePreview({
  category,
  size,
  imageDataUrl,
  message,
}: {
  category: string;
  size?: string;
  imageDataUrl?: string | null;
  message?: string;
}) {
  const hasContent = Boolean(imageDataUrl || message);

  return (
    <div className="flex h-72 flex-col items-center justify-center gap-3 rounded-2xl bg-blush p-6">
      {renderShape()}
      {hasContent && (
        <p className="text-center text-xs font-medium text-berry-dark">
          Live preview - your actual item may vary slightly
        </p>
      )}
    </div>
  );

  function renderShape() {
    if (category === "edible-images") {
      if (size?.toLowerCase().includes("cupcake")) {
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
      const isRound = size?.toLowerCase().includes("round");
      return (
        <div
          className={`flex items-center justify-center border-4 border-white bg-white bg-cover bg-center shadow-lg ${
            isRound ? "h-40 w-40 rounded-full" : "h-32 w-44 rounded-lg"
          }`}
          style={imageDataUrl ? { backgroundImage: `url(${imageDataUrl})` } : undefined}
        >
          {!imageDataUrl && <span className="text-3xl">🖼️</span>}
        </div>
      );
    }

    if (category === "cookie-cutters") {
      return (
        <div className="relative flex h-40 w-40 items-center justify-center">
          <div
            className="absolute inset-0 bg-white bg-cover bg-center opacity-70"
            style={{
              clipPath: CUTTER_OUTLINE,
              ...(imageDataUrl ? { backgroundImage: `url(${imageDataUrl})` } : {}),
            }}
          />
          <div
            className="absolute inset-0 border-[3px] border-dashed border-berry-dark/70"
            style={{ clipPath: CUTTER_OUTLINE }}
          />
          {!imageDataUrl && <span className="relative text-3xl">✂️</span>}
        </div>
      );
    }

    if (category === "custom-chocolates") {
      const boxMatch = size?.match(/box of (\d+)/i);
      if (boxMatch) {
        const count = Math.min(9, Number(boxMatch[1]));
        return (
          <div className="grid w-44 grid-cols-3 gap-2 rounded-lg bg-[#3a2318] p-3 shadow-lg">
            {Array.from({ length: count }).map((_, i) => (
              <ChocolateTile key={i} imageDataUrl={imageDataUrl} message={message} />
            ))}
          </div>
        );
      }
      return (
        <div
          className="flex h-24 w-48 items-center justify-center gap-1 rounded-lg border-2 border-[#3a2318] bg-[#5b3a2a] bg-cover bg-center px-3 shadow-lg"
          style={imageDataUrl ? { backgroundImage: `url(${imageDataUrl})` } : undefined}
        >
          {!imageDataUrl && (
            <span className="text-center text-xs font-semibold text-amber-100">
              {message ? message.slice(0, 24) : "🍫"}
            </span>
          )}
        </div>
      );
    }

    if (category === "cake-toppers") {
      return (
        <div className="flex flex-col items-center">
          <div
            className="flex h-24 w-32 items-center justify-center rounded-xl border-2 border-gold bg-white bg-cover bg-center p-2 text-center shadow-lg"
            style={imageDataUrl ? { backgroundImage: `url(${imageDataUrl})` } : undefined}
          >
            <span className="font-display text-sm font-semibold italic text-berry-dark">
              {message ? message.slice(0, 20) : "Your text here"}
            </span>
          </div>
          <div className="h-10 w-1.5 bg-gold" />
        </div>
      );
    }

    return <span className="text-4xl">✨</span>;
  }
}
