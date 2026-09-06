import { PageHeader } from "@/components/layout/page-header";
import { InviteMemberModal } from "./InviteMemberModal";

interface TeamHeaderProps {
  organizationId: string;
  isOwner: boolean;
}

export function TeamHeader({ organizationId, isOwner }: TeamHeaderProps) {
  return (
    <div className="mb-8">
      <PageHeader
        title="Team Management"
        description="Manage who has access to this workspace."
        actions={isOwner && <InviteMemberModal organizationId={organizationId} />}
      />
    </div>
  );
}
