import Link from "next/link";
import { categories } from "@/lib/products";
import NewsletterSignup from "@/components/NewsletterSignup";

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-berry/10 bg-lavender/40">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-4">
        <div>
          <h4 className="font-display text-xl font-semibold text-berry-dark">
            Made with Grace
          </h4>
          <p className="mt-2 text-sm text-foreground/70">
            Custom edible images, cookie cutters, chocolates & cake toppers,
            handmade in Western Australia and shipped nationwide.
          </p>
        </div>
        <div>
          <h5 className="font-semibold text-berry-dark">Shop</h5>
          <ul className="mt-2 space-y-1 text-sm text-foreground/70">
            {categories.map((c) => (
              <li key={c.slug}>
                <Link href={`/shop/${c.slug}`} className="hover:text-berry">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h5 className="font-semibold text-berry-dark">Help</h5>
          <ul className="mt-2 space-y-1 text-sm text-foreground/70">
            <li>
              <Link href="/custom-order" className="hover:text-berry">
                Custom Order Form
              </Link>
            </li>
            <li>
              <Link href="/faq" className="hover:text-berry">
                FAQ
              </Link>
            </li>
            <li>
              <Link href="/cart" className="hover:text-berry">
                Your Cart
              </Link>
            </li>
            <li>Shipping Australia-wide</li>
            <li>hello@madewithgrace.com.au</li>
          </ul>
        </div>
        <div>
          <h5 className="font-semibold text-berry-dark">Get 10% off</h5>
          <p className="mt-2 text-sm text-foreground/70">
            Join our list for first-order savings and new design drops.
          </p>
          <div className="mt-3">
            <NewsletterSignup />
          </div>
        </div>
      </div>
      <div className="border-t border-berry/10 py-4 text-center text-xs text-foreground/50">
        © {new Date().getFullYear()} Made with Grace. All rights reserved.
      </div>
    </footer>
  );
}
