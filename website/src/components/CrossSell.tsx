import Link from "next/link";
import { categories, getProductsByCategory } from "@/lib/products";

export default function CrossSell({ currentCategory }: { currentCategory: string }) {
  const picks = categories
    .filter((c) => c.slug !== currentCategory)
    .map((c) => getProductsByCategory(c.slug)[0])
    .filter(Boolean)
    .slice(0, 3);

  if (picks.length === 0) return null;

  return (
    <div className="mt-10 border-t border-berry/10 pt-6">
      <h2 className="font-display text-lg font-semibold text-berry-dark">
        Complete the celebration
      </h2>
      <p className="mt-1 text-sm text-foreground/60">
        Customers who order this often add one of these too.
      </p>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {picks.map((product) => (
          <Link
            key={product.slug}
            href={`/product/${product.slug}`}
            className="group rounded-xl border border-berry/10 bg-white/70 p-3 text-center transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex h-14 items-center justify-center rounded-lg bg-blush text-2xl">
              {product.emoji}
            </div>
            <p className="mt-2 text-xs font-semibold text-berry-dark">
              {product.name}
            </p>
            <p className="text-xs text-foreground/60">
              from ${product.price.toFixed(2)}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
