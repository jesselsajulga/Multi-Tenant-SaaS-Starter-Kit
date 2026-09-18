"use client";

import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { AlertCircle, Trash2, Check } from "lucide-react";

export type DeletionStatus = "IDLE" | "PENDING" | "SUCCESS" | "ERROR";

interface DeleteWorkspaceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  organizationName: string;
  onSuccess: () => void;
}

const MIN_LOADING_DURATION = 2500; // Keep loading spinner active for at least 2.5s
const SUCCESS_DWELL = 1200;        // Dwell on "Deleted" state before redirecting

export function DeleteWorkspaceModal({
  open,
  onOpenChange,
  organizationId,
  organizationName,
  onSuccess,
}: DeleteWorkspaceModalProps) {
  const [confirmName, setConfirmName] = useState("");
  const [deletionStatus, setDeletionStatus] = useState<DeletionStatus>("IDLE");
  const [error, setError] = useState<string | null>(null);

  const deletionStartedAtRef = useRef<number | null>(null);
  const redirectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isExactMatch = confirmName.trim() === "CONFIRM";
  const isBusy = deletionStatus === "PENDING" || deletionStatus === "SUCCESS";

  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
        redirectTimeoutRef.current = null;
      }
    };
  }, []);

  const handleDelete = async () => {
    if (!isExactMatch || isBusy) return;

    deletionStartedAtRef.current = Date.now();
    setDeletionStatus("PENDING");
    setError(null);

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

      // Execute deletion API request immediately in parallel with minimum loading timer
      const [res] = await Promise.all([
        fetch(`${API_URL}/organizations/${organizationId}`, {
          method: "DELETE",
          credentials: "include",
        }),
        new Promise((resolve) => setTimeout(resolve, MIN_LOADING_DURATION)),
      ]);

      if (!res.ok) {
        let errorMessage = "Unable to delete workspace. Please try again.";
        try {
          const data = await res.json();
          if (data?.error) errorMessage = data.error;
        } catch {
          // Use default error
        }
        throw new Error(errorMessage);
      }

      // Transition to SUCCESS ("✓ Deleted") in red
      setDeletionStatus("SUCCESS");

      // Dwell on "Deleted" state for readable confirmation before triggering redirect
      redirectTimeoutRef.current = setTimeout(() => {
        onSuccess();
      }, SUCCESS_DWELL);
    } catch (err: any) {
      setError(err.message || "Failed to delete workspace");
      setDeletionStatus("ERROR");
    }
  };

  const handleClose = () => {
    if (isBusy) return; // Prevent closing while deletion or success dwell is in progress
    setConfirmName("");
    setError(null);
    setDeletionStatus("IDLE");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!nextOpen) handleClose();
    }}>
      <DialogContent
        className="sm:max-w-[480px] p-6"
        onEscapeKeyDown={(e) => {
          if (isBusy) e.preventDefault();
        }}
        onPointerDownOutside={(e) => {
          if (isBusy) e.preventDefault();
        }}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
            <Trash2 className="h-5 w-5" />
          </div>
          <DialogHeader className="text-left space-y-1">
            <DialogTitle className="text-lg font-semibold text-zinc-900">
              Delete workspace?
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-500">
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-4 pt-2">
          <p className="text-sm text-zinc-600 leading-relaxed">
            This permanently deletes <span className="font-semibold text-zinc-900">{organizationName}</span> and all of its projects, members, invitations, and associated data.
          </p>

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5 pt-1">
            <label htmlFor="confirmWorkspaceName" className="block text-xs font-medium text-zinc-700">
              Type <span className="font-semibold select-all text-zinc-900">"CONFIRM"</span> to confirm deletion:
            </label>
            <Input
              id="confirmWorkspaceName"
              type="text"
              value={confirmName}
              onChange={(e) => {
                setConfirmName(e.target.value);
                if (deletionStatus === "ERROR") {
                  setDeletionStatus("IDLE");
                }
              }}
              disabled={isBusy}
              placeholder="CONFIRM"
              className="w-full text-sm"
              autoComplete="off"
            />
          </div>
        </div>

        <DialogFooter className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isBusy}
            className="text-zinc-700"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={deletionStatus === "SUCCESS" ? "outline" : "destructive"}
            onClick={handleDelete}
            disabled={!isExactMatch || isBusy}
            className={`font-medium transition-all duration-200 ${deletionStatus === "SUCCESS"
              ? "bg-transparent border-2 border-red-600 text-red-600 hover:bg-transparent cursor-default"
              : "bg-red-600 hover:bg-red-700 text-white"
              }`}
          >
            {deletionStatus === "PENDING" && (
              <>
                <Spinner size="sm" className="mr-2 text-white" />
                <span>Deleting workspace...</span>
              </>
            )}

            {deletionStatus === "SUCCESS" && (
              <>
                <Check className="mr-2 h-4 w-4 stroke-[2.5]" />
                <span>Deleted</span>
              </>
            )}

            {(deletionStatus === "IDLE" || deletionStatus === "ERROR") && (
              <span>Delete workspace</span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}