import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium [&>svg]:size-3", {
  variants: {
    variant: {
      default: "border-transparent bg-sage-100 text-sage-800",
      neutral: "border-transparent bg-secondary text-secondary-foreground",
      gold: "border-transparent bg-accent text-accent-foreground",
      success: "border-transparent bg-sage-200 text-sage-900",
      warning: "border-transparent bg-[#f6ead0] text-[#7a5a12]",
      danger: "border-transparent bg-[#f4dfdb] text-[#8a3b32]",
      outline: "border-border bg-transparent text-muted-foreground",
    },
  },
  defaultVariants: { variant: "default" },
});

function Badge({ className, variant, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
