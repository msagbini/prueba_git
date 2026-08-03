import Link from "next/link";
import type { Product } from "@/lib/products";
import StarRating from "@/components/StarRating";

export default function ProductCard({ product }: { product: Product }) {
  return (
    <Link
      href={`/product/${product.slug}`}
      className="group flex flex-col rounded-2xl border border-berry/10 bg-white/70 p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
    >
      <div className="mb-4 flex h-32 items-center justify-center rounded-xl bg-blush text-5xl">
        {product.emoji}
      </div>
      <h3 className="font-display text-lg font-semibold text-berry-dark">
        {product.name}
      </h3>
      <p className="mt-1 line-clamp-2 text-sm text-foreground/70">
        {product.description}
      </p>
      <div className="mt-3 flex items-center justify-between">
        <StarRating rating={product.rating} reviewCount={product.reviewCount} />
        <span className="font-semibold text-berry">
          from ${product.price.toFixed(2)}
        </span>
      </div>
      {product.customizable && (
        <span className="mt-3 inline-block w-fit rounded-full bg-lavender px-3 py-1 text-xs font-medium text-berry-dark">
          Personalise this item
        </span>
      )}
    </Link>
  );
}
