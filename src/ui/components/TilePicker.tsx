/**
 * The manual tile keyboard. This is the fallback whenever a photo cannot be
 * read, and it feeds exactly the same hand model as recognition.
 */

import { BONUS_TILE_IDS, SUITS, WINDS, DRAGONS, type TileId } from '../../engine/tiles'
import { Tile } from './Tile'

const SUIT_LABEL: Record<string, string> = {
  b: 'Bamboo', c: 'Characters', d: 'Dots',
}

export function TilePicker({
  onPick, counts, disabled, showBonus = true,
}: {
  onPick: (id: TileId) => void
  /** How many of each tile the hand already uses, to grey out the fourth copy. */
  counts?: Map<TileId, number>
  disabled?: boolean
  showBonus?: boolean
}) {
  const exhausted = (id: TileId) => (counts?.get(id) ?? 0) >= 4

  const row = (ids: TileId[], label: string) => (
    <div key={label} className="mb-3">
      <p className="label">{label}</p>
      <div className="grid grid-cols-9 gap-1">
        {ids.map((id) => (
          <button
            key={id}
            type="button"
            disabled={disabled || exhausted(id)}
            onClick={() => onPick(id)}
            className="flex items-center justify-center disabled:opacity-25"
          >
            <Tile id={id} size="sm" />
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <div className="card">
      {SUITS.map((s) =>
        row([1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => s + n), SUIT_LABEL[s]),
      )}
      <div className="mb-3">
        <p className="label">Winds and Dragons</p>
        <div className="grid grid-cols-9 gap-1">
          {[...WINDS, ...DRAGONS].map((id) => (
            <button
              key={id}
              type="button"
              disabled={disabled || exhausted(id)}
              onClick={() => onPick(id)}
              className="flex items-center justify-center disabled:opacity-25"
            >
              <Tile id={id} size="sm" />
            </button>
          ))}
        </div>
      </div>
      {showBonus ? (
        <div>
          <p className="label">Flowers and Seasons</p>
          <div className="grid grid-cols-9 gap-1">
            {BONUS_TILE_IDS.map((id) => (
              <button
                key={id}
                type="button"
                disabled={disabled}
                onClick={() => onPick(id)}
                className="flex items-center justify-center"
              >
                <Tile id={id} size="sm" />
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
