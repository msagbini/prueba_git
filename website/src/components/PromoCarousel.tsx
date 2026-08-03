"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { promos } from "@/lib/promos";

export default function PromoCarousel() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % promos.length), 6000);
    return () => clearInterval(id);
  }, []);

  const promo = promos[index];

  return (
    <section className="bg-gradient-to-b from-blush to-cream">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-8 px-4 py-16 text-center sm:px-6 md:py-24">
        <span className="rounded-full bg-white/70 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-berry-dark">
          {promo.eyebrow}
        </span>
        <h1 className="font-display text-4xl font-bold leading-tight text-berry-dark md:text-6xl">
          {promo.title}
        </h1>
        <p className="max-w-xl text-base text-foreground/70 md:text-lg">
          {promo.description}
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href={promo.ctaHref}
            className="rounded-full bg-berry px-8 py-3 font-semibold text-white transition hover:bg-berry-dark"
          >
            {promo.ctaLabel}
          </Link>
          <Link
            href="/shop"
            className="rounded-full border border-berry px-8 py-3 font-semibold text-berry-dark transition hover:bg-white"
          >
            Shop All Products
          </Link>
        </div>

        <div className="mt-2 flex gap-2">
          {promos.map((p, i) => (
            <button
              key={p.id}
              type="button"
              aria-label={`Show slide ${i + 1}: ${p.title}`}
              aria-current={i === index}
              onClick={() => setIndex(i)}
              className={`h-2 rounded-full transition-all ${
                i === index ? "w-6 bg-berry" : "w-2 bg-berry/30 hover:bg-berry/50"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
