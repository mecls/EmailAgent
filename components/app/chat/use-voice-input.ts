'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import type { WhisperIn, WhisperOut } from './whisper.worker'

export type VoiceStatus =
  | 'idle'
  | 'recording'
  | 'loading-model'
  | 'transcribing'
  | 'error'

interface UseVoiceInputOptions {
  /** Called with the final transcript (non-empty, trimmed). */
  onResult: (text: string) => void
}

type WindowWithWebkitAudio = typeof window & {
  webkitAudioContext?: typeof AudioContext
}

const noopSubscribe = () => () => {}

/** Feature-detect mic + recording + decoding. SSR-safe (returns false). */
function isVoiceSupported(): boolean {
  if (typeof navigator === 'undefined' || typeof window === 'undefined')
    return false
  const w = window as WindowWithWebkitAudio
  return (
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined' &&
    (!!w.AudioContext || !!w.webkitAudioContext)
  )
}

/** Decode a recorded blob and return mono PCM resampled to 16 kHz — the format
 * the Whisper pipeline expects. Safari decodes its own mp4/aac here. */
async function blobToMono16k(blob: Blob): Promise<Float32Array> {
  const w = window as WindowWithWebkitAudio
  const Ctor = w.AudioContext ?? w.webkitAudioContext
  if (!Ctor) throw new Error('no AudioContext')

  const arrayBuf = await blob.arrayBuffer()
  const decodeCtx = new Ctor()
  let decoded: AudioBuffer
  try {
    decoded = await decodeCtx.decodeAudioData(arrayBuf)
  } finally {
    void decodeCtx.close()
  }

  const TARGET = 16000
  const frames = Math.max(1, Math.ceil(decoded.duration * TARGET))
  const offline = new OfflineAudioContext(1, frames, TARGET)
  const src = offline.createBufferSource()
  src.buffer = decoded
  src.connect(offline.destination)
  src.start()
  const rendered = await offline.startRendering()
  // Copy out of the rendered buffer so the underlying memory is transferable.
  return rendered.getChannelData(0).slice()
}

/**
 * Push-to-talk dictation: capture mic audio, transcribe it on-device with the
 * Whisper worker, and hand the text back via `onResult`. Owns the full state
 * machine (record → decode → transcribe) and always releases the mic when done.
 */
export function useVoiceInput({ onResult }: UseVoiceInputOptions) {
  const supported = useSyncExternalStore(
    noopSubscribe,
    isVoiceSupported,
    () => false,
  )
  const [status, setStatus] = useState<VoiceStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [modelProgress, setModelProgress] = useState(0)

  const workerRef = useRef<Worker | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  // Keep the latest callback without re-creating start/stop each render.
  const onResultRef = useRef(onResult)
  useEffect(() => {
    onResultRef.current = onResult
  })

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  const ensureWorker = useCallback((): Worker => {
    if (!workerRef.current) {
      const worker = new Worker(
        new URL('./whisper.worker.ts', import.meta.url),
        { type: 'module' },
      )
      worker.onmessage = (e: MessageEvent<WhisperOut>) => {
        const msg = e.data
        switch (msg.type) {
          case 'loading':
            setModelProgress(0)
            setStatus('loading-model')
            break
          case 'progress':
            setModelProgress(msg.progress)
            break
          case 'transcribing':
            setStatus('transcribing')
            break
          case 'result':
            setStatus('idle')
            if (msg.text) onResultRef.current(msg.text)
            else setError("I didn't catch that — try again.")
            break
          case 'error':
            setStatus('error')
            setError('Voice transcription failed. Give it another try.')
            break
        }
      }
      worker.onerror = () => {
        setStatus('error')
        setError("Voice didn't start. Give it another try.")
      }
      workerRef.current = worker
    }
    return workerRef.current
  }, [])

  const handleStop = useCallback(async () => {
    releaseStream()
    const chunks = chunksRef.current
    chunksRef.current = []
    if (chunks.length === 0) {
      setStatus('idle')
      return
    }
    setStatus('transcribing')
    try {
      const blob = new Blob(chunks, {
        type: recorderRef.current?.mimeType || 'audio/webm',
      })
      const audio = await blobToMono16k(blob)
      const worker = ensureWorker()
      const message: WhisperIn = { type: 'transcribe', audio }
      worker.postMessage(message, [audio.buffer])
    } catch {
      setStatus('error')
      setError("I couldn't process that recording. Give it another try.")
    }
  }, [ensureWorker, releaseStream])

  const start = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []
      const rec = new MediaRecorder(stream)
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      rec.onstop = () => void handleStop()
      recorderRef.current = rec
      rec.start()
      setStatus('recording')
    } catch (e) {
      releaseStream()
      setStatus('error')
      setError(
        e instanceof DOMException && e.name === 'NotAllowedError'
          ? 'Microphone access is blocked. Enable it to use voice.'
          : "I couldn't reach your microphone.",
      )
    }
  }, [handleStop, releaseStream])

  const stop = useCallback(() => {
    const rec = recorderRef.current
    if (rec && rec.state !== 'inactive') rec.stop() // fires onstop → handleStop
  }, [])

  const cancel = useCallback(() => {
    const rec = recorderRef.current
    if (rec && rec.state !== 'inactive') {
      rec.onstop = null
      rec.stop()
    }
    releaseStream()
    chunksRef.current = []
    setStatus('idle')
    setError(null)
  }, [releaseStream])

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      workerRef.current?.terminate()
    }
  }, [])

  return { status, error, modelProgress, supported, start, stop, cancel }
}
