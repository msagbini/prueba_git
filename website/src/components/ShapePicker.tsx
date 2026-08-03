"use client";

import { shapes, type ShapeId } from "@/lib/shapes";

export default function ShapePicker({
  options,
  shape,
  character,
  onShapeChange,
  onCharacterChange,
}: {
  options: ShapeId[];
  shape: ShapeId;
  character: string;
  onShapeChange: (shape: ShapeId) => void;
  onCharacterChange: (character: string) => void;
}) {
  const available = shapes.filter((s) => options.includes(s.id));
  const needsCharacter = shape === "number" || shape === "letter";

  return (
    <div>
      <label className="text-sm font-semibold text-berry-dark">Shape</label>
      <div className="mt-1 flex flex-wrap gap-2">
        {available.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onShapeChange(s.id)}
            aria-pressed={shape === s.id}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
              shape === s.id
                ? "border-berry bg-blush text-berry-dark"
                : "border-berry/20 text-foreground/70 hover:border-berry/40"
            }`}
          >
            <span aria-hidden="true">{s.emoji}</span>
            {s.label}
          </button>
        ))}
      </div>
      {needsCharacter && (
        <div className="mt-3">
          <label className="text-sm font-semibold text-berry-dark">
            {shape === "number" ? "Which number?" : "Which letter?"}
          </label>
          <input
            value={character}
            maxLength={2}
            onChange={(e) => onCharacterChange(e.target.value)}
            placeholder={shape === "number" ? "e.g. 5" : "e.g. A"}
            className="mt-1 w-24 rounded-lg border border-berry/20 bg-white px-3 py-2 text-sm focus:border-berry focus:outline-none"
          />
        </div>
      )}
    </div>
  );
}
