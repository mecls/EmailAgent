/**
 * Strip quoted reply text + signatures so embeddings capture the *new* content of
 * a message, not the entire thread history repeated in every reply. Heuristic,
 * intentionally conservative.
 */
export function stripQuoted(text: string): string {
  const lines = text.split(/\r?\n/)
  const out: string[] = []
  for (const line of lines) {
    const t = line.trim()
    if (/^On\b.+\bwrote:$/.test(t)) break // "On <date>, <person> wrote:"
    if (/^-{2,}\s*Original Message\s*-{2,}/i.test(t)) break
    if (/^_{5,}$/.test(t)) break // Outlook divider
    if (t.startsWith('>')) continue // quoted line
    out.push(line)
  }
  return out.join('\n').trim()
}

const CHARS_PER_TOKEN = 4 // rough heuristic for English prose

/**
 * Split text into ~maxTokens-sized chunks with a small overlap, breaking on word
 * boundaries where possible. Returns [] for empty input.
 */
export function chunkText(
  text: string,
  opts?: { maxTokens?: number; overlapTokens?: number },
): string[] {
  const maxChars = (opts?.maxTokens ?? 512) * CHARS_PER_TOKEN
  const overlapChars = (opts?.overlapTokens ?? 50) * CHARS_PER_TOKEN
  const clean = text.replace(/\s+/g, ' ').trim()
  if (!clean) return []
  if (clean.length <= maxChars) return [clean]

  const chunks: string[] = []
  let start = 0
  while (start < clean.length) {
    let end = Math.min(start + maxChars, clean.length)
    if (end < clean.length) {
      const lastSpace = clean.lastIndexOf(' ', end)
      if (lastSpace > start + maxChars * 0.5) end = lastSpace
    }
    const piece = clean.slice(start, end).trim()
    if (piece) chunks.push(piece)
    if (end >= clean.length) break
    // Advance with overlap, but always make forward progress.
    const nextStart = end - overlapChars
    start = nextStart > start ? nextStart : end
  }
  return chunks
}
