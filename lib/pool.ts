/**
 * Map over items with bounded concurrency, preserving input order. Keeps `n`
 * promises in flight at once (a simple cursor-based worker pool). Rejections
 * propagate; catch inside `fn` if you want per-item errors to be non-fatal.
 */
export async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let cursor = 0
  const workers = Math.max(1, Math.min(concurrency, items.length))
  async function worker(): Promise<void> {
    for (;;) {
      const i = cursor++
      if (i >= items.length) return
      results[i] = await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: workers }, () => worker()))
  return results
}
