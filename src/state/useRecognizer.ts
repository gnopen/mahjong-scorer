import { useEffect, useState } from 'react'
import { probeRecognizer, type RecognizerStatus } from '../vision/endpoint'

/**
 * Asks the recognition endpoint whether it is alive. Cached for the session so
 * every screen that mentions recognition agrees, with a `recheck` for the
 * capture screen to call after a failure.
 */
let cached: Promise<RecognizerStatus> | null = null

function load(force = false): Promise<RecognizerStatus> {
  if (force || !cached) cached = probeRecognizer()
  return cached
}

export function useRecognizerStatus(): {
  status: RecognizerStatus | null
  recheck: () => void
} {
  const [status, setStatus] = useState<RecognizerStatus | null>(null)

  useEffect(() => {
    let live = true
    void load().then((s) => { if (live) setStatus(s) })
    return () => { live = false }
  }, [])

  const recheck = () => {
    setStatus(null)
    void load(true).then(setStatus)
  }

  return { status, recheck }
}
