import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Lightweight renderer for the agent's replies. Not a full Markdown parser — a
 * deliberately small subset covering what the agent actually emits: headings,
 * horizontal rules, bold/italic/code inline, bullet lists, and numbered lists.
 *
 * Numbered items are the inbox items ("who's waiting", "catch me up"), so they
 * get card treatment: a bold subject line, a muted date/time label, and the
 * description below — far more scannable than a wall of raw `**`/`###`/`---`.
 */

// ── inline: **bold**, *italic*, `code` ───────────────────────────────────────
function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const re = /\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`/g
  let last = 0
  let key = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index))
    if (m[1] !== undefined) {
      nodes.push(
        <strong key={key++} className="font-semibold">
          {m[1]}
        </strong>,
      )
    } else if (m[2] !== undefined) {
      nodes.push(<em key={key++}>{m[2]}</em>)
    } else {
      nodes.push(
        <code
          key={key++}
          className="rounded bg-neutral-200/70 px-1 py-0.5 font-mono text-[0.85em] break-words"
        >
          {m[3]}
        </code>,
      )
    }
    last = m.index + m[0].length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

// ── block model ──────────────────────────────────────────────────────────────
type OrderedItem = { subject: string; meta: string | null; description: string }
type Block =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'hr' }
  | { kind: 'ordered'; items: OrderedItem[] }
  | { kind: 'bullets'; items: string[] }
  | { kind: 'paragraph'; text: string }

const isBlank = (l: string) => /^\s*$/.test(l)
const isHeading = (l: string) => /^\s*#{1,6}\s+\S/.test(l)
const isHr = (l: string) => /^\s*([-*_])\1{2,}\s*$/.test(l)
const isOrdered = (l: string) => /^\s*\d+\.\s+\S/.test(l)
const isBullet = (l: string) => /^\s*[-•*]\s+\S/.test(l)

/** Pull a trailing "(…digit…)" — a date/time like (Jun 3) or (Jun 3, 2:46 PM). */
function splitMeta(s: string): { text: string; meta: string | null } {
  const m = s.match(/\s*\(([^)]*\d[^)]*)\)\s*$/)
  if (m && m.index !== undefined) {
    return { text: s.slice(0, m.index).trim(), meta: m[1].trim() }
  }
  return { text: s.trim(), meta: null }
}

function parse(text: string): Block[] {
  const lines = text.split('\n')
  const blocks: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (isBlank(line)) {
      i++
      continue
    }

    if (isHeading(line)) {
      const m = line.match(/^\s*(#{1,6})\s+(.*)$/)!
      blocks.push({ kind: 'heading', level: m[1].length, text: m[2].trim() })
      i++
      continue
    }

    if (isHr(line)) {
      blocks.push({ kind: 'hr' })
      i++
      continue
    }

    if (isOrdered(line)) {
      const items: OrderedItem[] = []
      let cur: { head: string; rest: string[] } | null = null
      while (i < lines.length) {
        const l = lines[i]
        if (isBlank(l)) {
          // Allow blank lines between items; stop only if the list is over.
          let j = i
          while (j < lines.length && isBlank(lines[j])) j++
          if (j < lines.length && isOrdered(lines[j])) {
            i = j
            continue
          }
          break
        }
        if (isHeading(l) || isHr(l)) break
        if (isOrdered(l)) {
          if (cur) items.push(finishItem(cur))
          cur = { head: l.replace(/^\s*\d+\.\s+/, ''), rest: [] }
          i++
        } else if (cur) {
          cur.rest.push(l.trim())
          i++
        } else {
          break
        }
      }
      if (cur) items.push(finishItem(cur))
      blocks.push({ kind: 'ordered', items })
      continue
    }

    if (isBullet(line)) {
      const items: string[] = []
      while (i < lines.length && isBullet(lines[i])) {
        items.push(lines[i].replace(/^\s*[-•*]\s+/, '').trim())
        i++
      }
      blocks.push({ kind: 'bullets', items })
      continue
    }

    // paragraph: consecutive plain lines
    const para: string[] = []
    while (
      i < lines.length &&
      !isBlank(lines[i]) &&
      !isHeading(lines[i]) &&
      !isHr(lines[i]) &&
      !isOrdered(lines[i]) &&
      !isBullet(lines[i])
    ) {
      para.push(lines[i])
      i++
    }
    blocks.push({ kind: 'paragraph', text: para.join('\n') })
  }

  return blocks
}

function finishItem(cur: { head: string; rest: string[] }): OrderedItem {
  // Description = continuation lines, minus a leading dash/em-dash bullet.
  const descRaw = cur.rest.join(' ').replace(/^[—–-]\s*/, '').trim()
  // Date lives at the end of the description, or failing that, the subject.
  const fromDesc = splitMeta(descRaw)
  if (fromDesc.meta) {
    return {
      subject: cur.head.trim(),
      meta: fromDesc.meta,
      description: fromDesc.text,
    }
  }
  const fromHead = splitMeta(cur.head)
  return {
    subject: fromHead.text,
    meta: fromHead.meta,
    description: descRaw,
  }
}

// ── render ───────────────────────────────────────────────────────────────────
export function MarkdownLite({
  text,
  streaming,
}: {
  text: string
  streaming?: boolean
}) {
  const blocks = parse(text)
  return (
    <div className="flex flex-col gap-3 text-sm leading-relaxed text-neutral-800 [overflow-wrap:anywhere]">
      {blocks.map((block, i) => {
        switch (block.kind) {
          case 'heading':
            return (
              <p
                key={i}
                className={cn(
                  'font-semibold text-neutral-900',
                  block.level <= 2 ? 'text-base' : 'text-sm',
                )}
              >
                {renderInline(block.text)}
              </p>
            )

          case 'hr':
            return <hr key={i} className="border-neutral-200" />

          case 'ordered':
            return (
              <ol key={i} className="flex flex-col gap-2">
                {block.items.map((it, j) => (
                  <li
                    key={j}
                    className="rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5"
                  >
                    <p className="font-medium text-neutral-900">
                      {renderInline(it.subject)}
                    </p>
                    {it.meta ? (
                      <p className="mt-0.5 text-xs text-neutral-400">{it.meta}</p>
                    ) : null}
                    {it.description ? (
                      <p className="mt-1.5 text-neutral-600">
                        {renderInline(it.description)}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ol>
            )

          case 'bullets':
            return (
              <ul key={i} className="flex flex-col gap-1 pl-1">
                {block.items.map((it, j) => (
                  <li key={j} className="flex gap-2">
                    <span className="text-[var(--brand-accent)]">•</span>
                    <span>{renderInline(it)}</span>
                  </li>
                ))}
              </ul>
            )

          default:
            return (
              <p key={i} className="whitespace-pre-wrap">
                {renderInline(block.text)}
              </p>
            )
        }
      })}
      {streaming ? (
        <span
          className={cn(
            'inline-block h-4 w-[2px] animate-pulse bg-[var(--brand-accent)]',
            text ? 'ml-0.5' : '',
          )}
          aria-hidden
        />
      ) : null}
    </div>
  )
}
