import { cn } from "cn"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-[color-mix(in_oklch,var(--muted),var(--foreground)_5%)]", className)}
      {...props}
    />
  )
}

export { Skeleton }
