import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { products, getProduct } from "@/lib/products";
import StarRating from "@/components/StarRating";
import AddToCartForm from "@/components/AddToCartForm";

export function generateStaticParams() {
  return products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = getProduct(slug);
  return { title: product ? `${product.name} | Made with Grace` : "Product" };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) notFound();

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <Link
        href={`/shop/${product.category}`}
        className="text-sm text-berry hover:underline"
      >
        ← Back to category
      </Link>

      <div className="mt-6 grid gap-10 md:grid-cols-2">
        <div className="flex h-72 items-center justify-center rounded-2xl bg-blush text-8xl">
          {product.emoji}
        </div>

        <div>
          <h1 className="font-display text-3xl font-bold text-berry-dark">
            {product.name}
          </h1>
          <div className="mt-2">
            <StarRating rating={product.rating} reviewCount={product.reviewCount} />
          </div>
          <p className="mt-4 text-lg font-semibold text-berry">
            ${product.price.toFixed(2)}
          </p>
          <p className="mt-4 text-foreground/75">{product.description}</p>

          <div className="mt-8 rounded-2xl border border-berry/10 bg-white/70 p-6">
            <AddToCartForm product={product} />
          </div>

          <p className="mt-4 text-xs text-foreground/50">
            Need something more involved - multiple images, a bespoke shape,
            or a bulk event order? Use our{" "}
            <Link href="/custom-order" className="text-berry underline">
              full custom order form
            </Link>{" "}
            instead.
          </p>
        </div>
      </div>
    </div>
  );
}
