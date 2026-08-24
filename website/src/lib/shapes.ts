export type ShapeId =
  | "circle"
  | "square"
  | "heart"
  | "star"
  | "number"
  | "letter";

export type ShapeDef = {
  id: ShapeId;
  label: string;
  emoji: string;
  /** CSS clip-path polygon, omitted for shapes handled with border-radius or text. */
  clipPath?: string;
};

export const HEART_CLIP =
  "polygon(50% 8%, 61% 0%, 74% 4%, 82% 15%, 82% 30%, 68% 52%, 50% 72%, 32% 52%, 18% 30%, 18% 15%, 26% 4%, 39% 0%)";

export const STAR_CLIP =
  "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)";

export const shapes: ShapeDef[] = [
  { id: "circle", label: "Circle", emoji: "⚪" },
  { id: "square", label: "Square", emoji: "⬛" },
  { id: "heart", label: "Heart", emoji: "❤️", clipPath: HEART_CLIP },
  { id: "star", label: "Star", emoji: "⭐", clipPath: STAR_CLIP },
  { id: "number", label: "Number", emoji: "🔢" },
  { id: "letter", label: "Letter", emoji: "🔤" },
];

export function getShape(id?: string) {
  return shapes.find((s) => s.id === id) ?? shapes[0];
}

// How many characters of a printed message actually fit inside each shape's
// silhouette - heart/star lose a lot of usable area to their notches/points
// compared to a circle or square. Shared between LivePreview (rendering)
// and the order forms (input maxLength + live counter).
export const SHAPE_MAX_CHARS: Record<ShapeId, number> = {
  circle: 22,
  square: 26,
  heart: 16,
  star: 14,
  number: 26,
  letter: 26,
};
