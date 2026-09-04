import * as React from "react"
import { cn } from "@/lib/utils"

export interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  description?: string
  actions?: React.ReactNode
}

const PageHeader = React.forwardRef<HTMLDivElement, PageHeaderProps>(
  ({ className, title, description, actions, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0", className)}
        {...props}
      >
        <div className="flex flex-col space-y-1">
          <h1 className="text-2xl font-semibold text-zinc-950 tracking-tight">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-zinc-500">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex items-center space-x-2">
            {actions}
          </div>
        )}
      </div>
    )
  }
)
PageHeader.displayName = "PageHeader"

export { PageHeader }
