import { Search, Bell } from "lucide-react";
import { OrganizationSwitcher } from "./OrganizationSwitcher";
import { UserMenu } from "./UserMenu";
import { MobileNav } from "./MobileNav";
import type { SessionData, OrganizationContext } from "@/lib/auth";

interface HeaderProps {
  session: SessionData;
  organizations: OrganizationContext[];
  currentOrganizationId: string;
}

export function Header({ session, organizations, currentOrganizationId }: HeaderProps) {
  return (
    <header className="h-14 border-b border-zinc-200 bg-white flex items-center justify-between px-4 md:px-6 shrink-0">
      <div className="flex items-center gap-2 md:gap-4">
        <MobileNav organizationId={currentOrganizationId} role={organizations.find(o => o.organization.id === currentOrganizationId)?.role || "MEMBER"} />
        <OrganizationSwitcher 
          organizations={organizations} 
          currentOrganizationId={currentOrganizationId} 
        />
      </div>

      <div className="flex items-center gap-4 text-zinc-500">
        <div className="hidden md:flex items-center gap-2 bg-zinc-100 hover:bg-zinc-200 px-3 py-1.5 rounded-md cursor-pointer transition-colors text-sm">
          <Search className="w-4 h-4" />
          <span>Search...</span>
        </div>
        
        <button className="hover:text-zinc-900 transition-colors hidden md:block">
          <Bell className="w-5 h-5" />
        </button>
        
        <UserMenu session={session} />
      </div>
    </header>
  );
}
