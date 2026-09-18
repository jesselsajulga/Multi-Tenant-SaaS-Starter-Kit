"use client";

import { useEffect, useState, useCallback } from "react";
import { Bell, CheckCheck, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  type NotificationItem,
} from "@/lib/notifications";
import { getNotificationPresentation } from "@/lib/notificationPresentation";

export function NotificationBell() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getNotifications({ limit: 20 });
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch {
      // Fail silently without disrupting workspace operation
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      fetchNotifications();
    }
  };

  const handleItemClick = async (notif: NotificationItem) => {
    setIsOpen(false);
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
    router.push(`/notifications?notificationId=${encodeURIComponent(notif.id)}`);
  };

  const handleMarkAllRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
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

  return (
    <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Notifications"
          className="relative hover:text-zinc-900 transition-colors flex items-center justify-center w-8 h-8 rounded-full hover:bg-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-zinc-900 px-1 text-[10px] font-medium text-white ring-2 ring-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 p-0 shadow-lg border-zinc-200">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-zinc-900">Notifications</span>
            {unreadCount > 0 && (
              <span className="bg-zinc-100 text-zinc-700 text-xs px-2 py-0.5 rounded-full font-medium">
                {unreadCount} new
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-xs text-zinc-500 hover:text-zinc-900 flex items-center gap-1 font-medium transition-colors"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Mark all read
            </button>
          )}
        </div>

        <div className="max-h-[22rem] overflow-y-auto divide-y divide-zinc-50">
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-sm text-zinc-500">
              {loading ? "Loading notifications..." : "No notifications yet."}
            </div>
          ) : (
            notifications.map((notif) => {
              const isUnread = !notif.readAt;
              const formattedDate = new Date(notif.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              });

              const presentation = getNotificationPresentation(notif.type);
              const Icon = presentation.icon;

              return (
                <DropdownMenuItem
                  key={notif.id}
                  className={`p-3.5 flex items-start gap-3 cursor-pointer transition-colors focus:bg-zinc-50 ${
                    isUnread ? "bg-zinc-50/70" : "bg-white"
                  }`}
                  onSelect={() => handleItemClick(notif)}
                >
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full mt-0.5 ${presentation.iconBgColor} ${presentation.iconColor}`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="w-full min-w-0">
                    <div className="flex items-start justify-between w-full gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {isUnread && (
                          <span className="w-1.5 h-1.5 rounded-full bg-zinc-900 shrink-0" />
                        )}
                        <span
                          className={`text-xs font-semibold truncate ${
                            isUnread ? "text-zinc-900" : "text-zinc-700"
                          }`}
                        >
                          {notif.title || presentation.defaultTitle}
                        </span>
                      </div>
                      <span className="text-[11px] text-zinc-400 shrink-0">{formattedDate}</span>
                    </div>
                    {notif.message && (
                      <p className="text-xs text-zinc-600 line-clamp-2 mt-0.5">
                        {notif.message}
                      </p>
                    )}
                  </div>
                </DropdownMenuItem>
              );
            })
          )}
        </div>

        <DropdownMenuSeparator className="m-0" />
        <div className="p-2 bg-zinc-50/50">
          <Link
            href="/notifications"
            onClick={() => setIsOpen(false)}
            className="flex items-center justify-center gap-1.5 w-full py-1.5 text-xs font-medium text-zinc-700 hover:text-zinc-900 transition-colors"
          >
            <span>View all notifications</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
