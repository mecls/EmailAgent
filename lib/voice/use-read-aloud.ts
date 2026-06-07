'use client'

import { useSyncExternalStore } from 'react'
import { speechSupported, stopSpeaking } from './speak'

// A tiny persisted boolean ("read answers aloud") backed by localStorage and
// exposed through useSyncExternalStore so it's SSR-safe (no hydration mismatch)
// and updates every subscriber when toggled in the same tab.

const KEY = 'voiceReadAloud'
const listeners = new Set<() => void>()
const noopSubscribe = () => () => {}

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

export function useReadAloud(): {
  enabled: boolean
  supported: boolean
  toggle: () => void
} {
  const enabled = useSyncExternalStore(subscribe, read, () => false)
  const supported = useSyncExternalStore(noopSubscribe, speechSupported, () => false)
  const toggle = () => {
    const next = !read()
    try {
      localStorage.setItem(KEY, next ? '1' : '0')
    } catch {
      // localStorage unavailable (private mode) — ignore.
    }
    if (!next) stopSpeaking()
    listeners.forEach((l) => l())
  }
  return { enabled, supported, toggle }
}
