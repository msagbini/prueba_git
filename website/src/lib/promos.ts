export type Promo = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
  emoji: string;
};

// Edit this list to run seasonal campaigns - add, remove or reorder slides
// any time without touching a single line of layout code.
export const promos: Promo[] = [
  {
    id: "custom-order",
    eyebrow: "Made just for you",
    title: "Sweet details, made with grace",
    description:
      "Upload your photo or idea and watch it come to life before you order.",
    ctaLabel: "Start a Custom Order",
    ctaHref: "/custom-order",
    emoji: "🎂",
  },
  {
    id: "birthday",
    eyebrow: "Birthday season",
    title: "Turn any birthday into a showstopper",
    description:
      "Custom number toppers, photo cookies and message chocolates - ready in as little as 5 business days.",
    ctaLabel: "Shop Cake Toppers",
    ctaHref: "/shop/cake-toppers",
    emoji: "🎉",
  },
  {
    id: "weddings-events",
    eyebrow: "Weddings & events",
    title: "Favours your guests will actually keep",
    description:
      "Bulk chocolate and edible image orders for weddings, engagements and corporate events.",
    ctaLabel: "Get a Quote",
    ctaHref: "/custom-order",
    emoji: "💍",
  },
];
