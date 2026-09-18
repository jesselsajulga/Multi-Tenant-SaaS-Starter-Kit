const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export async function apiClient(path: string, options?: RequestInit) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    // We rely on the browser to send the 'session' cookie via credentials
    credentials: "include",
  });

  if (!response.ok) {
    try {
      const errorData = await response.json();
      if (typeof window !== "undefined") {
        // Dynamically extract organizationId from path if applicable (e.g., /organizations/:id/...)
        const orgMatch = path.match(/\/organizations\/([^/]+)/);
        const organizationId = orgMatch ? orgMatch[1] : undefined;

        if (response.status === 403 && errorData.code === "WORKSPACE_ACCESS_REVOKED") {
          const { handleWorkspaceAccessRevoked } = await import("./workspace-ejection");
          handleWorkspaceAccessRevoked({ organizationId });
        } else if (errorData.code === "WORKSPACE_DELETED") {
          const { handleWorkspaceDeleted } = await import("./workspace-ejection");
          handleWorkspaceDeleted({ organizationId });
        }
      }
      return { 
        error: errorData.error || "An error occurred", 
        code: errorData.code, 
        status: response.status 
      };
    } catch {
      return { error: `HTTP error! status: ${response.status}`, status: response.status };
    }
  }

  try {
    return await response.json();
  } catch {
    return { success: true };
  }
}
