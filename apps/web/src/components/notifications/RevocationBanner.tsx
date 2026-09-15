"use client";

import { useEffect, useState } from "react";
import { AlertCircle, X } from "lucide-react";

interface RevocationBannerProps {
  initialWorkspaceName?: string;
  isRevoked?: boolean;
}

export function RevocationBanner({ initialWorkspaceName, isRevoked }: RevocationBannerProps) {
  const [visible, setVisible] = useState(false);
  const [workspaceName, setWorkspaceName] = useState(initialWorkspaceName || "");

  useEffect(() => {
    let shouldShow = Boolean(isRevoked);
    let resolvedName = initialWorkspaceName || "";

    // Check sessionStorage flash
    try {
      const flashName = window.sessionStorage.getItem("revoked_workspace_flash");
      if (flashName) {
        shouldShow = true;
        resolvedName = flashName;
        window.sessionStorage.removeItem("revoked_workspace_flash");
      }
    } catch {
      // Storage access restricted
    }

    if (shouldShow) {
      setWorkspaceName(resolvedName);
      setVisible(true);

      // Clean up URL query parameters without reloading the page
      if (typeof window !== "undefined" && window.history?.replaceState) {
        const url = new URL(window.location.href);
        if (url.searchParams.has("revoked") || url.searchParams.has("workspace")) {
          url.searchParams.delete("revoked");
          url.searchParams.delete("workspace");
          window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
        }
      }
    }
  }, [isRevoked, initialWorkspaceName]);

  if (!visible) return null;

  return (
    <div 
      role="alert" 
      aria-live="assertive"
      className="max-w-2xl w-full mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between gap-4 text-red-900 transition-all animate-in fade-in slide-in-from-top-2 duration-300"
    >
      <div className="flex items-center gap-3">
        <div className="p-2 bg-red-100 text-red-600 rounded-md">
          <AlertCircle className="w-5 h-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-red-950">
            Access Revoked
          </p>
          <p className="text-xs text-red-800">
            Your access to {workspaceName ? workspaceName : "the workspace"} has been revoked.
          </p>
        </div>
      </div>
      <button
        onClick={() => setVisible(false)}
        className="p-1 rounded-md text-red-500 hover:text-red-700 hover:bg-red-100 transition-colors"
        aria-label="Dismiss notification"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
