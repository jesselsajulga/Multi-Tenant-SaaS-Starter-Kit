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
      return { error: errorData.error || "An error occurred" };
    } catch {
      return { error: `HTTP error! status: ${response.status}` };
    }
  }

  try {
    return await response.json();
  } catch {
    return { success: true };
  }
}
