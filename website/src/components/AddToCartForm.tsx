"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart-context";
import type { Product } from "@/lib/products";

export default function AddToCartForm({ product }: { product: Product }) {
  const { addItem } = useCart();
  const router = useRouter();
  const [size, setSize] = useState(product.sizes?.[0] ?? "");
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addItem({
      slug: product.slug,
      name: product.name,
      price: product.price,
      size: size || undefined,
      note: fileName ? `${note} [image: ${fileName}]`.trim() : note || undefined,
      quantity,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {product.sizes && product.sizes.length > 0 && (
        <div>
          <label className="text-sm font-semibold text-berry-dark">
            Size / Option
          </label>
          <select
            value={size}
            onChange={(e) => setSize(e.target.value)}
            className="mt-1 w-full rounded-lg border border-berry/20 bg-white px-3 py-2 text-sm focus:border-berry focus:outline-none"
          >
            {product.sizes.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      )}

      {product.customizable && (
        <>
          <div>
            <label className="text-sm font-semibold text-berry-dark">
              Upload your image (optional)
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
              className="mt-1 w-full rounded-lg border border-dashed border-berry/30 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-blush file:px-3 file:py-1 file:text-berry-dark"
            />
            {fileName && (
              <p className="mt-1 text-xs text-foreground/60">
                Selected: {fileName}
              </p>
            )}
          </div>
          <div>
            <label className="text-sm font-semibold text-berry-dark">
              Message or instructions (optional)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="e.g. names, colours, theme details..."
              className="mt-1 w-full rounded-lg border border-berry/20 bg-white px-3 py-2 text-sm focus:border-berry focus:outline-none"
            />
          </div>
        </>
      )}

      <div className="flex items-center gap-3">
        <label className="text-sm font-semibold text-berry-dark">Qty</label>
        <input
          type="number"
          min={1}
          value={quantity}
          onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
          className="w-20 rounded-lg border border-berry/20 bg-white px-3 py-2 text-sm focus:border-berry focus:outline-none"
        />
      </div>

      <button
        type="submit"
        className="w-full rounded-full bg-berry px-6 py-3 font-semibold text-white transition hover:bg-berry-dark"
      >
        Add to Cart - ${(product.price * quantity).toFixed(2)}
      </button>
      {added && (
        <p className="text-center text-sm font-medium text-green-700">
          Added to your cart!{" "}
          <button
            type="button"
            onClick={() => router.push("/cart")}
            className="underline"
          >
            View cart
          </button>
        </p>
      )}
    </form>
  );
}
