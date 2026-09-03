'use client'

import { Moon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type ThemeOption = 'dark'

export const THEME_OPTIONS = [
  {
    value: 'dark' as const,
    label: 'Dark',
    description: 'Dim surfaces, easier on the eyes at night.',
    icon: Moon,
  },
]

export function ThemeToggle({ className }: { className?: string }) {
  return (
    <Button
      variant="outline"
      size="icon"
      className={cn('relative', className)}
      aria-label="Dark mode"
      disabled
    >
      <Moon className="size-4" />
    </Button>
  )
}

export function ThemeSegmentedControl() {
  return (
    <div role="radiogroup" aria-label="Theme" className="sm:max-w-md">
      <div
        role="radio"
        aria-checked="true"
        className="flex items-center gap-2 rounded-lg border border-primary bg-primary/5 p-3 text-sm font-medium text-foreground"
      >
        <Moon className="size-3.5" />
        Dark
      </div>
    </div>
  )
}
