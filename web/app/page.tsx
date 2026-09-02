import { Palette, Settings } from 'lucide-react'

import { AppearanceSettings } from '@/components/settings/appearance-settings'
import { SiteHeader } from '@/components/site-header'
import { ThemeShowcase } from '@/components/theme-showcase'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

export default function Page() {
  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <SiteHeader />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Settings className="size-4" aria-hidden="true" />
            Settings
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-balance">
            Appearance
          </h1>
          <p className="max-w-prose text-muted-foreground text-pretty">
            Switch between light and dark mode, or let Uvel follow your system.
            The toggle in the header works from anywhere in the app.
          </p>
        </div>

        <Card>
          <CardContent className="flex flex-col gap-8 pt-6">
            <AppearanceSettings />
          </CardContent>
        </Card>

        <Separator />

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Palette className="size-4" aria-hidden="true" />
          Design tokens
        </div>
        <ThemeShowcase />
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-6 text-xs text-muted-foreground sm:px-6">
          <span>Uvel</span>
          <span>Theme preference is stored locally in your browser.</span>
        </div>
      </footer>
    </div>
  )
}
