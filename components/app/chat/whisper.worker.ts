/// <reference lib="webworker" />
//
// On-device speech-to-text. Runs the open-source Whisper model entirely in the
// browser via transformers.js — no API key, no server round-trip, and the audio
// never leaves the device. The model weights are fetched once from the public HF
// CDN and cached by the browser; subsequent transcriptions are instant to start.
//
// Lives in a Web Worker so the (few-seconds) transcription never blocks the UI.

import { pipeline, env } from '@huggingface/transformers'

// English-only tiny model — smallest/fastest on mobile. Swap to
// 'Xenova/whisper-base' for multilingual at the cost of size/speed.
const MODEL_ID = 'Xenova/whisper-tiny.en'

// Browser-only: always fetch from the Hub, never look for bundled local files.
env.allowLocalModels = false

/** Messages the main thread sends in. Audio is mono Float32 PCM at 16 kHz. */
export type WhisperIn = { type: 'transcribe'; audio: Float32Array }

/** Messages this worker posts back. */
export type WhisperOut =
  | { type: 'loading' }
  | { type: 'progress'; progress: number }
  | { type: 'transcribing' }
  | { type: 'result'; text: string }
  | { type: 'error'; message: string }

type Transcriber = (
  audio: Float32Array,
) => Promise<{ text?: string } | Array<{ text?: string }>>

type ProgressInfo = { status?: string; progress?: number }

const ctx = self as unknown as DedicatedWorkerGlobalScope
const post = (msg: WhisperOut) => ctx.postMessage(msg)

let transcriberPromise: Promise<Transcriber> | null = null

function getTranscriber(): Promise<Transcriber> {
  if (!transcriberPromise) {
    transcriberPromise = pipeline('automatic-speech-recognition', MODEL_ID, {
      // Single-threaded WASM — avoids needing cross-origin isolation (COOP/COEP),
      // which would otherwise risk breaking Supabase/Google/image requests.
      device: 'wasm',
      progress_callback: (p: ProgressInfo) => {
        if (p?.status === 'progress' && typeof p.progress === 'number') {
          post({ type: 'progress', progress: Math.round(p.progress) })
        }
      },
    }) as unknown as Promise<Transcriber>
  }
  return transcriberPromise
}

ctx.addEventListener('message', (e: MessageEvent<WhisperIn>) => {
  const data = e.data
  if (data?.type !== 'transcribe') return
  void run(data.audio)
})

async function run(audio: Float32Array): Promise<void> {
  try {
    // First run kicks off the one-time model download — tell the UI so it can
    // show a "setting up voice…" indicator with progress.
    if (!transcriberPromise) post({ type: 'loading' })
    const transcribe = await getTranscriber()
    post({ type: 'transcribing' })
    const out = await transcribe(audio)
    const text = Array.isArray(out)
      ? out.map((o) => o.text ?? '').join(' ')
      : (out.text ?? '')
    post({ type: 'result', text: text.trim() })
  } catch (err) {
    post({
      type: 'error',
      message: err instanceof Error ? err.message : 'transcription failed',
    })
  }
}
