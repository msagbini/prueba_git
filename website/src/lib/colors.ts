export type ColorOption = { id: string; label: string; hex: string };

export const finishColors: ColorOption[] = [
  { id: "white", label: "White", hex: "#ffffff" },
  { id: "blush", label: "Blush Pink", hex: "#f4c9d2" },
  { id: "gold", label: "Gold", hex: "#d8a94d" },
  { id: "lavender", label: "Lavender", hex: "#cbb6e0" },
  { id: "mint", label: "Mint", hex: "#b7e0c9" },
  { id: "chocolate", label: "Dark Chocolate", hex: "#5b3a2a" },
];

export function getColor(id?: string) {
  return finishColors.find((c) => c.id === id);
}
