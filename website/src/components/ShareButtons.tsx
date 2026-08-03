"use client";

import { useState } from "react";

export default function ShareButtons({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  const handleShare = (network: "facebook" | "pinterest") => {
    const url = window.location.href;
    const target =
      network === "facebook"
        ? `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`
        : `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(
            url,
          )}&description=${encodeURIComponent(title)}`;
    window.open(target, "_blank", "noopener,noreferrer");
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold text-berry-dark">Share:</span>
      <button
        type="button"
        onClick={() => handleShare("facebook")}
        aria-label="Share on Facebook"
        className="flex h-8 w-8 items-center justify-center rounded-full border border-berry/20 text-sm transition hover:bg-blush"
      >
        📘
      </button>
      <button
        type="button"
        onClick={() => handleShare("pinterest")}
        aria-label="Share on Pinterest"
        className="flex h-8 w-8 items-center justify-center rounded-full border border-berry/20 text-sm transition hover:bg-blush"
      >
        📌
      </button>
      <button
        type="button"
        onClick={handleCopy}
        aria-label="Copy link"
        className="flex h-8 w-8 items-center justify-center rounded-full border border-berry/20 text-sm transition hover:bg-blush"
      >
        {copied ? "✅" : "🔗"}
      </button>
    </div>
  );
}
