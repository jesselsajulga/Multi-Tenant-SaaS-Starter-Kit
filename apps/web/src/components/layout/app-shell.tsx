import * as React from "react"
import { cn } from "@/lib/utils"

export interface AppShellProps extends React.HTMLAttributes<HTMLDivElement> {
  sidebar?: React.ReactNode
  header?: React.ReactNode
}

const AppShell = React.forwardRef<HTMLDivElement, AppShellProps>(
  ({ className, sidebar, header, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn("flex min-h-screen bg-zinc-50", className)} {...props}>
        {/* Sidebar container */}
        {sidebar && (
          <div className="hidden w-64 shrink-0 flex-col md:flex">
            {sidebar}
          </div>
        )}
        
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Header container */}
          {header && (
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-4 md:px-6">
              {header}
            </div>
          )}
          
          {/* Main content area */}
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    )
  }
)
AppShell.displayName = "AppShell"

export { AppShell }
