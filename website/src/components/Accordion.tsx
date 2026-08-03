"use client";

import { useState } from "react";

export default function Accordion({
  items,
}: {
  items: { question: string; answer: string }[];
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="divide-y divide-berry/10 rounded-2xl border border-berry/10 bg-white/70">
      {items.map((item, i) => {
        const open = openIndex === i;
        return (
          <div key={item.question}>
            <button
              type="button"
              onClick={() => setOpenIndex(open ? null : i)}
              aria-expanded={open}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
            >
              <span className="font-semibold text-berry-dark">{item.question}</span>
              <span className="text-berry" aria-hidden="true">
                {open ? "−" : "+"}
              </span>
            </button>
            {open && (
              <p className="px-5 pb-4 text-sm text-foreground/70">{item.answer}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
