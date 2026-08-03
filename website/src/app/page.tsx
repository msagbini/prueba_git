import Link from "next/link";
import { categories, products } from "@/lib/products";
import ProductCard from "@/components/ProductCard";
import StarRating from "@/components/StarRating";

const featured = products.filter((p) => p.rating >= 4.9).slice(0, 4);

export default function Home() {
  return (
    <div>
      <section className="bg-gradient-to-b from-blush to-cream">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-8 px-4 py-16 text-center sm:px-6 md:py-24">
          <span className="rounded-full bg-white/70 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-berry-dark">
            Handmade in Western Australia · Shipped Australia-wide
          </span>
          <h1 className="font-display text-4xl font-bold leading-tight text-berry-dark md:text-6xl">
            Sweet details, made with grace
          </h1>
          <p className="max-w-xl text-base text-foreground/70 md:text-lg">
            Custom edible images, cookie cutters, chocolates and cake toppers
            for birthdays, weddings and every celebration in between. Upload
            your photo or idea and we&apos;ll bring it to life.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/shop"
              className="rounded-full bg-berry px-8 py-3 font-semibold text-white transition hover:bg-berry-dark"
            >
              Shop All Products
            </Link>
            <Link
              href="/custom-order"
              className="rounded-full border border-berry px-8 py-3 font-semibold text-berry-dark transition hover:bg-white"
            >
              Start a Custom Order
            </Link>
          </div>
        </div>
      </section>

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
