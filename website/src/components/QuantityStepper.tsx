"use client";

export default function QuantityStepper({
  quantity,
  onChange,
  min = 1,
  max,
}: {
  quantity: number;
  onChange: (quantity: number) => void;
  min?: number;
  max?: number;
}) {
  const dec = () => onChange(Math.max(min, quantity - 1));
  const inc = () => onChange(max ? Math.min(max, quantity + 1) : quantity + 1);

  return (
    <div className="flex items-center rounded-lg border border-berry/20">
      <button
        type="button"
        onClick={dec}
        disabled={quantity <= min}
        aria-label="Decrease quantity"
        className="px-3 py-1.5 text-lg font-medium text-berry-dark transition hover:bg-blush disabled:opacity-30"
      >
        −
      </button>
      <span className="w-8 text-center text-sm font-semibold" aria-live="polite">
        {quantity}
      </span>
      <button
        type="button"
        onClick={inc}
        disabled={max !== undefined && quantity >= max}
        aria-label="Increase quantity"
        className="px-3 py-1.5 text-lg font-medium text-berry-dark transition hover:bg-blush disabled:opacity-30"
      >
        +
      </button>
    </div>
  );
}
