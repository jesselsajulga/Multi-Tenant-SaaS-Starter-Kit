export type NotificationType =
  | "MEMBER_INVITATION"
  | "WORKSPACE_INVITATION_ACCEPTED"
  | "WORKSPACE_INVITATION_REVOKED"
  | "WORKSPACE_MEMBER_REMOVED"
  | "WORKSPACE_DELETED";

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  invitationId?: string | null;
}

/**
 * Dispatches a user notification inside a Prisma transaction or client.
 */
export async function createNotification(
  tx: any,
  input: CreateNotificationInput
) {
  return tx.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      invitationId: input.invitationId || null,
    },
  });
}

export interface DispatchWorkspaceDeletedInput {
  organizationId: string;
  workspaceName: string;
  ownerEmail: string;
  recipientUserIds: string[];
}

/**
 * Dispatches WORKSPACE_DELETED notifications to all members post-commit.
 * Uses Promise.allSettled to ensure that a failure for one recipient does not fail the others.
 */
export async function dispatchWorkspaceDeletedNotifications(
  prismaClient: any,
  input: DispatchWorkspaceDeletedInput,
  logger?: any
) {
  const { workspaceName, ownerEmail, recipientUserIds } = input;

  if (!recipientUserIds || recipientUserIds.length === 0) {
    return [];
  }

  const results = await Promise.allSettled(
    recipientUserIds.map((userId) =>
      createNotification(prismaClient, {
        userId,
        type: "WORKSPACE_DELETED",
        title: "Workspace deleted",
        message: `The workspace "${workspaceName}" has been deleted by ${ownerEmail}.`,
      })
    )
  );

  results.forEach((res, index) => {
    if (res.status === "rejected") {
      const err = res.reason;
      const targetUserId = recipientUserIds[index];
      if (logger) {
        logger.error(
          { err, targetUserId, organizationId: input.organizationId },
          `Failed to deliver WORKSPACE_DELETED notification to user ${targetUserId}`
        );
      }
    }
  });

  return results;
}
