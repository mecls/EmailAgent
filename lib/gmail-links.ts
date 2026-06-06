/**
 * Gmail web deep links. Pure + client-safe (no server imports) so cards can
 * render real "Open in inbox" / "Reply" links. This app is read-only — it never
 * sends — so "Reply" simply opens Gmail's compose, prefilled, in a new tab.
 */

/** Open a conversation in Gmail by its thread id. */
export function gmailThreadUrl(threadId: string): string {
  return `https://mail.google.com/mail/u/0/#all/${encodeURIComponent(threadId)}`
}

/** Open Gmail's compose window, prefilled to reply to a sender. */
export function gmailComposeUrl(to: string, subject?: string | null): string {
  const params = new URLSearchParams({ view: 'cm', fs: '1', to })
  if (subject) {
    params.set('su', /^re:/i.test(subject) ? subject : `Re: ${subject}`)
  }
  return `https://mail.google.com/mail/?${params.toString()}`
}
