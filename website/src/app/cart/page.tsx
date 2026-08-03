"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart-context";

export default function CartPage() {
  const { items, removeItem, updateQuantity, subtotal } = useCart();

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
        <h1 className="font-display text-3xl font-bold text-berry-dark">
          Your cart is empty
        </h1>
        <p className="mt-2 text-foreground/70">
          Browse our shop to find something sweet.
        </p>
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
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl font-bold text-berry-dark">
        Your Cart
      </h1>

      <div className="mt-6 space-y-4">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex flex-col gap-3 rounded-2xl border border-berry/10 bg-white/70 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-semibold text-berry-dark">{item.name}</p>
              {item.size && (
                <p className="text-sm text-foreground/60">Option: {item.size}</p>
              )}
              {item.note && (
                <p className="text-sm text-foreground/60">Note: {item.note}</p>
              )}
              <p className="text-sm text-foreground/60">
                ${item.price.toFixed(2)} each
              </p>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={1}
                value={item.quantity}
                onChange={(e) =>
                  updateQuantity(item.id, Number(e.target.value))
                }
                className="w-16 rounded-lg border border-berry/20 px-2 py-1 text-sm"
              />
              <span className="w-20 text-right font-semibold text-berry">
                ${(item.price * item.quantity).toFixed(2)}
              </span>
              <button
                onClick={() => removeItem(item.id)}
                className="text-sm text-red-500 hover:underline"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 flex items-center justify-between border-t border-berry/10 pt-6">
        <span className="text-lg font-semibold text-berry-dark">Subtotal</span>
        <span className="text-lg font-bold text-berry">
          ${subtotal.toFixed(2)}
        </span>
      </div>

      <Link
        href="/checkout"
        className="mt-6 block rounded-full bg-berry px-6 py-3 text-center font-semibold text-white transition hover:bg-berry-dark"
      >
        Proceed to Checkout
      </Link>
    </div>
  );
}
