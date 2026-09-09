import { PageHeader } from "@/components/layout/page-header";
import { InviteMemberModal } from "./InviteMemberModal";

interface TeamHeaderProps {
  organizationId: string;
  organizationName?: string;
  isOwner: boolean;
}

export function TeamHeader({ organizationId, organizationName = "Workspace", isOwner }: TeamHeaderProps) {
  return (
    <PageHeader
      breadcrumbs={[
        { label: organizationName, href: `/organizations/${organizationId}/dashboard` },
        { label: "Team" }
      ]}
      title="Team"
      description="Manage workspace members, roles, and pending invitations."
      actions={isOwner && <InviteMemberModal organizationId={organizationId} />}
    />
  );
}
