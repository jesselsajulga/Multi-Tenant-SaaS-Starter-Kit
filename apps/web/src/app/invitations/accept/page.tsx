import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth";
import { AcceptInvitationClient } from "./AcceptInvitationClient";

export default async function AcceptInvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { token } = await searchParams;

  if (!token || typeof token !== "string") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans text-zinc-900 p-4">
        <div className="bg-red-50 text-red-600 p-4 rounded-md border border-red-200">
          Invalid or missing invitation token.
        </div>
      </div>
    );
  }

  const session = await getServerSession();
  
  if (!session) {
    // If they aren't logged in, they must log in (or sign up) first to accept the invitation
    // We pass the token as a callback param or just redirect them.
    // Given the starter nature, we'll just redirect to login with a message or next param.
    // For now, redirect to /login
    redirect(`/login`);
  }

  return <AcceptInvitationClient token={token} />;
}
