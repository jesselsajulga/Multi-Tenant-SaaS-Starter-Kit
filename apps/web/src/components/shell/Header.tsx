import { Search, Bell } from "lucide-react";
import { OrganizationSwitcher } from "./OrganizationSwitcher";
import { UserMenu } from "./UserMenu";
import { MobileNav } from "./MobileNav";
import type { SessionData, OrganizationContext } from "@/lib/auth";
import { Input } from "@/components/ui/input";

interface HeaderProps {
  session: SessionData;
  organizations: OrganizationContext[];
  currentOrganizationId: string;
}

export function Header({ session, organizations, currentOrganizationId }: HeaderProps) {
  return (
    <header className="flex items-center justify-between w-full">
      <div className="flex items-center gap-2 md:gap-4">
        <MobileNav organizationId={currentOrganizationId} role={organizations.find(o => o.organization.id === currentOrganizationId)?.role || "MEMBER"} />
        <OrganizationSwitcher 
          organizations={organizations} 
          currentOrganizationId={currentOrganizationId} 
        />
      </div>

      <div className="flex items-center gap-4 text-zinc-500">
        <div className="hidden md:flex relative w-64 items-center">
          <Search className="absolute left-3 w-4 h-4 text-zinc-400" />
          <Input 
            type="search" 
            placeholder="Search..." 
            aria-label="Search"
            className="pl-9 bg-zinc-100 border-transparent focus-visible:bg-white" 
          />
        </div>
        
        <button 
          aria-label="Notifications"
          className="hover:text-zinc-900 transition-colors hidden md:flex items-center justify-center w-8 h-8 rounded-full hover:bg-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
        >
          <Bell className="w-5 h-5" />
        </button>
        
        <UserMenu session={session} />
      </div>
    </header>
  );
}
