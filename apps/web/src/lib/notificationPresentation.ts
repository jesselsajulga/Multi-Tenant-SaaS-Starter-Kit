import {
  Mail,
  CheckCircle2,
  XCircle,
  UserMinus,
  FolderMinus,
  Trash2,
  Bell,
  type LucideIcon,
} from "lucide-react";
import type { NotificationItem } from "./notifications";

export interface NotificationPresentation {
  icon: LucideIcon;
  iconBgColor: string;
  iconColor: string;
  badgeLabel: string;
  isActionable: boolean;
  defaultTitle: string;
}

export function getNotificationPresentation(type: string): NotificationPresentation {
  switch (type) {
    case "MEMBER_INVITATION":
    case "WORKSPACE_INVITATION":
      return {
        icon: Mail,
        iconBgColor: "bg-blue-50",
        iconColor: "text-blue-600",
        badgeLabel: "Invitation",
        isActionable: true,
        defaultTitle: "Workspace Invitation",
      };

    case "WORKSPACE_INVITATION_ACCEPTED":
      return {
        icon: CheckCircle2,
        iconBgColor: "bg-green-50",
        iconColor: "text-green-600",
        badgeLabel: "Accepted",
        isActionable: false,
        defaultTitle: "Invitation Accepted",
      };

    case "WORKSPACE_INVITATION_REVOKED":
      return {
        icon: XCircle,
        iconBgColor: "bg-amber-50",
        iconColor: "text-amber-600",
        badgeLabel: "Revoked",
        isActionable: false,
        defaultTitle: "Invitation Revoked",
      };

    case "WORKSPACE_MEMBER_REMOVED":
      return {
        icon: UserMinus,
        iconBgColor: "bg-red-50",
        iconColor: "text-red-600",
        badgeLabel: "Access Removed",
        isActionable: false,
        defaultTitle: "Access Removed",
      };

    case "PROJECT_MEMBER_REMOVED":
      return {
        icon: FolderMinus,
        iconBgColor: "bg-purple-50",
        iconColor: "text-purple-600",
        badgeLabel: "Project Removed",
        isActionable: false,
        defaultTitle: "Project Access Removed",
      };

    case "WORKSPACE_DELETED":
      return {
        icon: Trash2,
        iconBgColor: "bg-red-50",
        iconColor: "text-red-600",
        badgeLabel: "Deleted",
        isActionable: false,
        defaultTitle: "Workspace Deleted",
      };

    default:
      return {
        icon: Bell,
        iconBgColor: "bg-zinc-100",
        iconColor: "text-zinc-600",
        badgeLabel: "Notice",
        isActionable: false,
        defaultTitle: "Notification",
      };
  }
}

export function isPendingInvitationNotification(notification: NotificationItem): boolean {
  if (
    notification.type !== "MEMBER_INVITATION" &&
    notification.type !== "WORKSPACE_INVITATION"
  ) {
    return false;
  }

  // If invitation relation is loaded, check if it's still PENDING and not expired
  if (notification.invitation) {
    const isPending = notification.invitation.status === "PENDING";
    const notExpired = new Date(notification.invitation.expiresAt) > new Date();
    return isPending && notExpired;
  }

  // Fallback: if no relation object, assume actionable if invitationId exists
  return !!notification.invitationId;
}
