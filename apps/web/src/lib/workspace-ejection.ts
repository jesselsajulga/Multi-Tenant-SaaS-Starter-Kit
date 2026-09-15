/**
 * Utility functions for handling workspace access revocation and graceful ejection.
 */

export interface EjectionOptions {
  organizationId?: string;
  workspaceName?: string;
}

/**
 * Clears workspace-specific cached state without clearing global application state.
 * Only keys explicitly prefixed with `workspace:${organizationId}:` are removed.
 */
export function clearWorkspaceSpecificData(organizationId?: string) {
  if (typeof window === "undefined" || !organizationId) return;

  const prefix = `workspace:${organizationId}:`;

  // Clear matching localStorage keys
  try {
    const localKeysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        localKeysToRemove.push(key);
      }
    }
    for (const key of localKeysToRemove) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Storage access might be restricted
  }

  // Clear matching sessionStorage keys
  try {
    const sessionKeysToRemove: string[] = [];
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const key = window.sessionStorage.key(i);
      if (key && key.startsWith(prefix)) {
        sessionKeysToRemove.push(key);
      }
    }
    for (const key of sessionKeysToRemove) {
      window.sessionStorage.removeItem(key);
    }
  } catch {
    // Storage access might be restricted
  }
}

/**
 * Executes a client-side ejection to /organizations with revocation feedback.
 */
export function handleWorkspaceAccessRevoked(options?: EjectionOptions) {
  if (typeof window === "undefined") return;

  const { organizationId, workspaceName } = options || {};

  if (organizationId) {
    clearWorkspaceSpecificData(organizationId);
  }

  const name = workspaceName || "this workspace";
  try {
    window.sessionStorage.setItem("revoked_workspace_flash", name);
  } catch {
    // Ignore storage issues
  }

  const queryParams = new URLSearchParams();
  queryParams.set("revoked", "1");
  if (workspaceName) {
    queryParams.set("workspace", workspaceName);
  }

  window.location.href = `/organizations?${queryParams.toString()}`;
}
