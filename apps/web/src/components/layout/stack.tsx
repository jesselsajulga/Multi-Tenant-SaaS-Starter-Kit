import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const stackVariants = cva("flex", {
  variants: {
    direction: {
      row: "flex-row",
      col: "flex-col",
      "row-reverse": "flex-row-reverse",
      "col-reverse": "flex-col-reverse",
    },
    align: {
      start: "items-start",
      center: "items-center",
      end: "items-end",
      stretch: "items-stretch",
      baseline: "items-baseline",
    },
    justify: {
      start: "justify-start",
      center: "justify-center",
      end: "justify-end",
      between: "justify-between",
      around: "justify-around",
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
    direction: "col",
    gap: 4,
  },
})

export interface StackProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof stackVariants> {
  as?: React.ElementType
}

const Stack = React.forwardRef<HTMLDivElement, StackProps>(
  (
    { className, direction, align, justify, gap, as: Component = "div", ...props },
    ref
  ) => {
    return (
      <Component
        ref={ref}
        className={cn(stackVariants({ direction, align, justify, gap, className }))}
        {...props}
      />
    )
  }
)
Stack.displayName = "Stack"

export { Stack, stackVariants }
