import { ThemeToggle } from '@/components/theme-toggle'

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
        <a href="/" className="flex items-center gap-2 font-semibold">
          <span
            aria-hidden="true"
            className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold"
          >
            U
          </span>
          Uvel
        </a>
        <nav aria-label="Primary" className="flex items-center gap-2">
          <ThemeToggle />
        </nav>
      </div>
    </header>
  )
}
