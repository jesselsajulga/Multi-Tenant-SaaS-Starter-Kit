"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { Check } from "lucide-react";

interface InviteMemberModalProps {
  organizationId: string;
}

export function InviteMemberModal({ organizationId }: InviteMemberModalProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const resetForm = () => {
    setEmail("");
    setError(null);
    setSuccess(false);
    setLoading(false);
  };

  const handleOpenChange = (open: boolean) => {
    // Prevent accidental dismissal while request is in flight
    if (loading && !open) {
      return;
    }
    setIsOpen(open);
    if (!open) {
      resetForm();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || success) return;

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

      // Match standard minimum loading duration from LoginForm/SignUpForm so the spinner is clearly visible
      const minDelay = new Promise((resolve) => setTimeout(resolve, 2500));

      const fetchPromise = fetch(`${API_URL}/organizations/${organizationId}/invitations`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const [res] = await Promise.all([fetchPromise, minDelay]);

      let data: any = {};
      try {
        data = await res.json();
      } catch {
        // Fallback for non-JSON responses
      }

      if (!res.ok) {
        throw new Error(data.error || `Failed to invite member (HTTP ${res.status})`);
      }

      setSuccess(true);
      router.refresh();

      // Auto close after ~1s confirmation window and reset form
      setTimeout(() => {
        setIsOpen(false);
        resetForm();
      }, 1000);
    } catch (err: any) {
      setError(err.message || "Failed to invite member");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>Invite Member</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite a Member</DialogTitle>
          <DialogDescription className="sr-only">Invite a new member to your organization.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium text-zinc-700">
                Email Address
              </label>
              <Input
                id="email"
                type="email"
                required
                disabled={loading || success}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-700">
                Role
              </label>
              <Select disabled value="MEMBER">
                <SelectTrigger>
                  <SelectValue placeholder="Member" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MEMBER">Member</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-zinc-500">
                All invited users join as Members.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              disabled={loading || success}
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant={success ? "outline" : "default"}
              disabled={loading || success}
              className={
                success
                  ? "!bg-transparent !border-2 !border-green-600 !text-green-600 hover:!bg-transparent !opacity-100 cursor-default"
                  : ""
              }
            >
              {success ? (
                <>
                  <Check className="w-4 h-4 mr-1.5" />
                  <span>Invitation sent!</span>
                </>
              ) : loading ? (
                <>
                  <Spinner size="sm" className="mr-2 text-zinc-50" />
                  <span>Sending invitation...</span>
                </>
              ) : (
                "Send Invitation"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}