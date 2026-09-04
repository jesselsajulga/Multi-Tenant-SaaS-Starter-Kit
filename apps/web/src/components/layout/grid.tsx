import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const gridVariants = cva("grid", {
  variants: {
    cols: {
      1: "grid-cols-1",
      2: "grid-cols-1 sm:grid-cols-2",
      3: "grid-cols-1 sm:grid-cols-2 md:grid-cols-3",
      4: "grid-cols-1 sm:grid-cols-2 md:grid-cols-4",
      5: "grid-cols-1 sm:grid-cols-3 md:grid-cols-5",
      6: "grid-cols-1 sm:grid-cols-3 md:grid-cols-6",
    },
    gap: {
      0: "gap-0",
      1: "gap-1",
      2: "gap-2",
      3: "gap-3",
      4: "gap-4",
      5: "gap-5",
      6: "gap-6",
      8: "gap-8",
      10: "gap-10",
      12: "gap-12",
    },
  },
  defaultVariants: {
    cols: 1,
    gap: 4,
  },
})

export interface GridProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof gridVariants> {
  as?: React.ElementType
}

const Grid = React.forwardRef<HTMLDivElement, GridProps>(
  ({ className, cols, gap, as: Component = "div", ...props }, ref) => {
    return (
      <Component
        ref={ref}
        className={cn(gridVariants({ cols, gap, className }))}
        {...props}
      />
    )
  }
)
Grid.displayName = "Grid"

export { Grid, gridVariants }
