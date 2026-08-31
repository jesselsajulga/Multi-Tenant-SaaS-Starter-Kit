"use client";

import { useState } from "react";
import type { SessionData } from "@/lib/auth";

export function UserMenu({ session }: { session: SessionData }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-200 text-sm font-medium text-zinc-700 hover:bg-zinc-300 transition-colors focus:outline-none"
      >
        {session.user.email.substring(0, 1).toUpperCase()}
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-56 bg-white border border-zinc-200 rounded-md shadow-lg z-50 py-1">
          <div className="px-4 py-2 border-b border-zinc-100">
            <p className="text-sm font-medium text-zinc-900 truncate">{session.user.email}</p>
          </div>
          
          <div className="py-1">
            <button
              onClick={async () => {
                const NEXT_PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
                await fetch(`${NEXT_PUBLIC_API_URL}/auth/logout`, { method: "POST" });
                window.location.href = "/login";
              }}
              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-zinc-100"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
