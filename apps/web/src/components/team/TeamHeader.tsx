import { InviteMemberModal } from "./InviteMemberModal";

interface TeamHeaderProps {
  organizationId: string;
  isOwner: boolean;
}

export function TeamHeader({ organizationId, isOwner }: TeamHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 mb-1">
          Team Management
        </h1>
        <p className="text-zinc-600">
          Manage who has access to this workspace.
        </p>
      </div>
      
      {isOwner && (
        <InviteMemberModal organizationId={organizationId} />
      )}
    </div>
  );
}
