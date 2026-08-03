import Link from "next/link";
import { categories, products } from "@/lib/products";
import ProductCard from "@/components/ProductCard";
import StarRating from "@/components/StarRating";
import TrustBar from "@/components/TrustBar";
import PromoCarousel from "@/components/PromoCarousel";

const featured = products.filter((p) => p.rating >= 4.9).slice(0, 4);

export default function Home() {
  return (
    <div>
      <TrustBar />
      <PromoCarousel />

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="font-display text-2xl font-semibold text-berry-dark">
          Shop by Category
        </h2>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((category) => (
            <Link
              key={category.slug}
              href={`/shop/${category.slug}`}
              className="group rounded-2xl border border-berry/10 bg-white/70 p-6 text-center shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="text-4xl">{category.emoji}</div>
              <h3 className="mt-3 font-display text-lg font-semibold text-berry-dark">
                {category.name}
              </h3>
              <p className="mt-1 text-sm text-foreground/60">
                {category.tagline}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-lavender/30 py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="font-display text-2xl font-semibold text-berry-dark">
            Customer Favourites
          </h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((product) => (
              <ProductCard key={product.slug} product={product} />
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="font-display text-2xl font-semibold text-berry-dark">
          What our customers say
        </h2>
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          {[
            {
              name: "Melissa T.",
              quote:
                "The custom cake topper was even better than I imagined - ordering online was so easy!",
            },
            {
              name: "Priya S.",
              quote:
                "Uploaded a photo of our dog for the edible image and it printed perfectly. Will order again.",
            },
            {
              name: "Aiden K.",
              quote:
                "Fast turnaround and the chocolates were a huge hit at the office party.",
            },
          ].map((review) => (
            <div
              key={review.name}
              className="rounded-2xl border border-berry/10 bg-white/70 p-6 shadow-sm"
            >
              <StarRating rating={5} />
              <p className="mt-3 text-sm italic text-foreground/80">
                &ldquo;{review.quote}&rdquo;
              </p>
              <p className="mt-3 text-sm font-semibold text-berry-dark">
                {review.name}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-berry py-14 text-center text-white">
        <div className="mx-auto max-w-2xl px-4 sm:px-6">
          <h2 className="font-display text-3xl font-semibold">
            Have something specific in mind?
          </h2>
          <p className="mt-3 text-white/90">
            Upload your image or describe your idea and we&apos;ll create
            something one-of-a-kind for your event.
          </p>
          <Link
            href="/custom-order"
            className="mt-6 inline-block rounded-full bg-white px-8 py-3 font-semibold text-berry-dark transition hover:bg-blush"
          >
            Start Your Custom Order
          </Link>
        </div>
      </section>
    </div>
  );
}
