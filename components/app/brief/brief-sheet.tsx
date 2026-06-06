'use client'

import { useEffect, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { X } from 'lucide-react'

/**
 * A mobile slide-up bottom sheet for the morning brief. Opens from a header
 * trigger, dims the background, and can be dismissed by the backdrop, the close
 * button, Escape, or a downward drag. Scrolls internally and respects the home
 * indicator via .pb-safe.
 */
export function BriefSheet({
  open,
  onClose,
  children,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
}) {
  // Lock body scroll + close on Escape while the sheet is open.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-40 xl:hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/30"
            onClick={onClose}
            aria-hidden
          />

          {/* Sheet */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Morning brief"
            className="absolute inset-x-0 bottom-0 flex max-h-[85dvh] flex-col rounded-t-2xl border-t border-neutral-200/80 bg-[var(--background)] shadow-[0_-12px_40px_-16px_rgba(0,0,0,0.3)]"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 360 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onClose()
            }}
          >
            {/* Grab handle */}
            <div className="flex shrink-0 items-center justify-center pt-3 pb-1">
              <span
                className="h-1 w-9 rounded-full bg-neutral-300"
                aria-hidden
              />
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute top-3 right-3 flex h-9 w-9 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-200/60 hover:text-neutral-700"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>

            <div className="pb-safe min-h-0 flex-1 overflow-y-auto px-5 pt-2">
              {children}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
