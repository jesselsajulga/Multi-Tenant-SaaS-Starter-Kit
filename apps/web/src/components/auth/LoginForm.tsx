"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

      // minimum delay so the loading state is visible for at least 2.5s
      const minDelay = new Promise((resolve) => setTimeout(resolve, 2500));

      const fetchPromise = fetch(`${API_URL}/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const [res] = await Promise.all([fetchPromise, minDelay]);

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Login failed");
      }

      setSuccess(true);
      setLoading(false);

      setTimeout(() => {
        router.push("/organizations");
        router.refresh();
      }, 1500);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-md">
          {error}
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-zinc-700">Email</label>
        <Input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-700">Password</label>
        <Input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
      </div>
      <Button
        type="submit"
        disabled={loading || success}
        className="w-full"
        variant={success ? "success" : "default"}
      >
        {success ? (
          "Signed in successfully!"
        ) : loading ? (
          <><Spinner className="mr-2" /> Signing in...</>
        ) : (
          "Sign in"
        )}
      </Button>
    </form>
  );
}
