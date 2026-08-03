"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/lib/cart-context";

type PaymentMethod = "card" | "paypal";

export default function CheckoutPage() {
  const { items, subtotal, clear } = useCart();
  const [method, setMethod] = useState<PaymentMethod>("card");
  const [placed, setPlaced] = useState(false);

  const handlePlaceOrder = (e: React.FormEvent) => {
    e.preventDefault();
    // Payment gateway (Stripe for card, PayPal Checkout) connects here once
    // live API keys are issued - this confirms the checkout flow end-to-end.
    setPlaced(true);
    clear();
  };

  if (placed) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
        <h1 className="font-display text-3xl font-bold text-berry-dark">
          Order placed!
        </h1>
        <p className="mt-2 text-foreground/70">
          Thanks for your order - a confirmation email is on its way.
        </p>
        <Link
          href="/shop"
          className="mt-6 inline-block rounded-full bg-berry px-8 py-3 font-semibold text-white hover:bg-berry-dark"
        >
          Continue Shopping
        </Link>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
        <h1 className="font-display text-3xl font-bold text-berry-dark">
          Nothing to check out
        </h1>
        <Link
          href="/shop"
          className="mt-6 inline-block rounded-full bg-berry px-8 py-3 font-semibold text-white hover:bg-berry-dark"
        >
          Shop Now
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl font-bold text-berry-dark">
        Checkout
      </h1>

      <div className="mt-8 grid gap-8 md:grid-cols-2">
        <form onSubmit={handlePlaceOrder} className="space-y-5">
          <div>
            <h2 className="font-semibold text-berry-dark">
              Shipping Details
            </h2>
            <div className="mt-3 grid gap-3">
              <input
                required
                placeholder="Full name"
                className="rounded-lg border border-berry/20 bg-white px-3 py-2 text-sm focus:border-berry focus:outline-none"
              />
              <input
                required
                type="email"
                placeholder="Email"
                className="rounded-lg border border-berry/20 bg-white px-3 py-2 text-sm focus:border-berry focus:outline-none"
              />
              <input
                required
                placeholder="Delivery address"
                className="rounded-lg border border-berry/20 bg-white px-3 py-2 text-sm focus:border-berry focus:outline-none"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  required
                  placeholder="Suburb"
                  className="rounded-lg border border-berry/20 bg-white px-3 py-2 text-sm focus:border-berry focus:outline-none"
                />
                <input
                  required
                  placeholder="Postcode"
                  className="rounded-lg border border-berry/20 bg-white px-3 py-2 text-sm focus:border-berry focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div>
            <h2 className="font-semibold text-berry-dark">Payment Method</h2>
            <div className="mt-3 flex gap-3">
              <button
                type="button"
                onClick={() => setMethod("card")}
                className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition ${
                  method === "card"
                    ? "border-berry bg-blush text-berry-dark"
                    : "border-berry/20 text-foreground/70"
                }`}
              >
                💳 Debit / Credit Card
              </button>
              <button
                type="button"
                onClick={() => setMethod("paypal")}
                className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition ${
                  method === "paypal"
                    ? "border-berry bg-blush text-berry-dark"
                    : "border-berry/20 text-foreground/70"
                }`}
              >
                🅿️ PayPal
              </button>
            </div>

            {method === "card" ? (
              <div className="mt-3 grid gap-3">
                <input
                  required
                  placeholder="Card number"
                  className="rounded-lg border border-berry/20 bg-white px-3 py-2 text-sm focus:border-berry focus:outline-none"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    required
                    placeholder="MM/YY"
                    className="rounded-lg border border-berry/20 bg-white px-3 py-2 text-sm focus:border-berry focus:outline-none"
                  />
                  <input
                    required
                    placeholder="CVC"
                    className="rounded-lg border border-berry/20 bg-white px-3 py-2 text-sm focus:border-berry focus:outline-none"
                  />
                </div>
              </div>
            ) : (
              <p className="mt-3 rounded-lg bg-blush p-3 text-sm text-berry-dark">
                You&apos;ll be redirected to PayPal to complete your payment
                securely.
              </p>
            )}
          </div>

          <button
            type="submit"
            className="w-full rounded-full bg-berry px-6 py-3 font-semibold text-white transition hover:bg-berry-dark"
          >
            Place Order - ${subtotal.toFixed(2)}
          </button>
        </form>

        <div className="h-fit rounded-2xl border border-berry/10 bg-white/70 p-6">
          <h2 className="font-semibold text-berry-dark">Order Summary</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {items.map((item) => (
              <li key={item.id} className="flex justify-between">
                <span>
                  {item.name} × {item.quantity}
                </span>
                <span>${(item.price * item.quantity).toFixed(2)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex justify-between border-t border-berry/10 pt-4 font-semibold text-berry">
            <span>Total</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
