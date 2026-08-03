import Link from "next/link";
import type { Metadata } from "next";
import { categories } from "@/lib/products";

export const metadata: Metadata = {
  title: "Shop",
  description:
    "Browse edible images, cookie cutters, custom chocolates and cake toppers - all made to order.",
};

export default function ShopPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl font-bold text-berry-dark">
        Browse by Category
      </h1>
      <p className="mt-2 max-w-xl text-foreground/70">
        Every item can be made just for you - pick a category to see
        ready-made designs or start a fully custom order.
      </p>
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {categories.map((category) => (
          <Link
            key={category.slug}
            href={`/shop/${category.slug}`}
            className="group rounded-2xl border border-berry/10 bg-white/70 p-6 text-center shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
          >
            <div className="text-4xl">{category.emoji}</div>
            <h2 className="mt-3 font-display text-lg font-semibold text-berry-dark">
              {category.name}
            </h2>
            <p className="mt-1 text-sm text-foreground/60">
              {category.tagline}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
