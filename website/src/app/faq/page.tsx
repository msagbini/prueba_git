import type { Metadata } from "next";
import Accordion from "@/components/Accordion";
import { STANDARD_LEAD_DAYS, RUSH_FEE } from "@/lib/leadTime";
import { FREE_SHIPPING_THRESHOLD, STANDARD_SHIPPING } from "@/lib/coupons";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Turnaround times, rush orders, allergens, shipping and payment questions answered.",
};

const faqs = [
  {
    question: "How long does a custom order take?",
    answer: `Our standard turnaround is ${STANDARD_LEAD_DAYS} business days from when we confirm your design. Need it sooner? Choose a rush date at checkout or on the custom order form and we'll prioritise it for a $${RUSH_FEE} rush fee, subject to availability.`,
  },
  {
    question: "Do you cater for allergies or dietary requirements?",
    answer:
      "Most of our edible images and cookies are made in a kitchen that handles nuts, gluten, egg and dairy. Let us know any allergies or dietary needs in the message box on your order and we'll confirm whether we can accommodate them before we start.",
  },
  {
    question: "Where do you ship, and how much does it cost?",
    answer: `We ship Australia-wide. Standard shipping is $${STANDARD_SHIPPING.toFixed(2)}, and it's free on orders over $${FREE_SHIPPING_THRESHOLD}. Fragile items are packed to survive the trip - if anything arrives damaged, send us a photo and we'll sort it out.`,
  },
  {
    question: "Can I change or cancel my order after I've placed it?",
    answer:
      "Since every item is made to order, changes can only be made before we start production - usually within 24 hours of ordering. Get in touch as soon as possible via the custom order form and we'll do our best to help.",
  },
  {
    question: "What payment methods do you accept?",
    answer:
      "We accept debit and credit cards, and PayPal, all through a secure checkout.",
  },
  {
    question: "Can I see what my order will look like before it's made?",
    answer:
      "Yes - every customisable product has a live preview that updates as you choose a shape, colour, photo or message, so you know exactly what you're getting before you order.",
  },
];

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl font-bold text-berry-dark">
        Frequently Asked Questions
      </h1>
      <p className="mt-2 text-foreground/70">
        Can&apos;t find your answer here? Reach out through our{" "}
        <a href="/custom-order" className="text-berry underline">
          custom order form
        </a>{" "}
        and we&apos;ll get back to you.
      </p>
      <div className="mt-8">
        <Accordion items={faqs} />
      </div>
    </div>
  );
}
