export type Category = {
  slug: string;
  name: string;
  tagline: string;
  emoji: string;
};

export type Product = {
  slug: string;
  name: string;
  category: string;
  price: number;
  description: string;
  emoji: string;
  customizable: boolean;
  sizes?: string[];
  rating: number;
  reviewCount: number;
};

export const categories: Category[] = [
  {
    slug: "edible-images",
    name: "Edible Images",
    tagline: "Print any design onto cakes, cupcakes & cookies",
    emoji: "🖼️",
  },
  {
    slug: "cookie-cutters",
    name: "Cookie Cutters",
    tagline: "Ready-made shapes or fully custom cut to your design",
    emoji: "🍪",
  },
  {
    slug: "custom-chocolates",
    name: "Custom Chocolates",
    tagline: "Personalised chocolates with your image, logo or message",
    emoji: "🍫",
  },
  {
    slug: "cake-toppers",
    name: "Cake Toppers",
    tagline: "Cardstock toppers for any theme or celebration",
    emoji: "🎂",
  },
];

export const products: Product[] = [
  {
    slug: "custom-edible-image-a4",
    name: "Custom Edible Image - A4 Sheet",
    category: "edible-images",
    price: 18,
    description:
      "Upload your own photo, logo or artwork and we'll print it onto a premium edible wafer or icing sheet, sized to fit your cake.",
    emoji: "🖼️",
    customizable: true,
    sizes: ["Round 20cm", "Round 25cm", "A4 Rectangle", "Cupcake Set (12)"],
    rating: 5,
    reviewCount: 34,
  },
  {
    slug: "birthday-edible-image-pack",
    name: "Birthday Edible Image Pack",
    category: "edible-images",
    price: 15,
    description:
      "Choose from our ready-made birthday designs, or send us your own image to personalise it.",
    emoji: "🎉",
    customizable: true,
    sizes: ["Round 20cm", "Round 25cm", "A4 Rectangle"],
    rating: 4.8,
    reviewCount: 21,
  },
  {
    slug: "classic-shapes-set",
    name: "Classic Shapes Cutter Set",
    category: "cookie-cutters",
    price: 22,
    description:
      "A set of 6 ready-made stainless steel cutters - hearts, stars, circles and more.",
    emoji: "🍪",
    customizable: false,
    rating: 4.9,
    reviewCount: 58,
    sizes: ["Small", "Medium", "Large"],
  },
  {
    slug: "custom-shape-cutter",
    name: "Custom Shape Cookie Cutter",
    category: "cookie-cutters",
    price: 12,
    description:
      "Send us your design - a logo, character or initial - and we'll 3D print a custom cutter just for you.",
    emoji: "✂️",
    customizable: true,
    sizes: ["6cm", "8cm", "10cm", "12cm"],
    rating: 5,
    reviewCount: 42,
  },
  {
    slug: "custom-photo-chocolates",
    name: "Custom Photo Chocolate Box",
    category: "custom-chocolates",
    price: 28,
    description:
      "A box of 9 Belgian chocolates, each printed with a photo, logo or short message of your choice.",
    emoji: "🍫",
    customizable: true,
    sizes: ["Box of 9", "Box of 16", "Box of 25"],
    rating: 5,
    reviewCount: 47,
  },
  {
    slug: "message-chocolate-bar",
    name: "Personalised Message Chocolate Bar",
    category: "custom-chocolates",
    price: 14,
    description:
      "A large chocolate bar with your custom text or short message piped in white or dark chocolate.",
    emoji: "🍫",
    customizable: true,
    rating: 4.7,
    reviewCount: 19,
  },
  {
    slug: "custom-cake-topper",
    name: "Custom Themed Cake Topper",
    category: "cake-toppers",
    price: 16,
    description:
      "Cardstock topper designed around your theme - names, ages, characters, anything you like.",
    emoji: "🎂",
    customizable: true,
    sizes: ["Small (10cm)", "Medium (15cm)", "Large (20cm)"],
    rating: 4.9,
    reviewCount: 29,
  },
  {
    slug: "name-age-topper",
    name: "Name & Age Topper Set",
    category: "cake-toppers",
    price: 13,
    description:
      "A matching name and age topper set, colour-matched to your party theme.",
    emoji: "🎈",
    customizable: true,
    rating: 4.8,
    reviewCount: 16,
  },
];

export function getCategory(slug: string) {
  return categories.find((c) => c.slug === slug);
}

export function getProductsByCategory(slug: string) {
  return products.filter((p) => p.category === slug);
}

export function getProduct(slug: string) {
  return products.find((p) => p.slug === slug);
}
