"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function SignupForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

      // minimum delay so the loading state is visible for at least 2.5s
      const minDelay = new Promise((resolve) => setTimeout(resolve, 2500));

      const fetchPromise = fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const [res] = await Promise.all([fetchPromise, minDelay]);

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Registration failed");
      }

      setSuccess(true);
      setLoading(false);

      setTimeout(() => {
        const loginUrl = returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : "/login";
        router.push(loginUrl);
      }, 1500);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div>
        <label className="block text-sm font-medium text-zinc-700">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="you@example.com"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-700">Password</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="••••••••"
        />
      </div>
      <button
        type="submit"
        disabled={loading || success}
        className={`w-full flex justify-center items-center rounded-md px-4 py-2 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${success
          ? "bg-green-600 hover:bg-green-700 focus:ring-green-600"
          : "bg-zinc-900 hover:bg-zinc-800 focus:ring-zinc-900 disabled:opacity-70"
          }`}
      >
        {success ? (
          "Account created successfully!"
        ) : loading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating account...
          </>
        ) : (
          "Sign up"
        )}
      </button>
    </form>
  );
}