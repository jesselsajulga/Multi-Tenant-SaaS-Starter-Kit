import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cookies } from "next/headers";
import { requireSession } from "@/lib/auth";
import { UserMenu } from "@/components/shell/UserMenu";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { NotificationHistoryClient } from "./NotificationHistoryClient";
import { getNotifications, type NotificationsResponse } from "@/lib/notifications";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

async function fetchInitialNotifications(sessionCookie: string): Promise<NotificationsResponse> {
  try {
    const res = await fetch(`${API_BASE_URL}/notifications?limit=20`, {
      headers: {
        Cookie: `session=${sessionCookie}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return { notifications: [], unreadCount: 0 };
    }

    return await res.json();
  } catch {
    return { notifications: [], unreadCount: 0 };
  }
}

export default async function NotificationsPage() {
  const session = await requireSession();
  const cookieStore = await cookies();
  const sessionValue = cookieStore.get("session")?.value || "";

  const data = await fetchInitialNotifications(sessionValue);

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col font-sans text-zinc-900">
      <header className="h-14 border-b border-zinc-200 bg-white flex items-center justify-between px-6">
        <div className="flex items-center gap-6">
          <Link
            href="/organizations"
            className="flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Workspaces</span>
          </Link>
          <span className="font-semibold text-base tracking-tight">Notification History</span>
        </div>

        <div className="flex items-center gap-4">
          <NotificationBell />
          <UserMenu session={session} />
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto p-6 md:p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Notification History</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Activity and important updates for <span className="font-medium text-zinc-900">{session.user.email}</span>.
          </p>
        </div>

        <NotificationHistoryClient
          initialNotifications={data.notifications}
          initialUnreadCount={data.unreadCount}
          initialNextCursor={data.nextCursor}
        />
      </main>
    </div>
  );
}
