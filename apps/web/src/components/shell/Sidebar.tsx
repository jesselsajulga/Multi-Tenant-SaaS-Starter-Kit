"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, CreditCard, Settings, FolderKanban } from "lucide-react";

interface SidebarProps {
  organizationId: string;
  role: "OWNER" | "MEMBER";
}

export function Sidebar({ organizationId, role }: SidebarProps) {
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
      ]
    }
  ];

  return (
    <aside className="hidden md:flex w-64 border-r border-zinc-200 bg-zinc-50 flex-col shrink-0 overflow-y-auto">
      <nav className="p-4 space-y-6">
        {navGroups.map((group) => {
          if (group.hide) return null;
          
          return (
            <div key={group.label}>
              {/* Optional Section Label 
              <div className="px-3 mb-2 text-xs font-semibold text-zinc-400 tracking-wider">
                {group.label}
              </div>
              */}
              <div className="space-y-1">
                {group.items.map((item) => (
                  <NavItem 
                    key={item.href}
                    href={item.href}
                    icon={<item.icon className="w-4 h-4" />}
                    label={item.label}
                    active={pathname?.startsWith(item.href) || false}
                    disabled={item.disabled}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

function NavItem({ href, icon, label, active = false, disabled = false }: { href: string; icon?: React.ReactNode; label: string; active?: boolean; disabled?: boolean }) {
  if (disabled) {
    return (
      <div 
        className="flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors text-zinc-400 cursor-not-allowed"
        title="Coming soon"
      >
        {icon && <span className="text-zinc-300">{icon}</span>}
        {label}
      </div>
    );
  }

  return (
    <Link 
      href={href} 
      className={`flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors ${
        active 
          ? "bg-zinc-200/50 text-zinc-900 font-medium" 
          : "text-zinc-600 hover:bg-zinc-200/50 hover:text-zinc-900"
      }`}
    >
      {icon && <span className={active ? "text-zinc-900" : "text-zinc-500"}>{icon}</span>}
      {label}
    </Link>
  );
}
