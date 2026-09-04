"use client";

import type { SessionData } from "@/lib/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut } from "lucide-react";

export function UserMenu({ session }: { session: SessionData }) {
  const initial = session.user.email.substring(0, 1).toUpperCase();

  const handleSignOut = async () => {
    const NEXT_PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
    await fetch(`${NEXT_PUBLIC_API_URL}/auth/logout`, { 
      method: "POST",
      credentials: "include" 
    });
    window.location.href = "/login";
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="outline-none rounded-full focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2">
        <Avatar className="h-8 w-8 cursor-pointer hover:opacity-80 transition-opacity">
          <AvatarFallback className="bg-zinc-200 text-sm font-medium text-zinc-700">
            {initial}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none text-zinc-900 truncate">
              {session.user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem 
          className="text-red-600 focus:bg-red-50 focus:text-red-700 cursor-pointer flex items-center gap-2"
          onSelect={handleSignOut}
        >
          <LogOut className="h-4 w-4" />
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
