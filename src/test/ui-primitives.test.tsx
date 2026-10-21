import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

describe('shadcn/ui primitives', () => {
  it('render with accessible roles', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <Button>Save</Button>
          <Badge>Active</Badge>
          <Label htmlFor="name">Name</Label>
          <Input id="name" />
          <Checkbox aria-label="Accept" />
          <Switch aria-label="Notifications" />
          <Separator />
          <Skeleton data-testid="skeleton" />
          <Avatar>
            <AvatarFallback>LG</AvatarFallback>
          </Avatar>
          <Table>
            <TableBody>
              <TableRow>
                <TableCell>Unit 101</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>,
    )

    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Accept' })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Notifications' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'Unit 101' })).toBeInTheDocument()
    expect(screen.getByText('LG')).toBeInTheDocument()
  })

  it('switches tabs with the keyboard and mouse', async () => {
    const user = userEvent.setup()
    render(
      <Tabs defaultValue="residential">
        <TabsList>
          <TabsTrigger value="residential">Residential</TabsTrigger>
          <TabsTrigger value="commercial">Commercial</TabsTrigger>
        </TabsList>
        <TabsContent value="residential">Residential panel</TabsContent>
        <TabsContent value="commercial">Commercial panel</TabsContent>
      </Tabs>,
    )

    expect(screen.getByText('Residential panel')).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Commercial' }))
    expect(screen.getByText('Commercial panel')).toBeInTheDocument()
  })
})
