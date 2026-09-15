"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowRight } from "lucide-react";

interface WelcomeWorkspaceModalProps {
  open: boolean;
  organizationName: string;
  onConfirm: () => void;
}

export function WelcomeWorkspaceModal({
  open,
  organizationName,
  onConfirm,
}: WelcomeWorkspaceModalProps) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!nextOpen) {
        onConfirm();
      }
    }}>
      <DialogContent
        className="sm:max-w-[440px] text-center p-8"
        onEscapeKeyDown={() => onConfirm()}
        onPointerDownOutside={() => onConfirm()}
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-50 text-green-600 mb-2">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>

        <DialogHeader className="text-center sm:text-center space-y-2">
          <DialogTitle className="text-2xl font-bold tracking-tight text-zinc-900">
            Welcome to {organizationName}
          </DialogTitle>
          <DialogDescription className="text-sm text-zinc-500 leading-relaxed max-w-sm mx-auto">
            You have successfully joined the workspace. You now have access to collaborate with your team and workspace resources.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="mt-6 sm:justify-center">
          <Button
            size="lg"
            onClick={onConfirm}
            className="w-full bg-zinc-900 text-white hover:bg-zinc-800 font-medium py-2.5"
          >
            <span>Go to Dashboard</span>
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
