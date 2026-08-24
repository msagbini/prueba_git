"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/lib/cart-context";
import QuantityStepper from "@/components/QuantityStepper";
import ConfirmDialog from "@/components/ConfirmDialog";

export default function CartPage() {
  const { items, removeItem, updateQuantity, subtotal } = useCart();
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const pendingItem = items.find((i) => i.id === pendingRemoveId);

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
              <QuantityStepper
                quantity={item.quantity}
                onChange={(q) => updateQuantity(item.id, q)}
              />
              <span className="w-20 text-right font-semibold text-berry">
                ${(item.price * item.quantity).toFixed(2)}
              </span>
              <button
                onClick={() => setPendingRemoveId(item.id)}
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

      <ConfirmDialog
        open={pendingRemoveId !== null}
        title="Remove this item?"
        description={
          pendingItem
            ? `"${pendingItem.name}" will be removed from your cart.`
            : undefined
        }
        confirmLabel="Remove"
        cancelLabel="Keep it"
        onConfirm={() => {
          if (pendingRemoveId) removeItem(pendingRemoveId);
          setPendingRemoveId(null);
        }}
        onCancel={() => setPendingRemoveId(null)}
      />
    </div>
  );
}
