"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCart } from "@/lib/cart-context";
import type { Product } from "@/lib/products";
import type { ShapeId } from "@/lib/shapes";
import { getColor } from "@/lib/colors";
import LivePreview from "@/components/LivePreview";
import StarRating from "@/components/StarRating";
import ShapePicker from "@/components/ShapePicker";
import ColorPicker from "@/components/ColorPicker";
import CrossSell from "@/components/CrossSell";

export default function ProductCustomizer({ product }: { product: Product }) {
  const { addItem } = useCart();
  const router = useRouter();
  const [size, setSize] = useState(product.sizes?.[0] ?? "");
  const [shape, setShape] = useState<ShapeId>(product.shapeOptions?.[0] ?? "circle");
  const [character, setCharacter] = useState("1");
  const [colorId, setColorId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setFileName(null);
      setImageDataUrl(null);
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setImageDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const shapeLabel = product.shapeOptions
      ? shape === "number" || shape === "letter"
        ? `${shape} "${character}"`
        : shape
      : null;
    const colorLabel = colorId ? getColor(colorId)?.label : null;
    const details = [
      note,
      shapeLabel ? `[shape: ${shapeLabel}]` : "",
      colorLabel ? `[colour: ${colorLabel}]` : "",
      fileName ? `[image: ${fileName}]` : "",
    ]
      .filter(Boolean)
      .join(" ")
      .trim();
    addItem({
      slug: product.slug,
      name: product.name,
      price: product.price,
      size: size || undefined,
      note: details || undefined,
      quantity,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
  };

  return (
    <div className="grid gap-10 md:grid-cols-2">
      <div>
        <LivePreview
          category={product.category}
          size={size}
          shape={shape}
          character={character}
          imageDataUrl={imageDataUrl}
          message={note}
          color={colorId ? getColor(colorId)?.hex : undefined}
        />
      </div>

      <div>
        <h1 className="font-display text-3xl font-bold text-berry-dark">
          {product.name}
        </h1>
        <div className="mt-2">
          <StarRating rating={product.rating} reviewCount={product.reviewCount} />
        </div>
        <p className="mt-4 text-lg font-semibold text-berry">
          ${product.price.toFixed(2)}
        </p>
        <p className="mt-4 text-foreground/75">{product.description}</p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5 rounded-2xl border border-berry/10 bg-white/70 p-6">
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

          {product.shapeOptions && (
            <ShapePicker
              options={product.shapeOptions}
              shape={shape}
              character={character}
              onShapeChange={setShape}
              onCharacterChange={setCharacter}
            />
          )}

          {product.customizable && (
            <>
              <ColorPicker colorId={colorId} onChange={setColorId} />
              <div>
                <label className="text-sm font-semibold text-berry-dark">
                  Upload your image (optional)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
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

        <p className="mt-4 text-xs text-foreground/50">
          Need something more involved - multiple images, a bespoke shape,
          or a bulk event order? Use our{" "}
          <Link href="/custom-order" className="text-berry underline">
            full custom order form
          </Link>{" "}
          instead.
        </p>

        <CrossSell currentCategory={product.category} />
      </div>
    </div>
  );
}
