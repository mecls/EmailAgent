'use client'

// Optional "read the answer aloud" output, using the browser's built-in,
// on-device SpeechSynthesis — free, no API key, and no text leaves the device
// beyond the local OS voice engine. Voices are basic; it's a secondary nicety
// to the dictation input.

/** Whether the browser exposes a usable speech-synthesis engine. */
export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

/** Strip the lightweight markdown the assistant emits so it reads cleanly. */
function toPlainText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' ') // fenced code
    .replace(/`([^`]+)`/g, '$1') // inline code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // links → text
    .replace(/^#{1,6}\s+/gm, '') // headings
    .replace(/(\*\*|__)(.*?)\1/g, '$2') // bold
    .replace(/(\*|_)(.*?)\1/g, '$2') // italic
    .replace(/^\s*[-*+]\s+/gm, '') // bullets
    .replace(/^\s*>\s?/gm, '') // quotes
    .replace(/\s+/g, ' ')
    .trim()
}

/** Speak the given (markdown) text aloud, cancelling anything already playing. */
export function speak(text: string): void {
  if (!speechSupported()) return
  const clean = toPlainText(text)
  if (!clean) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(clean)
  utterance.rate = 1
  utterance.pitch = 1
  window.speechSynthesis.speak(utterance)
}

/** Stop any in-flight speech. */
export function stopSpeaking(): void {
  if (!speechSupported()) return
  window.speechSynthesis.cancel()
}
