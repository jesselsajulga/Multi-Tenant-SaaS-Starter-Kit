"use client";

import { useRouter } from "next/navigation";
import { ChevronDown, Plus, Check } from "lucide-react";
import type { OrganizationContext } from "@/lib/auth";
import { CreateWorkspaceModal } from "@/components/shell/CreateWorkspaceModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface OrganizationSwitcherProps {
  organizations: OrganizationContext[];
  currentOrganizationId: string;
}

export function OrganizationSwitcher({ organizations, currentOrganizationId }: OrganizationSwitcherProps) {
  const router = useRouter();
  
  const currentOrg = organizations.find(o => o.organization.id === currentOrganizationId)?.organization;

  if (!currentOrg) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 text-sm font-medium hover:bg-zinc-100 py-1.5 px-3 rounded-md transition-colors outline-none focus-visible:ring-2 focus-visible:ring-zinc-950">
        <span className="truncate max-w-[150px]">{currentOrg.name}</span>
        <ChevronDown className="w-4 h-4 text-zinc-500" />
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
        
        {organizations.map((orgContext) => (
          <DropdownMenuItem
            key={orgContext.organization.id}
            onSelect={() => {
              router.push(`/organizations/${orgContext.organization.id}/dashboard`);
            }}
            className="flex items-center justify-between cursor-pointer"
          >
            <span className="truncate">{orgContext.organization.name}</span>
            {orgContext.organization.id === currentOrganizationId && (
              <Check className="w-4 h-4 text-zinc-900" />
            )}
          </DropdownMenuItem>
        ))}
        
        <DropdownMenuSeparator />
        
        <CreateWorkspaceModal 
          buttonClassName="w-full outline-none"
          buttonContent={
            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-zinc-600 gap-2 cursor-pointer w-full flex">
              <Plus className="w-4 h-4" /> Create Workspace
            </DropdownMenuItem>
          }
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
