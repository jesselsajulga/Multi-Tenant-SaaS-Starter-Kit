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
import { ShieldAlert, Check } from "lucide-react";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  loadingLabel?: string;
  successLabel?: string;
  variant?: "destructive" | "default";
  isLoading?: boolean;
  isSuccess?: boolean;
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
  successLabel = "Success!",
  variant = "destructive",
  isLoading = false,
  isSuccess = false,
  error = null,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const handleOpenChange = (nextOpen: boolean) => {
    // Prevent closing when in loading/flight or success state
    if (isLoading || isSuccess) return;
    if (!nextOpen && onCancel) {
      onCancel();
    }
    onOpenChange(nextOpen);
  };

  // Success state mirrors the dialog's own variant: destructive actions stay red, others go green
  const successClassName =
    variant === "destructive"
      ? "!bg-transparent !border-2 !border-red-600 !text-red-600 hover:!bg-transparent !opacity-100 cursor-default"
      : "!bg-transparent !border-2 !border-green-600 !text-green-600 hover:!bg-transparent !opacity-100 cursor-default";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-[425px]"
        showCloseButton={!isLoading && !isSuccess}
        onPointerDownOutside={(e) => {
          if (isLoading || isSuccess) {
            e.preventDefault();
          }
        }}
        onEscapeKeyDown={(e) => {
          if (isLoading || isSuccess) {
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
            disabled={isLoading || isSuccess}
            className="text-xs h-8"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={isSuccess ? "outline" : variant}
            size="sm"
            onClick={() => onConfirm()}
            disabled={isLoading || isSuccess}
            className={`text-xs h-8 ${isSuccess ? successClassName : ""}`}
          >
            {isSuccess ? (
              <>
                <Check className="w-3.5 h-3.5 mr-1.5" />
                <span>{successLabel}</span>
              </>
            ) : isLoading ? (
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