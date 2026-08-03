import { FREE_SHIPPING_THRESHOLD } from "@/lib/coupons";

const items = [
  { icon: "🚚", text: `Free shipping over $${FREE_SHIPPING_THRESHOLD}` },
  { icon: "🔒", text: "Secure checkout" },
  { icon: "🇦🇺", text: "Australian owned & made" },
  { icon: "✅", text: "100% satisfaction guarantee" },
];

export default function TrustBar() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-y border-berry/10 bg-lavender/30 px-4 py-3 text-xs font-medium text-berry-dark sm:text-sm">
      {items.map((item) => (
        <span key={item.text} className="flex items-center gap-1.5">
          <span aria-hidden="true">{item.icon}</span>
          {item.text}
        </span>
      ))}
    </div>
  );
}
