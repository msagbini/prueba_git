export type Coupon =
  | { code: string; description: string; type: "percent"; value: number }
  | { code: string; description: string; type: "freeShipping" };

export const FREE_SHIPPING_THRESHOLD = 75;
export const STANDARD_SHIPPING = 9.95;

export const coupons: Coupon[] = [
  { code: "WELCOME10", type: "percent", value: 10, description: "10% off your first order" },
  { code: "FREESHIP", type: "freeShipping", description: "Free shipping on this order" },
];

export function findCoupon(input: string): Coupon | undefined {
  const normalized = input.trim().toUpperCase();
  return coupons.find((c) => c.code === normalized);
}
