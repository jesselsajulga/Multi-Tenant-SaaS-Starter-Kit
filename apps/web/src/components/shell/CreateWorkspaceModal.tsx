"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError(null);

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

      setIsOpen(false);
      setName("");
      
      if (onSuccess) {
        onSuccess();
      }

      router.push(`/organizations/${newOrganizationId}/dashboard`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
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

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create Workspace</DialogTitle>
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
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Acme Corp"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-zinc-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading || !name.trim()}
              >
                {loading && <Spinner className="w-4 h-4 mr-2" />}
                Create
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
