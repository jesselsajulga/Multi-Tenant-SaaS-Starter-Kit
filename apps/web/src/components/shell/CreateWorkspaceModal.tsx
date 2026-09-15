"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
interface CreateWorkspaceModalProps {
  buttonClassName?: string;
  buttonContent?: React.ReactNode;
  onSuccess?: () => void;
}

export function CreateWorkspaceModal({ buttonClassName, buttonContent, onSuccess }: CreateWorkspaceModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const router = useRouter();

  const handleOpenChange = (open: boolean) => {
    // Prevent closing modal while in loading or success dwell state
    if (!open && (loading || isSuccess)) return;
    setIsOpen(open);
    if (!open) {
      setError(null);
      setName("");
      setIsSuccess(false);
    }
  };

  const MIN_LOADING_TIME = 2500;
  const SUCCESS_DWELL_TIME = 1200;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || loading || isSuccess) return;

    setLoading(true);
    setError(null);
    const startedAt = Date.now();

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const res = await fetch(`${API_URL}/organizations`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: name.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create workspace");
      }

      const data = await res.json();
      const newOrganizationId = data.organization.id;

      // Enforce the full 2.5-second minimum loading duration so the spinner sequence is clearly visible
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, MIN_LOADING_TIME - elapsed);
      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }

      // Transition to explicit success state
      setLoading(false);
      setIsSuccess(true);

      // Enforce 1200ms success dwell time so user cognitively processes "Created!" before redirect
      await new Promise((resolve) => setTimeout(resolve, SUCCESS_DWELL_TIME));

      setIsOpen(false);
      setName("");
      setIsSuccess(false);
      
      if (onSuccess) {
        onSuccess();
      }

      router.push(`/organizations/${newOrganizationId}/dashboard`);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
      setIsSuccess(false);
    }
  };

  const defaultButton = (
    <Button
      onClick={() => setIsOpen(true)}
      variant="default"
      className="flex items-center gap-2"
    >
      <Plus className="w-4 h-4" />
      Create Workspace
    </Button>
  );

  return (
    <>
      {buttonContent ? (
        <button
          onClick={() => setIsOpen(true)}
          className={buttonClassName}
        >
          {buttonContent}
        </button>
      ) : (
        defaultButton
      )}

      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create Workspace</DialogTitle>
            <DialogDescription className="sr-only">Enter the details for your new workspace.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md border border-red-100">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-zinc-700 mb-1">
                Workspace Name
              </label>
              <Input
                id="name"
                type="text"
                required
                disabled={loading || isSuccess}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Acme Corp"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-zinc-100">
              <Button
                type="button"
                variant="outline"
                disabled={loading || isSuccess}
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant={isSuccess ? "success" : "default"}
                disabled={loading || isSuccess || !name.trim()}
                className={isSuccess ? "!bg-green-600 hover:!bg-green-600 !text-white !opacity-100 transition-colors" : ""}
              >
                {isSuccess ? (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    <span>Created!</span>
                  </>
                ) : loading ? (
                  <>
                    <Spinner className="w-4 h-4 mr-2" />
                    <span>Creating...</span>
                  </>
                ) : (
                  "Create"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
