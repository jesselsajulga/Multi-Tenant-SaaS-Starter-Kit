import { cookies } from "next/headers";
import { getOrganizationContext, requireSession } from "@/lib/auth";
import { TeamHeader } from "@/components/team/TeamHeader";
import { TeamList } from "@/components/team/TeamList";
import { InvitationsList } from "@/components/team/InvitationsList";
import type { MemberData } from "@/components/team/TeamList";
import type { InvitationData } from "@/components/team/InvitationsList";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

async function fetchMembers(organizationId: string, sessionValue: string) {
  const res = await fetch(`${API_URL}/organizations/${organizationId}/members`, {
    headers: { Cookie: `session=${sessionValue}` },
    cache: "no-store",
  });
  
  if (!res.ok) {
    throw new Error(`Failed to fetch members: ${res.status}`);
  }
  
  const data = await res.json();
  return data.members as MemberData[];
}

async function fetchInvitations(organizationId: string, sessionValue: string) {
  const res = await fetch(`${API_URL}/organizations/${organizationId}/invitations`, {
    headers: { Cookie: `session=${sessionValue}` },
    cache: "no-store",
  });
  
  if (res.status === 403 || res.status === 401) {
    return { data: null, error: false, forbidden: true };
  }
  
  if (!res.ok) {
    return { data: null, error: true, forbidden: false };
  }
  
  const data = await res.json();
  return { data: data.invitations as InvitationData[], error: false, forbidden: false };
}

export default async function TeamPage({ params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params;
  await requireSession();
  const context = await getOrganizationContext(organizationId);

  if (!context) {
    return null; // Handled by layout
  }

  const cookieStore = await cookies();
  const sessionValue = cookieStore.get("session")?.value || "";

  // Fetch data concurrently
  const [membersResult, invitationsResult] = await Promise.allSettled([
    fetchMembers(organizationId, sessionValue),
    fetchInvitations(organizationId, sessionValue)
  ]);

  const members = membersResult.status === "fulfilled" ? membersResult.value : null;
  const invitations = invitationsResult.status === "fulfilled" ? invitationsResult.value : { data: null, error: true, forbidden: false };

  const isOwner = context.role === "OWNER";

  return (
    <div className="max-w-5xl">
      <TeamHeader organizationId={organizationId} isOwner={isOwner} />

      {members === null ? (
        <div className="bg-red-50 text-red-600 p-4 rounded-md mb-8 border border-red-200 text-sm">
          Unable to load workspace members.
        </div>
      ) : (
        <TeamList 
          organizationId={organizationId} 
          members={members} 
          isOwner={isOwner} 
        />
      )}

      {invitations.error ? (
        <div className="bg-red-50 text-red-600 p-4 rounded-md mt-8 border border-red-200 text-sm">
          Unable to load pending invitations.
        </div>
      ) : !invitations.forbidden && invitations.data ? (
        <InvitationsList 
          organizationId={organizationId} 
          invitations={invitations.data} 
          isOwner={isOwner} 
        />
      ) : null}
    </div>
  );
}
