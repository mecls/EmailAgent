'use client'

import { useEffect, useRef, useState, type ComponentType } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface PlusMenuItem {
  icon: ComponentType<{ className?: string }>
  label: string
  description?: string
  onClick: () => void
  /** Render a divider above this item. */
  divider?: boolean
}

/**
 * The composer's "+" launcher — a small, anchored popover menu in the spirit of
 * ChatGPT's attachment menu. Opens upward from the button, closes on outside
 * click or Escape, and runs the chosen action.
 */
export function PlusMenu({
  items,
  disabled,
}: {
  items: PlusMenuItem[]
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        aria-label="More actions"
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-white transition-colors disabled:opacity-40',
          open
            ? 'border-[var(--brand-accent)] text-[var(--brand-accent)]'
            : 'border-neutral-200 text-neutral-500 hover:border-[var(--brand-accent)] hover:text-[var(--brand-accent)]',
        )}
      >
        <Plus
          className={cn(
            'h-5 w-5 transition-transform',
            open && 'rotate-45',
          )}
          aria-hidden
        />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            role="menu"
            className="absolute bottom-full left-0 z-20 mb-2 w-64 overflow-hidden rounded-xl border border-neutral-200/80 bg-white p-1.5 shadow-[0_12px_32px_-12px_rgba(0,0,0,0.25)]"
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.13, ease: 'easeOut' }}
          >
            {items.map((item) => (
              <div key={item.label}>
                {item.divider ? (
                  <div className="my-1.5 h-px bg-neutral-200/70" />
                ) : null}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false)
                    item.onClick()
                  }}
                  className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-neutral-100"
                >
                  <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-neutral-800">
                      {item.label}
                    </span>
                    {item.description ? (
                      <span className="block text-xs text-neutral-500">
                        {item.description}
                      </span>
                    ) : null}
                  </span>
                </button>
              </div>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
