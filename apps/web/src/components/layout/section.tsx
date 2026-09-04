import * as React from "react"
import { cn } from "@/lib/utils"

export interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType
}

const Section = React.forwardRef<HTMLElement, SectionProps>(
  ({ className, as: Component = "section", ...props }, ref) => {
    return (
      <Component
        ref={ref}
        className={cn("py-8 md:py-12 lg:py-16", className)}
        {...props}
      />
    )
  }
)
Section.displayName = "Section"

export { Section }
