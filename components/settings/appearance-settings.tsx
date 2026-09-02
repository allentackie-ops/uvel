'use client'

import { useTheme } from 'next-themes'
import { useSyncExternalStore } from 'react'

import { ThemeSegmentedControl } from '@/components/theme-toggle'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'

const subscribeNoop = () => () => {}

export function AppearanceSettings() {
  const { theme, resolvedTheme, setTheme } = useTheme()
  const mounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  )

  const isDark = mounted && resolvedTheme === 'dark'
  const followsSystem = mounted && theme === 'system'

  return (
    <section aria-labelledby="appearance-heading" className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 id="appearance-heading" className="text-base font-semibold">
          Appearance
        </h2>
        <p className="text-sm text-muted-foreground text-pretty">
          Choose how Uvel looks to you. Your choice is saved on this device.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <Label>Theme</Label>
        <ThemeSegmentedControl />
        <p className="text-xs text-muted-foreground">
          {!mounted
            ? 'Loading your preference…'
            : followsSystem
              ? `Following your system, currently ${resolvedTheme}.`
              : `Always ${theme}, regardless of system setting.`}
        </p>
      </div>

      <Separator />

      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <Label htmlFor="dark-mode-switch">Dark mode</Label>
          <p className="text-xs text-muted-foreground">
            Quick switch. Turns off &quot;System&quot; when used.
          </p>
        </div>
        <Switch
          id="dark-mode-switch"
          checked={isDark}
          onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
          disabled={!mounted}
        />
      </div>
    </section>
  )
}
