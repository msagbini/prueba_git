"use client";

import { useState } from "react";

type Status = "idle" | "submitting" | "success" | "error";

export default function NewsletterSignup() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("submitting");
    setErrorMessage("");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Something went wrong, please try again.");
      }
      setStatus("success");
      setEmail("");
    } catch (err) {
      setStatus("error");
      setErrorMessage(
        err instanceof Error ? err.message : "Something went wrong, please try again.",
      );
    }
  };

  if (status === "success") {
    return (
      <p className="text-sm font-medium text-green-700">
        ✓ You&apos;re on the list - check your inbox for your 10% off code.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xs">
      <div className="flex gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Your email"
          className="w-full rounded-lg border border-berry/20 bg-white px-3 py-2 text-sm focus:border-berry focus:outline-none"
        />
        <button
          type="submit"
          disabled={status === "submitting"}
          className="shrink-0 rounded-lg bg-berry px-4 text-sm font-semibold text-white hover:bg-berry-dark disabled:opacity-60"
        >
          {status === "submitting" ? "..." : "Get 10% off"}
        </button>
      </div>
      {status === "error" && (
        <p className="mt-1.5 text-xs font-medium text-red-600">{errorMessage}</p>
      )}
    </form>
  );
}
