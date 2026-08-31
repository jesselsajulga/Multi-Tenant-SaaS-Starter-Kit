import { cookies } from "next/headers";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export async function fetchWithSession(path: string, options?: RequestInit) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session");

  const headers = new Headers(options?.headers);
  if (sessionCookie) {
    headers.set("Cookie", `session=${sessionCookie.value}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    cache: "no-store", // Ensure we don't cache billing data aggressively by default
  });

  return response;
}
