import { Check, Eye, Minus } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ACCESS_AREA_LABELS, ACCESS_AREAS, ROLE_ACCESS, ROLE_DESCRIPTIONS, ROLE_LABELS, type AccessLevel } from '@/data/domain/staff-rules'
import { DemoNotice } from '@/features/auth/components/auth-card'
import { cn } from '@/lib/utils'
import { STAFF_ROLES, type StaffRole } from '@/types'

const LEVEL_LABELS: Record<AccessLevel, string> = { manage: 'Manage', view: 'View', none: 'No access' }

function Level({ level }: { level: AccessLevel }) {
  const Icon = level === 'manage' ? Check : level === 'view' ? Eye : Minus
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap', level === 'manage' ? 'text-foreground' : 'text-muted-foreground')}>
      <Icon className={cn('size-3.5 shrink-0', level === 'manage' && 'text-success')} aria-hidden="true" />
      {LEVEL_LABELS[level]}
    </span>
  )
}

/** The fixed demo roles and what each would allow. Read-only; access isn't enforced in this demo. */
export function RoleMatrix({ counts }: { counts: Record<StaffRole, number> }) {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          Roles and access
        </CardTitle>
        <CardDescription>Propwise has six fixed roles. Choose a role when you add or edit a team member.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <DemoNotice>Demo: roles describe what each person would be allowed to do. Access isn’t enforced in this demo, so anyone using this browser can do everything.</DemoNotice>

        <ul aria-label="Roles" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {STAFF_ROLES.map((role) => (
            <li key={role} className="rounded-lg border border-border p-3">
              <p className="flex items-baseline justify-between gap-2">
                <span className="text-body font-medium text-foreground">{ROLE_LABELS[role]}</span>
                <span className="text-caption text-muted-foreground tabular-nums">
                  {counts[role]} active {counts[role] === 1 ? 'member' : 'members'}
                </span>
              </p>
              <p className="mt-1 text-caption text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</p>
            </li>
          ))}
        </ul>

        {/* Phones: one list per role. */}
        <ul aria-label="Access by role" className="flex flex-col gap-3 md:hidden">
          {STAFF_ROLES.map((role) => (
            <li key={role} className="rounded-lg border border-border p-3">
              <p className="mb-2 text-label text-foreground">{ROLE_LABELS[role]}</p>
              <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-caption">
                {ACCESS_AREAS.map((area) => (
                  <div key={area} className="contents">
                    <dt className="text-muted-foreground">{ACCESS_AREA_LABELS[area]}</dt>
                    <dd>
                      <Level level={ROLE_ACCESS[role][area]} />
                    </dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>

        <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
          <table className="w-full min-w-[52rem] border-collapse text-left text-body">
            <caption className="sr-only">Access by role</caption>
            <thead className="bg-muted/50">
              <tr>
                <th scope="col" className="px-3 py-2 text-label text-foreground">
                  Area
                </th>
                {STAFF_ROLES.map((role) => (
                  <th key={role} scope="col" className="px-3 py-2 text-label text-foreground">
                    {ROLE_LABELS[role]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ACCESS_AREAS.map((area) => (
                <tr key={area} className="border-t border-border">
                  <th scope="row" className="px-3 py-2 font-medium text-foreground">
                    {ACCESS_AREA_LABELS[area]}
                  </th>
                  {STAFF_ROLES.map((role) => (
                    <td key={role} className="px-3 py-2 text-caption">
                      <Level level={ROLE_ACCESS[role][area]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
