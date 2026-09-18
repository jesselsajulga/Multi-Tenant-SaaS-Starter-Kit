"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Check,
  X,
  CheckCheck,
  Building2,
  Clock,
  User,
  AlertCircle,
} from "lucide-react";
import {
  acceptReceivedInvitation,
  declineReceivedInvitation,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getNotifications,
  type NotificationItem,
} from "@/lib/notifications";
import {
  getNotificationPresentation,
  isPendingInvitationNotification,
} from "@/lib/notificationPresentation";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { WelcomeWorkspaceModal } from "@/components/team/WelcomeWorkspaceModal";

export function NotificationHistoryClient({
  initialNotifications,
  initialUnreadCount,
  initialNextCursor,
}: {
  initialNotifications: NotificationItem[];
  initialUnreadCount: number;
  initialNextCursor?: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const targetNotificationId = searchParams.get("notificationId");

  const [notifications, setNotifications] = useState<NotificationItem[]>(initialNotifications);
  const [unreadCount, setUnreadCount] = useState<number>(initialUnreadCount);
  const [nextCursor, setNextCursor] = useState<string | null | undefined>(initialNextCursor);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [activeAction, setActiveAction] = useState<{ id: string; type: "accept" | "decline" } | null>(null);
  const [successAction, setSuccessAction] = useState<{ id: string; type: "accept" | "decline" } | null>(null);
  const [welcomeOrg, setWelcomeOrg] = useState<{ name: string; id: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Deep-link scroll & gentle highlight
  useEffect(() => {
    if (!targetNotificationId) return;

    const el = itemRefs.current.get(targetNotificationId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedId(targetNotificationId);

      // Clean query parameter after arrival
      if (typeof window !== "undefined" && window.history?.replaceState) {
        const url = new URL(window.location.href);
        url.searchParams.delete("notificationId");
        window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
      }

      const timer = setTimeout(() => {
        setHighlightedId(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [targetNotificationId, notifications]);

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsAsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch {
      // Ignore error
    }
  };

  const handleItemClick = async (notif: NotificationItem) => {
    if (!notif.readAt) {
      try {
        await markNotificationAsRead(notif.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, readAt: new Date().toISOString() } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch {
        // Ignore error
      }
    }
  };

  const handleAccept = async (notif: NotificationItem) => {
    const inviteId = notif.invitation?.id || notif.invitationId;
    if (!inviteId) return;
    if (activeAction || successAction || welcomeOrg) return;

    setActiveAction({ id: notif.id, type: "accept" });
    setError(null);

    try {
      const minDelay = new Promise((resolve) => setTimeout(resolve, 2500));
      const acceptPromise = acceptReceivedInvitation(inviteId);

      await Promise.all([acceptPromise, minDelay]);

      // Mark notification as read in UI
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, readAt: new Date().toISOString() } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      // Show celebration Welcome modal
      setActiveAction(null);
      const orgName = notif.invitation?.organization?.name || "Workspace";
      const orgId = notif.invitation?.organization?.id || "";
      setWelcomeOrg({ name: orgName, id: orgId });
    } catch (err: any) {
      setError(err.message || "Failed to accept invitation");
      setActiveAction(null);
    }
  };

  const handleWelcomeConfirm = () => {
    if (!welcomeOrg) return;
    const orgId = welcomeOrg.id;
    setWelcomeOrg(null);
    if (orgId) {
      router.push(`/organizations/${orgId}/dashboard`);
    } else {
      router.push(`/organizations`);
    }
    router.refresh();
  };

  const handleDecline = async (notif: NotificationItem) => {
    const inviteId = notif.invitation?.id || notif.invitationId;
    if (!inviteId) return;
    if (activeAction || successAction) return;

    setActiveAction({ id: notif.id, type: "decline" });
    setError(null);

    try {
      const minDelay = new Promise((resolve) => setTimeout(resolve, 2500));
      const declinePromise = declineReceivedInvitation(inviteId);

      await Promise.all([declinePromise, minDelay]);

      // Mark notification as read
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, readAt: new Date().toISOString() } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      setSuccessAction({ id: notif.id, type: "decline" });
      setActiveAction(null);

      setTimeout(() => {
        setSuccessAction(null);
        router.refresh();
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Failed to decline invitation");
      setActiveAction(null);
    }
  };

  const handleLoadMore = async () => {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);

    try {
      const data = await getNotifications({ cursor: nextCursor, limit: 20 });
      setNotifications((prev) => [...prev, ...data.notifications]);
      setNextCursor(data.nextCursor);
    } catch {
      // Ignore load more failure
    } finally {
      setIsLoadingMore(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Action Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-zinc-700">
            {notifications.length} {notifications.length === 1 ? "notification" : "notifications"}
          </span>
          {unreadCount > 0 && (
            <span className="bg-zinc-900 text-white text-xs px-2 py-0.5 rounded-full font-medium">
              {unreadCount} unread
            </span>
          )}
        </div>

        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllRead}
            className="text-xs text-zinc-600 hover:text-zinc-900 flex items-center gap-1.5 font-medium"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span>Mark all as read</span>
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 mb-4">
            <Building2 className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-semibold text-zinc-900">You have no notifications.</h2>
          <p className="mt-1 text-sm text-zinc-500 max-w-sm mx-auto">
            Activity and important updates will appear here.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {notifications.map((notif) => {
            const isUnread = !notif.readAt;
            const presentation = getNotificationPresentation(notif.type);
            const Icon = presentation.icon;
            const isActionable = isPendingInvitationNotification(notif);

            const isAccepting = activeAction?.id === notif.id && activeAction?.type === "accept";
            const isDeclining = activeAction?.id === notif.id && activeAction?.type === "decline";
            const isAcceptSuccess = successAction?.id === notif.id && successAction?.type === "accept";
            const isDeclineSuccess = successAction?.id === notif.id && successAction?.type === "decline";
            const isRowBusy = activeAction !== null || successAction !== null || welcomeOrg !== null;

            const isHighlighted = highlightedId === notif.id;

            const formattedDate = new Date(notif.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            });

            return (
              <div
                key={notif.id}
                ref={(el) => {
                  if (el) itemRefs.current.set(notif.id, el);
                  else itemRefs.current.delete(notif.id);
                }}
                onClick={() => handleItemClick(notif)}
                className={`relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border bg-white p-5 shadow-sm transition-all duration-300 ${
                  isHighlighted
                    ? "ring-2 ring-zinc-900 border-zinc-900 bg-zinc-50/50"
                    : isUnread
                    ? "border-zinc-300 bg-white"
                    : "border-zinc-200 bg-white hover:border-zinc-300"
                }`}
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl mt-0.5 ${presentation.iconBgColor} ${presentation.iconColor}`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>

                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-zinc-900 text-sm">
                        {notif.title || presentation.defaultTitle}
                      </h3>
                      <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600">
                        {presentation.badgeLabel}
                      </span>
                      {isUnread && (
                        <span className="w-2 h-2 rounded-full bg-zinc-900 shrink-0" />
                      )}
                    </div>

                    {notif.message && (
                      <p className="text-sm text-zinc-600 leading-relaxed">
                        {notif.message}
                      </p>
                    )}

                    <div className="flex items-center gap-3 text-xs text-zinc-400 pt-0.5">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {formattedDate}
                      </span>
                      {notif.invitation?.role && (
                        <span>Role: {notif.invitation.role}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action buttons for pending invitations */}
                {isActionable && (
                  <div
                    className="flex items-center gap-2 pt-2 sm:pt-0 shrink-0 self-end sm:self-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      variant={isDeclineSuccess ? "success" : "outline"}
                      size="sm"
                      disabled={isRowBusy}
                      onClick={() => handleDecline(notif)}
                      className={
                        isDeclineSuccess
                          ? "!bg-green-600 hover:!bg-green-600 !text-white !opacity-100"
                          : "text-zinc-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50"
                      }
                    >
                      {isDeclineSuccess ? (
                        <>
                          <Check className="w-4 h-4 mr-1.5" />
                          <span>Declined</span>
                        </>
                      ) : isDeclining ? (
                        <>
                          <Spinner size="sm" className="mr-1.5 text-zinc-600" />
                          <span>Declining...</span>
                        </>
                      ) : (
                        <>
                          <X className="w-4 h-4 mr-1.5" />
                          <span>Decline</span>
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant={isAcceptSuccess ? "success" : "default"}
                      disabled={isRowBusy}
                      onClick={() => handleAccept(notif)}
                      className={
                        isAcceptSuccess
                          ? "!bg-green-600 hover:!bg-green-600 !text-white !opacity-100"
                          : "bg-zinc-900 text-white hover:bg-zinc-800"
                      }
                    >
                      {isAcceptSuccess ? (
                        <>
                          <Check className="w-4 h-4 mr-1.5" />
                          <span>Accepted!</span>
                        </>
                      ) : isAccepting ? (
                        <>
                          <Spinner size="sm" className="mr-1.5 text-zinc-50" />
                          <span>Accepting...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4 mr-1.5" />
                          <span>Accept Invitation</span>
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}

          {/* Load More Button */}
          {nextCursor && (
            <div className="text-center pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className="text-zinc-600 hover:text-zinc-900"
              >
                {isLoadingMore ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    <span>Loading more...</span>
                  </>
                ) : (
                  <span>Load more notifications</span>
                )}
              </Button>
            </div>
          )}
        </div>
      )}

      {welcomeOrg && (
        <WelcomeWorkspaceModal
          open={welcomeOrg !== null}
          organizationName={welcomeOrg.name}
          onConfirm={handleWelcomeConfirm}
        />
      )}
    </div>
  );
}
