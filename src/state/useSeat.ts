import { useCallback, useEffect, useState } from 'react'

/**
 * Which seat this phone belongs to, remembered per game. Everyone opens the
 * same game on their own device and claims their own seat once, so entering a
 * hand is four people typing at the same time rather than one person typing
 * while three watch.
 */
function key(gameId: string): string {
  return 'mahjong-seat:' + gameId
}

export function useSeatClaim(gameId: string | undefined): {
  seat: number | null
  claim: (seat: number) => void
  release: () => void
} {
  const [seat, setSeat] = useState<number | null>(null)

  useEffect(() => {
    if (!gameId) return
    const stored = localStorage.getItem(key(gameId))
    setSeat(stored === null ? null : Number(stored))
  }, [gameId])

  const claim = useCallback((next: number) => {
    if (!gameId) return
    localStorage.setItem(key(gameId), String(next))
    setSeat(next)
  }, [gameId])

  const release = useCallback(() => {
    if (!gameId) return
    localStorage.removeItem(key(gameId))
    setSeat(null)
  }, [gameId])

  return { seat, claim, release }
}
