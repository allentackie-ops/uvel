'use client'

import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useSyncExternalStore } from 'react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export type ThemeOption = 'light' | 'dark' | 'system'

export const THEME_OPTIONS: {
  value: ThemeOption
  label: string
  description: string
  icon: typeof Sun
}[] = [
  {
    value: 'light',
    label: 'Light',
    description: 'Bright surfaces with dark text.',
    icon: Sun,
  },
  {
    value: 'dark',
    label: 'Dark',
    description: 'Dim surfaces, easier on the eyes at night.',
    icon: Moon,
  },
  {
    value: 'system',
    label: 'System',
    description: 'Follows your operating system setting.',
    icon: Monitor,
  },
]

const subscribeNoop = () => () => {}

/** True only after hydration, so we never render a theme the server didn't know about. */
function useMounted() {
  return useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  )
}

/**
 * Compact icon button with a dropdown. Meant for headers/toolbars.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const mounted = useMounted()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            className={cn('relative', className)}
            aria-label="Change theme"
          />
        }
      >
        <Sun className="size-4 scale-100 rotate-0 transition-transform dark:scale-0 dark:-rotate-90" />
        <Moon className="absolute size-4 scale-0 rotate-90 transition-transform dark:scale-100 dark:rotate-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {THEME_OPTIONS.map((option) => {
          const Icon = option.icon
          const active = mounted && theme === option.value
          return (
            <DropdownMenuItem
              key={option.value}
              onClick={() => setTheme(option.value)}
              aria-checked={active}
              role="menuitemradio"
            >
              <Icon className="size-4" />
              {option.label}
              {active && (
                <span className="ml-auto size-1.5 rounded-full bg-primary" />
              )}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * Segmented control for a settings page. Shows all three options at once.
 */
export function ThemeSegmentedControl() {
  const { theme, setTheme } = useTheme()
  const mounted = useMounted()

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="grid grid-cols-3 gap-2 sm:max-w-md"
    >
      {THEME_OPTIONS.map((option) => {
        const Icon = option.icon
        const active = mounted && theme === option.value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(option.value)}
            className={cn(
              'flex flex-col items-center gap-2 rounded-lg border p-3 text-sm font-medium transition-colors',
              'outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active
                ? 'border-primary bg-primary/5 text-foreground'
                : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )}
          >
            <ThemePreview theme={option.value} />
            <span className="flex items-center gap-1.5">
              <Icon className="size-3.5" />
              {option.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/** Tiny wireframe thumbnail that previews what each theme looks like. */
function ThemePreview({ theme }: { theme: ThemeOption }) {
  const dark = (
    <div className="flex h-full w-full flex-col gap-1 bg-neutral-900 p-1.5">
      <div className="h-1.5 w-1/2 rounded-sm bg-neutral-600" />
      <div className="h-1.5 w-3/4 rounded-sm bg-neutral-700" />
      <div className="mt-auto h-3 w-full rounded-sm bg-neutral-800" />
    </div>
  )
  const light = (
    <div className="flex h-full w-full flex-col gap-1 bg-neutral-50 p-1.5">
      <div className="h-1.5 w-1/2 rounded-sm bg-neutral-400" />
      <div className="h-1.5 w-3/4 rounded-sm bg-neutral-300" />
      <div className="mt-auto h-3 w-full rounded-sm bg-neutral-200" />
    </div>
  )

  return (
    <div
      aria-hidden="true"
      className="flex h-14 w-full overflow-hidden rounded-md border border-border"
    >
      {theme === 'system' ? (
        <>
          <div className="w-1/2">{light}</div>
          <div className="w-1/2">{dark}</div>
        </>
      ) : theme === 'dark' ? (
        dark
      ) : (
        light
      )}
    </div>
  )
}
