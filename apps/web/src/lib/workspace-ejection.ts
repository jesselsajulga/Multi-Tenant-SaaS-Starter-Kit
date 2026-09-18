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

export interface WorkspaceEjectionParams {
  organizationId?: string;
  workspaceName?: string;
  reason: "REVOKED" | "DELETED";
}

/**
 * Executes a client-side ejection to /organizations with revocation feedback.
 */
export function handleWorkspaceAccessRevoked(options?: EjectionOptions) {
  return handleWorkspaceEjection({
    organizationId: options?.organizationId,
    workspaceName: options?.workspaceName,
    reason: "REVOKED",
  });
}

/**
 * Executes a client-side ejection to /organizations with deletion feedback.
 */
export function handleWorkspaceDeleted(options?: EjectionOptions) {
  return handleWorkspaceEjection({
    organizationId: options?.organizationId,
    workspaceName: options?.workspaceName,
    reason: "DELETED",
  });
}

/**
 * Generalized workspace ejection handler for both revoked access and deleted workspaces.
 */
export function handleWorkspaceEjection(params: WorkspaceEjectionParams) {
  if (typeof window === "undefined") return;

  const { organizationId, workspaceName, reason } = params;

  if (organizationId) {
    clearWorkspaceSpecificData(organizationId);
  }

  const name = workspaceName || "this workspace";
  const queryParams = new URLSearchParams();

  if (reason === "DELETED") {
    try {
      window.sessionStorage.setItem("deleted_workspace_flash", name);
    } catch {
      // Ignore storage issues
    }
    queryParams.set("deleted", "1");
  } else {
    try {
      window.sessionStorage.setItem("revoked_workspace_flash", name);
    } catch {
      // Ignore storage issues
    }
    queryParams.set("revoked", "1");
  }

  if (workspaceName) {
    queryParams.set("workspace", workspaceName);
  }

  window.location.href = `/organizations?${queryParams.toString()}`;
}
