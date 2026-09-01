"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

export function SubscriptionClient({ organizationId, hasSubscription }: { organizationId: string, hasSubscription: boolean }) {
  const [loading, setLoading] = useState<"checkout" | "portal" | null>(null);

  const handleCheckout = async () => {
    setLoading("checkout");
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const res = await fetch(`${API_URL}/organizations/${organizationId}/billing/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "pro" }),
      });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Failed to initiate checkout");
        setLoading(null);
      }
    } catch (err: any) {
      alert("Network error: " + err.message);
      setLoading(null);
    }
  };

  const handlePortal = async () => {
    setLoading("portal");
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const res = await fetch(`${API_URL}/organizations/${organizationId}/billing/portal`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Failed to open billing portal");
        setLoading(null);
      }
    } catch (err: any) {
      alert("Network error: " + err.message);
      setLoading(null);
    }
  };

  return (
    <div className="mt-8 pt-8 border-t border-zinc-200">
      <div className="flex gap-4">
        {hasSubscription ? (
          <button
            onClick={handlePortal}
            disabled={loading !== null}
            className="flex items-center gap-2 bg-white border border-zinc-300 text-zinc-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-zinc-50 transition-colors disabled:opacity-50"
          >
            {loading === "portal" ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Manage Subscription
          </button>
        ) : (
          <button
            onClick={handleCheckout}
            disabled={loading !== null}
            className="flex items-center gap-2 bg-zinc-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            {loading === "checkout" ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Upgrade to Pro
          </button>
        )}
      </div>
    </div>
  );
}
