"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PostalCodeForm() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postalCode: value }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      router.push(`/mp/${data.slug}`);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="postal-form" onSubmit={handleSubmit}>
      <input
        type="text"
        inputMode="text"
        placeholder="K1A 0A6"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label="Canadian postal code"
        autoComplete="postal-code"
        disabled={loading}
      />
      <button type="submit" disabled={loading || value.trim().length === 0}>
        {loading ? "Looking up…" : "Find my MP"}
      </button>
      {error && (
        <div className="error-box" role="alert" style={{ width: "100%" }}>
          {error}
        </div>
      )}
    </form>
  );
}
