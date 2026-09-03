'use client'

import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'

export function AppearanceSettings() {
  return (
    <section aria-labelledby="appearance-heading" className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 id="appearance-heading" className="text-base font-semibold">
          Appearance
        </h2>
        <p className="text-sm text-muted-foreground text-pretty">
          Uvel uses dark mode for a consistent experience.
        </p>
      </div>

      <Separator />

      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <Label>Dark mode</Label>
          <p className="text-xs text-muted-foreground">
            Dark mode is always on.
          </p>
        </div>
      </div>
    </section>
  )
}
