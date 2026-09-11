/**
 * The hand currently being entered. Photo recognition and the manual picker
 * both write here, and the scorer only ever reads from here, so there is one
 * hand model and one scoring path.
 */

import { create } from 'zustand'
import type { Meld, WinFlags } from '../engine/hand'
import { NO_FLAGS } from '../engine/hand'
import { isBonus, sortTiles, type TileId } from '../engine/tiles'
import type { RecognitionResult } from '../vision/recognize'

export interface HandDraft {
  gameId: string | null
  winnerPlayerId: string | null
  discarderPlayerId: string | null
  concealed: TileId[]
  melds: Meld[]
  bonusTiles: TileId[]
  winningTile: TileId
  selfDraw: boolean
  flags: WinFlags
  source: 'manual' | 'photo'
  photoDataUrl: string | null
  detection: RecognitionResult | null
  /** Confidence per tile index, present only for the photo path. */
  confidence: Record<number, number>
}

interface Actions {
  start(gameId: string, source: 'manual' | 'photo'): void
  loadDetection(result: RecognitionResult, photoDataUrl: string): void
  loadSeatDraft(input: {
    concealed: TileId[]
    melds: Meld[]
    bonusTiles: TileId[]
    winnerPlayerId: string | null
  }): void
  addTile(id: TileId): void
  removeAt(index: number): void
  setWinningTile(id: TileId): void
  addMeld(meld: Meld): void
  removeMeld(index: number): void
  toggleMeldConcealed(index: number): void
  toggleBonus(id: TileId): void
  setSelfDraw(value: boolean): void
  setFlag(key: keyof WinFlags, value: boolean): void
  setWinner(playerId: string | null): void
  setDiscarder(playerId: string | null): void
  sort(): void
  reset(): void
}

const EMPTY: HandDraft = {
  gameId: null,
  winnerPlayerId: null,
  discarderPlayerId: null,
  concealed: [],
  melds: [],
  bonusTiles: [],
  winningTile: '',
  selfDraw: false,
  flags: { ...NO_FLAGS },
  source: 'manual',
  photoDataUrl: null,
  detection: null,
  confidence: {},
}

export const useHandDraft = create<HandDraft & Actions>((set, get) => ({
  ...EMPTY,

  start: (gameId, source) => set({ ...EMPTY, flags: { ...NO_FLAGS }, gameId, source }),

  loadDetection: (result, photoDataUrl) => {
    const concealed: TileId[] = []
    const bonusTiles: TileId[] = []
    const meldTiles: TileId[] = []
    const confidence: Record<number, number> = {}

    for (const d of result.tiles) {
      if (isBonus(d.tile) || d.group === 'bonus') {
        if (!bonusTiles.includes(d.tile)) bonusTiles.push(d.tile)
      } else if (d.group === 'melded') {
        meldTiles.push(d.tile)
      } else {
        confidence[concealed.length] = d.confidence
        concealed.push(d.tile)
      }
    }

    // Melded tiles arrive as a flat run. Group them into threes, which is what
    // a laid-out meld looks like; the editor lets the player fix the split.
    const melds: Meld[] = []
    for (let i = 0; i + 2 < meldTiles.length; i += 3) {
      const group = sortTiles(meldTiles.slice(i, i + 3))
      const kind = group[0] === group[2] ? 'pung' : 'chow'
      melds.push({ kind, tiles: group, concealed: false })
    }
    const leftover = meldTiles.slice(melds.length * 3)
    for (const t of leftover) {
      confidence[concealed.length] = 0.5
      concealed.push(t)
    }

    set({
      concealed,
      melds,
      bonusTiles,
      confidence,
      detection: result,
      photoDataUrl,
      source: 'photo',
      winningTile: '',
    })
  },

  /**
   * Takes the tiles a player has been maintaining on their own phone. The
   * winning tile is deliberately left unset: it is the one thing they still
   * have to point at.
   */
  loadSeatDraft: ({ concealed, melds, bonusTiles, winnerPlayerId }) =>
    set({
      concealed: sortTiles(concealed),
      melds,
      bonusTiles,
      winnerPlayerId,
      winningTile: '',
      confidence: {},
      detection: null,
      photoDataUrl: null,
      source: 'manual',
    }),

  addTile: (id) => {
    if (isBonus(id)) {
      get().toggleBonus(id)
      return
    }
    set((s) => ({ concealed: [...s.concealed, id] }))
  },

  removeAt: (index) =>
    set((s) => {
      const concealed = s.concealed.filter((_, i) => i !== index)
      const removed = s.concealed[index]
      const stillThere = concealed.includes(removed)
      return {
        concealed,
        winningTile: s.winningTile === removed && !stillThere ? '' : s.winningTile,
      }
    }),

  setWinningTile: (id) => set((s) => ({ winningTile: s.winningTile === id ? '' : id })),

  addMeld: (meld) =>
    set((s) => {
      const remaining = [...s.concealed]
      for (const t of meld.tiles) {
        const i = remaining.indexOf(t)
        if (i >= 0) remaining.splice(i, 1)
      }
      return { melds: [...s.melds, meld], concealed: remaining }
    }),

  removeMeld: (index) =>
    set((s) => ({
      melds: s.melds.filter((_, i) => i !== index),
      concealed: sortTiles([...s.concealed, ...s.melds[index].tiles]),
    })),

  toggleMeldConcealed: (index) =>
    set((s) => ({
      melds: s.melds.map((m, i) => (i === index ? { ...m, concealed: !m.concealed } : m)),
    })),

  toggleBonus: (id) =>
    set((s) => ({
      bonusTiles: s.bonusTiles.includes(id)
        ? s.bonusTiles.filter((b) => b !== id)
        : [...s.bonusTiles, id],
    })),

  setSelfDraw: (value) =>
    set((s) => ({
      selfDraw: value,
      discarderPlayerId: value ? null : s.discarderPlayerId,
      flags: value
        ? { ...s.flags, lastTileClaim: false, robbingKong: false }
        : { ...s.flags, lastTileDraw: false, kongReplacement: false },
    })),

  setFlag: (key, value) => set((s) => ({ flags: { ...s.flags, [key]: value } })),
  setWinner: (playerId) => set({ winnerPlayerId: playerId }),
  setDiscarder: (playerId) => set({ discarderPlayerId: playerId }),
  sort: () => set((s) => ({ concealed: sortTiles(s.concealed) })),
  reset: () => set({ ...EMPTY, flags: { ...NO_FLAGS } }),
}))

/** The draft as the engine's `HandInput`. */
export function draftToHand(d: HandDraft) {
  return {
    concealed: d.concealed,
    melds: d.melds,
    winningTile: d.winningTile,
    selfDraw: d.selfDraw,
    bonusTiles: d.bonusTiles,
    flags: d.flags,
  }
}
