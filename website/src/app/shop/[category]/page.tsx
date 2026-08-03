import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  categories,
  getCategory,
  getProductsByCategory,
} from "@/lib/products";
import ProductCard from "@/components/ProductCard";

export function generateStaticParams() {
  return categories.map((c) => ({ category: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category: slug } = await params;
  const category = getCategory(slug);
  return { title: category ? `${category.name} | Made with Grace` : "Shop" };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category: slug } = await params;
  const category = getCategory(slug);
  if (!category) notFound();

  const items = getProductsByCategory(slug);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <Link href="/shop" className="text-sm text-berry hover:underline">
        ← All categories
      </Link>
      <h1 className="mt-3 font-display text-3xl font-bold text-berry-dark">
        {category.emoji} {category.name}
      </h1>
      <p className="mt-2 max-w-xl text-foreground/70">{category.tagline}</p>

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((product) => (
          <ProductCard key={product.slug} product={product} />
        ))}
      </div>

      <div className="mt-10 rounded-2xl bg-lavender/40 p-6 text-center">
        <p className="font-medium text-berry-dark">
          Can&apos;t find exactly what you&apos;re after?
        </p>
        <Link
          href="/custom-order"
          className="mt-3 inline-block rounded-full bg-berry px-6 py-2 font-semibold text-white hover:bg-berry-dark"
        >
          Submit a Custom Order
        </Link>
      </div>
    </div>
  );
}
