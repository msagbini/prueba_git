"use client";

import { useState } from "react";

type Status = "idle" | "submitting" | "success" | "error";

export default function NewsletterSignup() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("submitting");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error();
      setStatus("success");
      setEmail("");
    } catch {
      setStatus("error");
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
    <form onSubmit={handleSubmit} className="flex max-w-xs gap-2">
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
        Get 10% off
      </button>
      {status === "error" && (
        <span className="sr-only">Something went wrong, please try again.</span>
      )}
    </form>
  );
}
