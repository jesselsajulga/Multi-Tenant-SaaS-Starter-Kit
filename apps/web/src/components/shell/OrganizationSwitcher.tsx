"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Plus } from "lucide-react";
import type { OrganizationContext } from "@/lib/auth";

interface OrganizationSwitcherProps {
  organizations: OrganizationContext[];
  currentOrganizationId: string;
}

export function OrganizationSwitcher({ organizations, currentOrganizationId }: OrganizationSwitcherProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  const currentOrg = organizations.find(o => o.organization.id === currentOrganizationId)?.organization;

  if (!currentOrg) return null;

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-sm font-medium hover:bg-zinc-100 py-1.5 px-3 rounded-md cursor-pointer transition-colors"
      >
        <span className="truncate max-w-[150px]">{currentOrg.name}</span>
        <ChevronDown className="w-4 h-4 text-zinc-500" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-zinc-200 rounded-md shadow-lg z-50 py-1">
          <div className="px-3 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            Workspaces
          </div>
          {organizations.map((orgContext) => (
            <button
              key={orgContext.organization.id}
              onClick={() => {
                setIsOpen(false);
                router.push(`/organizations/${orgContext.organization.id}/dashboard`);
              }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-100 flex items-center justify-between"
            >
              <span className="truncate">{orgContext.organization.name}</span>
              {orgContext.organization.id === currentOrganizationId && (
                <span className="text-zinc-400 text-xs">✓</span>
              )}
            </button>
          ))}
          
          <div className="border-t border-zinc-100 mt-1 pt-1">
            <button
              onClick={() => {
                setIsOpen(false);
                // Redirect to a create workspace page if it existed, or handle modal
                alert("Create workspace coming soon");
              }}
              className="w-full text-left px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Create Workspace
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
