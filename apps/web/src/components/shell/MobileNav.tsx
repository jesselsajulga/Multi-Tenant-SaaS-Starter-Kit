"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, LayoutDashboard, Users, FolderKanban, CreditCard, Settings, ScrollText, ToggleRight } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

interface MobileNavProps {
  organizationId: string;
  role: "OWNER" | "MEMBER";
}

export function MobileNav({ organizationId, role }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  type NavItem = { label: string; href: string; icon: any; disabled?: boolean };
  type NavGroup = { label: string; hide?: boolean; items: NavItem[] };

  const navGroups: NavGroup[] = [
    {
      label: "WORKSPACE",
      items: [
        { label: "Dashboard", href: `/organizations/${organizationId}/dashboard`, icon: LayoutDashboard },
      ]
    },
    {
      label: "WORK",
      items: [
        { label: "Team", href: `/organizations/${organizationId}/team`, icon: Users },
        { label: "Projects", href: `/organizations/${organizationId}/projects`, icon: FolderKanban },
      ]
    },
    {
      label: "BILLING",
      hide: role === "MEMBER",
      items: [
        { label: "Overview", href: `/organizations/${organizationId}/billing`, icon: CreditCard },
        { label: "Usage", href: `/organizations/${organizationId}/billing/usage`, icon: LayoutDashboard },
        { label: "Subscription", href: `/organizations/${organizationId}/billing/subscription`, icon: FolderKanban },
      ]
    },
    {
      label: "ADMINISTRATION",
      hide: role === "MEMBER",
      items: [
        { label: "Settings", href: `/organizations/${organizationId}/settings`, icon: Settings },
        { label: "Feature Flags", href: `/organizations/${organizationId}/feature-flags`, icon: ToggleRight },
        { label: "Audit Logs", href: `/organizations/${organizationId}/audit-logs`, icon: ScrollText },
      ]
    }
  ];

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger className="md:hidden mr-2 p-2 -ml-2 text-zinc-500 hover:bg-zinc-100 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950">
        <Menu className="w-5 h-5" />
      </SheetTrigger>

      <SheetContent side="left" className="w-[80vw] max-w-sm p-0 flex flex-col">
        <SheetHeader className="p-4 border-b border-zinc-200 text-left">
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>
        
        <nav className="flex-1 overflow-y-auto p-4 space-y-6">
          {navGroups.map((group) => {
            if (group.hide) return null;
            
            return (
              <div key={group.label}>
                <div className="px-3 mb-2 text-xs font-semibold text-zinc-400 tracking-wider">
                  {group.label}
                </div>
                <div className="space-y-1">
                  {group.items.map((item) => (
                    item.disabled ? (
                      <div 
                        key={item.href}
                        className="flex items-center gap-3 px-3 py-2 text-sm rounded-md text-zinc-400"
                      >
                        <item.icon className="w-4 h-4 text-zinc-300" />
                        {item.label}
                      </div>
                    ) : (
                      <Link 
                        key={item.href}
                        href={item.href}
                        onClick={() => setIsOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors ${
                          pathname?.startsWith(item.href)
                            ? "bg-zinc-100 text-zinc-900 font-medium" 
                            : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                        }`}
                      >
                        <item.icon className={`w-4 h-4 ${pathname?.startsWith(item.href) ? "text-zinc-900" : "text-zinc-500"}`} />
                        {item.label}
                      </Link>
                    )
                  ))}
                </div>
              </div>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
