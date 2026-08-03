"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { products } from "@/lib/products";

export default function SearchBox() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const q = query.trim().toLowerCase();
  const results =
    q.length > 0
      ? products
          .filter(
            (p) =>
              p.name.toLowerCase().includes(q) ||
              p.description.toLowerCase().includes(q) ||
              p.category.toLowerCase().includes(q),
          )
          .slice(0, 6)
      : [];

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label="Search products"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-berry/20 text-berry-dark transition hover:bg-blush"
      >
        <span aria-hidden="true">🔍</span>
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-72 rounded-2xl border border-berry/10 bg-white p-3 shadow-lg sm:w-80">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
            placeholder="Search products..."
            className="w-full rounded-lg border border-berry/20 bg-white px-3 py-2 text-sm focus:border-berry focus:outline-none"
          />
          {q.length > 0 && (
            <div className="mt-2 max-h-80 overflow-y-auto">
              {results.length === 0 ? (
                <p className="px-2 py-3 text-sm text-foreground/60">
                  No products match &ldquo;{query}&rdquo;. Try our{" "}
                  <Link
                    href="/custom-order"
                    onClick={() => setOpen(false)}
                    className="text-berry underline"
                  >
                    custom order form
                  </Link>{" "}
                  instead.
                </p>
              ) : (
                <ul className="space-y-1">
                  {results.map((p) => (
                    <li key={p.slug}>
                      <Link
                        href={`/product/${p.slug}`}
                        onClick={() => {
                          setOpen(false);
                          setQuery("");
                        }}
                        className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-blush"
                      >
                        <span className="text-xl" aria-hidden="true">
                          {p.emoji}
                        </span>
                        <span className="flex-1">
                          <span className="block font-medium text-berry-dark">{p.name}</span>
                          <span className="text-xs text-foreground/60">
                            from ${p.price.toFixed(2)}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
