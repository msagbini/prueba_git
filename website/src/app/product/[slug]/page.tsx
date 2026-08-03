import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { products, getProduct } from "@/lib/products";
import ProductCustomizer from "@/components/ProductCustomizer";

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
  return {
    title: product ? product.name : "Product",
    description: product?.description,
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) notFound();

  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    offers: {
      "@type": "Offer",
      price: product.price.toFixed(2),
      priceCurrency: "AUD",
      availability: "https://schema.org/InStock",
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: product.rating,
      reviewCount: product.reviewCount,
    },
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />
      <Link
        href={`/shop/${product.category}`}
        className="text-sm text-berry hover:underline"
      >
        ← Back to category
      </Link>

      <div className="mt-6">
        <ProductCustomizer product={product} />
      </div>
    </div>
  );
}
