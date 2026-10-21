import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router'

export function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="-ml-1 inline-flex w-fit items-center gap-1.5 rounded-md px-1 py-0.5 text-label text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      {label}
    </Link>
  )
}
