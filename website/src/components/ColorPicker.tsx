"use client";

import { finishColors } from "@/lib/colors";

export default function ColorPicker({
  colorId,
  onChange,
}: {
  colorId: string;
  onChange: (id: string) => void;
}) {
  return (
    <div>
      <label className="text-sm font-semibold text-berry-dark">
        Icing / finish colour
      </label>
      <div className="mt-1 flex flex-wrap gap-2">
        {finishColors.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onChange(c.id)}
            aria-pressed={colorId === c.id}
            aria-label={c.label}
            title={c.label}
            className={`h-8 w-8 rounded-full border-2 transition ${
              colorId === c.id
                ? "border-berry scale-110"
                : "border-white/60 hover:border-berry/40"
            }`}
            style={{ backgroundColor: c.hex, boxShadow: "0 1px 3px rgba(0,0,0,0.25)" }}
          />
        ))}
      </div>
    </div>
  );
}
