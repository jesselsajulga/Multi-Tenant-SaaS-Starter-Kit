"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, LayoutDashboard, Users, FolderKanban, CreditCard, Settings, ScrollText, ToggleRight } from "lucide-react";

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
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="md:hidden mr-2 p-2 -ml-2 text-zinc-500 hover:bg-zinc-100 rounded-md"
      >
        <Menu className="w-5 h-5" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          {/* Overlay */}
          <div 
            className="fixed inset-0 bg-black/50" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Drawer */}
          <div className="relative w-64 max-w-sm bg-white flex flex-col shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-zinc-200">
              <span className="font-semibold text-zinc-900">Menu</span>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-2 text-zinc-500 hover:bg-zinc-100 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
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
          </div>
        </div>
      )}
    </>
  );
}
