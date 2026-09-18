const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string | null;
  invitationId: string | null;
  readAt: string | null;
  createdAt: string;
  invitation?: {
    id: string;
    status: string;
    expiresAt: string;
    role: string;
    organization: {
      id: string;
      name: string;
    };
  } | null;
}

export interface NotificationsResponse {
  notifications: NotificationItem[];
  unreadCount: number;
  nextCursor?: string | null;
}

export interface ReceivedInvitation {
  id: string;
  role: string;
  status: string;
  expiresAt: string;
  createdAt: string;
  organization: {
    id: string;
    name: string;
  };
  inviter: {
    email: string;
  };
}

export interface ReceivedInvitationsResponse {
  invitations: ReceivedInvitation[];
}

export async function getNotifications(params?: {
  cursor?: string;
  limit?: number;
}): Promise<NotificationsResponse> {
  const query = new URLSearchParams();
  if (params?.cursor) query.set("cursor", params.cursor);
  if (params?.limit) query.set("limit", params.limit.toString());

  const url = `${API_BASE_URL}/notifications${query.toString() ? `?${query.toString()}` : ""}`;
  const res = await fetch(url, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to load notifications: ${res.status}`);
  }

  return res.json();
}

export async function markNotificationAsRead(id: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/notifications/${id}/read`, {
    method: "PATCH",
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error(`Failed to mark notification as read: ${res.status}`);
  }
}

export async function markAllNotificationsAsRead(): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/notifications/read-all`, {
    method: "POST",
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error(`Failed to mark all notifications as read: ${res.status}`);
  }
}

export async function getReceivedInvitations(): Promise<ReceivedInvitationsResponse> {
  const res = await fetch(`${API_BASE_URL}/invitations/received`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to load received invitations: ${res.status}`);
  }

  return res.json();
}

export async function acceptReceivedInvitation(id: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/invitations/${id}/accept`, {
    method: "POST",
    credentials: "include",
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to accept invitation (${res.status})`);
  }
}

export async function declineReceivedInvitation(id: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/invitations/${id}/decline`, {
    method: "POST",
    credentials: "include",
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to decline invitation (${res.status})`);
  }
}
