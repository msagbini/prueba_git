"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/lib/cart-context";
import { categories } from "@/lib/products";

export default function Header() {
  const [open, setOpen] = useState(false);
  const { count } = useCart();

  const navLinks = [
    ...categories.map((c) => ({ href: `/shop/${c.slug}`, label: c.name })),
    { href: "/custom-order", label: "Custom Order" },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-berry/10 bg-cream/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="font-display text-2xl font-bold text-berry">
          Made <span className="italic text-gold">with</span> Grace
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-foreground/80 transition hover:text-berry"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <Link
            href="/cart"
            className="relative flex items-center gap-1 rounded-full border border-berry/20 px-3 py-1.5 text-sm font-medium text-berry-dark transition hover:bg-blush"
            aria-label="View cart"
          >
            <span aria-hidden="true">🛍️</span>
            <span>Cart</span>
            {count > 0 && (
              <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-berry text-xs font-semibold text-white">
                {count}
              </span>
            )}
          </Link>
          <button
            className="text-2xl md:hidden"
            aria-label="Toggle menu"
            onClick={() => setOpen((prev) => !prev)}
          >
            {open ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {open && (
        <nav className="flex flex-col gap-1 border-t border-berry/10 bg-cream px-4 py-3 md:hidden">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-blush hover:text-berry"
              onClick={() => setOpen(false)}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
