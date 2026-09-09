import { cookies } from "next/headers";
import { getOrganizationContext, requireSession } from "@/lib/auth";
import { TeamHeader } from "@/components/team/TeamHeader";
import { TeamList } from "@/components/team/TeamList";
import { InvitationsList } from "@/components/team/InvitationsList";
import type { MemberData } from "@/components/team/TeamList";
import type { InvitationData } from "@/components/team/InvitationsList";
import { Container } from "@/components/layout/container";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
    <Container>
      <TeamHeader 
        organizationId={organizationId} 
        organizationName={context.organization.name}
        isOwner={isOwner} 
      />

      {members === null ? (
        <Alert variant="destructive" className="mb-8">
          <AlertDescription>
            Unable to load workspace members.
          </AlertDescription>
        </Alert>
      ) : (
        <TeamList 
          organizationId={organizationId} 
          members={members} 
          isOwner={isOwner} 
        />
      )}

      {invitations.error ? (
        <Alert variant="destructive" className="mt-8">
          <AlertDescription>
            Unable to load pending invitations.
          </AlertDescription>
        </Alert>
      ) : !invitations.forbidden && invitations.data ? (
        <InvitationsList 
          organizationId={organizationId} 
          invitations={invitations.data} 
          isOwner={isOwner} 
        />
      ) : null}
    </Container>
  );
}
