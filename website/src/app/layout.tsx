import type { Metadata } from "next";
import { Playfair_Display, Nunito } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/lib/cart-context";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
});

const SITE_URL = "https://madewithgrace.com.au";
const title = "Made with Grace | Custom Edible Images, Cookie Cutters & Chocolates";
const description =
  "Custom edible images, cookie cutters, chocolates and cake toppers for every celebration. Handmade in Western Australia, shipped Australia-wide. See your order before you buy with our live design preview.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: title,
    template: "%s | Made with Grace",
  },
  description,
  openGraph: {
    title,
    description,
    url: SITE_URL,
    siteName: "Made with Grace",
    locale: "en_AU",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${playfair.variable} ${nunito.variable} h-full`}>
      <body className="flex min-h-full flex-col antialiased">
        <CartProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </CartProvider>
      </body>
    </html>
  );
}
