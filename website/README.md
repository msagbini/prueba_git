# Made with Grace — Website

Custom storefront for Grace's edible images, cookie cutters, custom
chocolates and cake toppers business. Built with Next.js (App Router),
TypeScript and Tailwind CSS — fully custom code, not a page-builder
template.

## What's implemented

- **Browse by category** — Edible Images, Cookie Cutters, Custom Chocolates,
  Cake Toppers (`src/lib/products.ts` holds the catalog; swap in real
  products/photos here).
- **Product pages** with size/option selection, image upload, and a message
  box for personalisation, feeding into a cart (`src/lib/cart-context.tsx`,
  persisted to `localStorage`).
- **Custom Order form** (`/custom-order`) with name/email/category/image
  upload/message, posting to `POST /api/custom-order`.
- **Cart + Checkout** (`/cart`, `/checkout`) with a card/PayPal method
  toggle and an order summary.
- **Reviews/star ratings** on products and a testimonials section on the
  homepage.
- Mobile-first responsive layout, custom brand palette (berry/blush/
  lavender/gold) distinct from competitors' templates.

## What's stubbed for launch (needs real accounts/keys, not code rewrites)

1. **Payment processing** — `/checkout` collects card/PayPal details but
   doesn't charge anything yet. Wire up Stripe Checkout (cards) and PayPal
   Checkout once Grace has live accounts.
2. **Image uploads** — form/product uploads currently pass through the
   browser only. Needs an object storage bucket (e.g. Cloudinary, S3,
   Supabase Storage) to persist files.
3. **Order notifications** — `POST /api/custom-order` validates and
   acknowledges submissions; needs an email provider (Resend/Postmark) to
   notify Grace and the customer.
4. **Inventory, coupons, analytics** — straightforward additions once the
   product catalog moves from the static file into a database (or a
   headless commerce backend).

## Development

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`.
