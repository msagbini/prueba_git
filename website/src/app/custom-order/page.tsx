"use client";

import { useState } from "react";
import { categories } from "@/lib/products";

type Status = "idle" | "submitting" | "success" | "error";

export default function CustomOrderPage() {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus("submitting");
    setErrorMessage("");

    const form = e.currentTarget;
    const formData = new FormData(form);

    try {
      const res = await fetch("/api/custom-order", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Something went wrong.");
      }
      setStatus("success");
      form.reset();
    } catch (err) {
      setStatus("error");
      setErrorMessage(
        err instanceof Error ? err.message : "Something went wrong.",
      );
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl font-bold text-berry-dark">
        Custom Order Form
      </h1>
      <p className="mt-2 text-foreground/70">
        Tell us what you have in mind - upload a photo or design idea and add
        any details. We&apos;ll follow up by email with a quote and timeline.
      </p>

      {status === "success" ? (
        <div className="mt-8 rounded-2xl border border-green-200 bg-green-50 p-6 text-center">
          <p className="font-semibold text-green-800">
            Thanks! Your custom order request has been received.
          </p>
          <p className="mt-1 text-sm text-green-700">
            Grace will reply to your email within 1-2 business days.
          </p>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="mt-8 space-y-5 rounded-2xl border border-berry/10 bg-white/70 p-6"
        >
          <div>
            <label className="text-sm font-semibold text-berry-dark">
              Your name
            </label>
            <input
              name="name"
              required
              className="mt-1 w-full rounded-lg border border-berry/20 bg-white px-3 py-2 text-sm focus:border-berry focus:outline-none"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-berry-dark">
              Email
            </label>
            <input
              type="email"
              name="email"
              required
              className="mt-1 w-full rounded-lg border border-berry/20 bg-white px-3 py-2 text-sm focus:border-berry focus:outline-none"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-berry-dark">
              Category
            </label>
            <select
              name="category"
              required
              className="mt-1 w-full rounded-lg border border-berry/20 bg-white px-3 py-2 text-sm focus:border-berry focus:outline-none"
            >
              {categories.map((c) => (
                <option key={c.slug} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-semibold text-berry-dark">
              Upload an image (optional)
            </label>
            <input
              type="file"
              name="image"
              accept="image/*"
              className="mt-1 w-full rounded-lg border border-dashed border-berry/30 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-blush file:px-3 file:py-1 file:text-berry-dark"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-berry-dark">
              Tell us about your order
            </label>
            <textarea
              name="message"
              required
              rows={4}
              placeholder="Event date, theme, colours, sizes, quantity..."
              className="mt-1 w-full rounded-lg border border-berry/20 bg-white px-3 py-2 text-sm focus:border-berry focus:outline-none"
            />
          </div>

          {status === "error" && (
            <p className="text-sm text-red-600">{errorMessage}</p>
          )}

          <button
            type="submit"
            disabled={status === "submitting"}
            className="w-full rounded-full bg-berry px-6 py-3 font-semibold text-white transition hover:bg-berry-dark disabled:opacity-60"
          >
            {status === "submitting" ? "Sending..." : "Submit Custom Order"}
          </button>
        </form>
      )}
    </div>
  );
}
