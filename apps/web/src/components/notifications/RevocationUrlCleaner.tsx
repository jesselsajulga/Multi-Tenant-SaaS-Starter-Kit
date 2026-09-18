"use client";

import { useEffect } from "react";

export function RevocationUrlCleaner() {
  useEffect(() => {
    try {
      window.sessionStorage.removeItem("revoked_workspace_flash");
      window.sessionStorage.removeItem("deleted_workspace_flash");
    } catch {
      // Ignore storage access errors
    }

    if (typeof window !== "undefined" && window.history?.replaceState) {
      const url = new URL(window.location.href);
      if (
        url.searchParams.has("revoked") ||
        url.searchParams.has("deleted") ||
        url.searchParams.has("workspace")
      ) {
        url.searchParams.delete("revoked");
        url.searchParams.delete("deleted");
        url.searchParams.delete("workspace");
        window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
      }
    }
  }, []);

  return null;
}
