import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const TOKENS = [
  { name: 'background', className: 'bg-background text-foreground' },
  { name: 'card', className: 'bg-card text-card-foreground' },
  { name: 'muted', className: 'bg-muted text-muted-foreground' },
  { name: 'accent', className: 'bg-accent text-accent-foreground' },
  { name: 'secondary', className: 'bg-secondary text-secondary-foreground' },
  { name: 'primary', className: 'bg-primary text-primary-foreground' },
  { name: 'destructive', className: 'bg-destructive text-white' },
  { name: 'border', className: 'bg-border text-foreground' },
]

/**
 * Exercises every semantic token so light and dark can be checked side by side.
 */
export function ThemeShowcase() {
  return (
    <section aria-labelledby="showcase-heading" className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 id="showcase-heading" className="text-base font-semibold">
          Preview
        </h2>
        <p className="text-sm text-muted-foreground text-pretty">
          Every surface, control, and text color below responds to the theme
          you pick.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {TOKENS.map((token) => (
          <div
            key={token.name}
            className={`flex h-16 items-end rounded-lg border border-border p-2 font-mono text-xs ${token.className}`}
          >
            {token.name}
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>
              Form controls, borders, and focus rings.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" placeholder="••••••••" />
            </div>
          </CardContent>
          <CardFooter className="flex flex-wrap gap-2">
            <Button>Continue</Button>
            <Button variant="outline">Cancel</Button>
            <Button variant="ghost">Help</Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Project status</CardTitle>
            <CardDescription>
              Badges, muted text, and secondary surfaces.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {[
              { label: 'Build', value: 'Passing', variant: 'default' as const },
              { label: 'Deploy', value: 'Ready', variant: 'secondary' as const },
              { label: 'Tests', value: '2 failing', variant: 'destructive' as const },
              { label: 'Lint', value: 'Clean', variant: 'outline' as const },
            ].map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between rounded-md bg-muted/60 px-3 py-2 text-sm"
              >
                <span className="text-muted-foreground">{row.label}</span>
                <Badge variant={row.variant}>{row.value}</Badge>
              </div>
            ))}
          </CardContent>
          <CardFooter>
            <p className="text-xs text-muted-foreground">
              Updated 2 minutes ago
            </p>
          </CardFooter>
        </Card>
      </div>
    </section>
  )
}
