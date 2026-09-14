"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldAlert } from "lucide-react";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  loadingLabel?: string;
  variant?: "destructive" | "default";
  isLoading?: boolean;
  error?: string | null;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  loadingLabel,
  variant = "destructive",
  isLoading = false,
  error = null,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const handleOpenChange = (nextOpen: boolean) => {
    // Prevent closing when in loading/flight state
    if (isLoading) return;
    if (!nextOpen && onCancel) {
      onCancel();
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-[425px]"
        showCloseButton={!isLoading}
        onPointerDownOutside={(e) => {
          if (isLoading) {
            e.preventDefault();
          }
        }}
        onEscapeKeyDown={(e) => {
          if (isLoading) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-zinc-900">
            {title}
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-500 leading-relaxed mt-1.5">
            {description}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert
            variant="destructive"
            className="py-2.5 px-3 border-red-200 bg-red-50 text-red-700"
            role="alert"
            aria-live="assertive"
          >
            <ShieldAlert className="w-4 h-4 text-red-600 mt-0.5" />
            <AlertDescription className="text-xs font-medium ml-1">
              {error}
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter className="gap-2 sm:gap-0 mt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleOpenChange(false)}
            disabled={isLoading}
            className="text-xs h-8"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={variant}
            size="sm"
            onClick={() => onConfirm()}
            disabled={isLoading}
            className="text-xs h-8"
          >
            {isLoading ? (
              <>
                <Spinner size="sm" className="mr-1.5" />
                <span>{loadingLabel || "Processing..."}</span>
              </>
            ) : error ? (
              "Try again"
            ) : (
              confirmLabel
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
