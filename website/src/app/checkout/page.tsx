"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/lib/cart-context";
import { getLeadTimeStatus, RUSH_FEE } from "@/lib/leadTime";
import {
  findCoupon,
  FREE_SHIPPING_THRESHOLD,
  STANDARD_SHIPPING,
  EXPRESS_SURCHARGE,
  type Coupon,
} from "@/lib/coupons";
import LeadTimeNote from "@/components/LeadTimeNote";
import TrustBar from "@/components/TrustBar";

type PaymentMethod = "card" | "paypal";
type ShippingMethod = "standard" | "express";

export default function CheckoutPage() {
  const { items, subtotal, clear } = useCart();
  const [method, setMethod] = useState<PaymentMethod>("card");
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>("standard");
  const [placed, setPlaced] = useState(false);
  const [neededBy, setNeededBy] = useState("");
  const [rushAccepted, setRushAccepted] = useState(true);
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponError, setCouponError] = useState("");

  const leadTime = getLeadTimeStatus(neededBy);
  const needsRush = leadTime.status === "rush" && rushAccepted;

  const discount =
    appliedCoupon?.type === "percent" ? subtotal * (appliedCoupon.value / 100) : 0;
  const discountedSubtotal = subtotal - discount;
  const freeStandardShipping =
    discountedSubtotal >= FREE_SHIPPING_THRESHOLD || appliedCoupon?.type === "freeShipping";
  const shipping =
    shippingMethod === "express"
      ? (freeStandardShipping ? 0 : STANDARD_SHIPPING) + EXPRESS_SURCHARGE
      : freeStandardShipping
        ? 0
        : STANDARD_SHIPPING;
  const rushFee = needsRush ? RUSH_FEE : 0;
  const total = discountedSubtotal + shipping + rushFee;
  const amountToFreeShipping = FREE_SHIPPING_THRESHOLD - discountedSubtotal;

  const handleApplyCoupon = () => {
    const coupon = findCoupon(couponInput);
    if (!coupon) {
      setAppliedCoupon(null);
      setCouponError("That code isn't valid or has expired.");
      return;
    }
    setAppliedCoupon(coupon);
    setCouponError("");
  };

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
    <div>
      <TrustBar />
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
              <h2 className="font-semibold text-berry-dark">Shipping Method</h2>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setShippingMethod("standard")}
                  className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                    shippingMethod === "standard"
                      ? "border-berry bg-blush text-berry-dark"
                      : "border-berry/20 text-foreground/70"
                  }`}
                >
                  <span className="block font-medium">Standard</span>
                  <span className="text-xs">
                    3-5 business days ·{" "}
                    {freeStandardShipping ? "Free" : `$${STANDARD_SHIPPING.toFixed(2)}`}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setShippingMethod("express")}
                  className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                    shippingMethod === "express"
                      ? "border-berry bg-blush text-berry-dark"
                      : "border-berry/20 text-foreground/70"
                  }`}
                >
                  <span className="block font-medium">Express</span>
                  <span className="text-xs">
                    1-2 business days · +${EXPRESS_SURCHARGE.toFixed(2)}
                  </span>
                </button>
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-berry-dark">
                When do you need this by?
              </label>
              <input
                type="date"
                value={neededBy}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setNeededBy(e.target.value)}
                className="mt-1 w-full rounded-lg border border-berry/20 bg-white px-3 py-2 text-sm focus:border-berry focus:outline-none"
              />
              <LeadTimeNote date={neededBy} />
              {leadTime.status === "rush" && (
                <label className="mt-2 flex items-center gap-2 text-xs font-medium text-amber-800">
                  <input
                    type="checkbox"
                    checked={rushAccepted}
                    onChange={(e) => setRushAccepted(e.target.checked)}
                    className="h-4 w-4 rounded border-berry/30"
                  />
                  Add rush production (+${RUSH_FEE}) to make this date
                </label>
              )}
            </div>

            <div>
              <h2 className="font-semibold text-berry-dark">Discount code</h2>
              <div className="mt-2 flex gap-2">
                <input
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  placeholder="e.g. WELCOME10"
                  className="flex-1 rounded-lg border border-berry/20 bg-white px-3 py-2 text-sm uppercase focus:border-berry focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleApplyCoupon}
                  className="rounded-lg border border-berry px-4 text-sm font-semibold text-berry-dark hover:bg-blush"
                >
                  Apply
                </button>
              </div>
              {couponError && (
                <p className="mt-1 text-xs text-red-600">{couponError}</p>
              )}
              {appliedCoupon && (
                <p className="mt-1 text-xs font-medium text-green-700">
                  ✓ &ldquo;{appliedCoupon.code}&rdquo; applied - {appliedCoupon.description}
                </p>
              )}
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
              Place Order - ${total.toFixed(2)}
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

            {!freeStandardShipping && amountToFreeShipping > 0 && (
              <p className="mt-3 rounded-lg bg-lavender/50 px-3 py-2 text-xs font-medium text-berry-dark">
                Add ${amountToFreeShipping.toFixed(2)} more to get free standard shipping 🚚
              </p>
            )}

            <div className="mt-4 space-y-1 border-t border-berry/10 pt-4 text-sm">
              <div className="flex justify-between text-foreground/70">
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-green-700">
                  <span>Discount ({appliedCoupon?.code})</span>
                  <span>-${discount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-foreground/70">
                <span>Shipping ({shippingMethod === "express" ? "Express" : "Standard"})</span>
                <span>{shipping === 0 ? "Free" : `$${shipping.toFixed(2)}`}</span>
              </div>
              {rushFee > 0 && (
                <div className="flex justify-between text-foreground/70">
                  <span>Rush production</span>
                  <span>${rushFee.toFixed(2)}</span>
                </div>
              )}
            </div>
            <div className="mt-2 flex justify-between border-t border-berry/10 pt-3 font-semibold text-berry">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
