import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export interface User {
  id: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface SessionData {
  user: User;
}

export interface OrganizationContext {
  organization: {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    _count?: {
      projects: number;
    };
  };
  role: "OWNER" | "MEMBER";
}

/**
 * Retrieves the current authenticated user session from the backend.
 */
export async function getServerSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session");

  if (!sessionCookie) {
    return null;
  }

  try {
    const res = await fetch(`${API_URL}/auth/me`, {
      headers: {
        Cookie: `session=${sessionCookie.value}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    return data as SessionData;
  } catch (error) {
    return null;
  }
}

/**
 * Ensures the user is authenticated. Redirects to login if not.
 */
export async function requireSession(): Promise<SessionData> {
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}

/**
 * Retrieves the context (organization details and user role) for a specific organization.
 */
export async function getOrganizationContext(organizationId: string): Promise<OrganizationContext | null> {
  const result = await getOrganizationContextWithStatus(organizationId);
  return result.context;
}

export async function getOrganizationContextWithStatus(
  organizationId: string
): Promise<{ context: OrganizationContext | null; revoked?: boolean; deleted?: boolean }> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session");

  if (!sessionCookie) {
    return { context: null };
  }

  try {
    const res = await fetch(`${API_URL}/organizations/${organizationId}`, {
      headers: {
        Cookie: `session=${sessionCookie.value}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      try {
        const errData = await res.json();
        if (errData.code === "WORKSPACE_ACCESS_REVOKED") {
          return { context: null, revoked: true };
        }
        if (errData.code === "WORKSPACE_DELETED") {
          return { context: null, deleted: true };
        }
      } catch {
        // ignore json parse error
      }
      return { context: null };
    }

    const data = await res.json();
    return { context: data as OrganizationContext };
  } catch (error) {
    return { context: null };
  }
}

/**
 * Ensures the authenticated user has access to the specified organization.
 * Redirects to the organizations list if access is denied.
 */
export async function requireOrganizationAccess(organizationId: string): Promise<OrganizationContext> {
  const result = await getOrganizationContextWithStatus(organizationId);
  if (!result.context) {
    if (result.revoked) {
      redirect("/organizations?revoked=1");
    }
    if (result.deleted) {
      redirect("/organizations?deleted=1");
    }
    redirect("/organizations"); // Unauthorized or forbidden -> kick them to the picker
  }
  return result.context;
}

/**
 * Retrieves all organizations the authenticated user is a member of.
 */
export async function getUserOrganizations() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session");

  if (!sessionCookie) {
    return [];
  }

  try {
    const res = await fetch(`${API_URL}/organizations`, {
      headers: {
        Cookie: `session=${sessionCookie.value}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return [];
    }

    const data = await res.json();
    return data.organizations as OrganizationContext[];
  } catch (error) {
    return [];
  }
}
