import { type FormEvent } from 'react'
import { useNavigate } from 'react-router'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * Demo sign-in screen. There is no authentication in this template; any
 * credentials open the dashboard. Replace `onSubmit` with your auth provider.
 */
export function LoginPage() {
  const navigate = useNavigate()

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void navigate('/dashboard')
  }

  return (
    <Card className="w-full max-w-sm shadow-md">
      <CardHeader className="gap-1.5">
        <CardTitle className="text-h2">Welcome back</CardTitle>
        <CardDescription>Sign in to manage your properties.</CardDescription>
      </CardHeader>
      <CardContent>
        <form id="login-form" onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              defaultValue="alex.morgan@example.com"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete="current-password" defaultValue="demo-password" />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="remember" defaultChecked />
            <Label htmlFor="remember" className="font-normal text-muted-foreground">
              Keep me signed in
            </Label>
          </div>
          <Button type="submit" size="lg" className="w-full">
            Sign in
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center text-center text-caption text-muted-foreground">
        Demo workspace — any credentials work. No data leaves your browser.
      </CardFooter>
    </Card>
  )
}
