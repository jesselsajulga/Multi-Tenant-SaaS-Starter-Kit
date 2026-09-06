"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function SubscriptionClient({ organizationId, hasSubscription }: { organizationId: string, hasSubscription: boolean }) {
  const [loading, setLoading] = useState<"checkout" | "portal" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCheckout = async () => {
    setLoading("checkout");
    setError(null);
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
        setError(data.error || "Failed to initiate checkout");
        setLoading(null);
      }
    } catch (err: any) {
      setError("Network error: " + err.message);
      setLoading(null);
    }
  };

  const handlePortal = async () => {
    setLoading("portal");
    setError(null);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const res = await fetch(`${API_URL}/organizations/${organizationId}/billing/portal`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || "Failed to open billing portal");
        setLoading(null);
      }
    } catch (err: any) {
      setError("Network error: " + err.message);
      setLoading(null);
    }
  };

  return (
    <div className="mt-8 pt-8 border-t border-zinc-200">
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Billing Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="flex gap-4">
        {hasSubscription ? (
          <Button
            onClick={handlePortal}
            disabled={loading !== null}
            variant="outline"
          >
            {loading === "portal" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Manage Subscription
          </Button>
        ) : (
          <Button
            onClick={handleCheckout}
            disabled={loading !== null}
          >
            {loading === "checkout" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Upgrade to Pro
          </Button>
        )}
      </div>
    </div>
  );
}
