/**
 * A tile, drawn as SVG so it stays sharp at any size and needs no asset
 * download. The face artwork lives in `TileFace`; this file is the tile body,
 * the selection and confidence rings, and the sizing.
 */

import { tileName, type TileId } from '../../engine/tiles'
import { FACE_H, FACE_W, TileFace } from './TileFace'

export type TileSize = 'xs' | 'sm' | 'md' | 'lg'

const SIZES: Record<TileSize, { w: number; h: number; radius: string }> = {
  xs: { w: 26, h: 36, radius: 'rounded-[4px]' },
  sm: { w: 36, h: 50, radius: 'rounded-md' },
  md: { w: 46, h: 64, radius: 'rounded-lg' },
  lg: { w: 60, h: 84, radius: 'rounded-lg' },
}

export interface TileProps {
  id: TileId
  size?: TileSize
  /** Draws the winning-tile highlight. */
  winning?: boolean
  /** Draws the low-confidence warning ring. */
  uncertain?: boolean
  /** Draws the selected ring. */
  selected?: boolean
  /** Dims the tile, used for suppressed evidence. */
  muted?: boolean
  /** Draws the tile face down, for wall diagrams. */
  faceDown?: boolean
  onClick?: () => void
  className?: string
}

export function Tile({
  id, size = 'md', winning, uncertain, selected, muted, faceDown, onClick,
  className = '',
}: TileProps) {
  const s = SIZES[size]

  const ring = winning
    ? 'ring-2 ring-gold shadow-[0_0_0_3px_rgba(233,185,73,0.25)]'
    : selected
      ? 'ring-2 ring-sky-400'
      : uncertain
        ? 'ring-2 ring-amber-500'
        : 'ring-1 ring-black/25'

  const Element = onClick ? 'button' : 'div'

  return (
    <Element
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-label={faceDown ? 'Face-down tile' : tileName(id)}
      title={faceDown ? undefined : tileName(id)}
      className={
        'relative block shrink-0 select-none overflow-hidden shadow-sm shadow-black/40 ' +
        s.radius + ' ' + ring + ' ' +
        (muted ? 'opacity-40 ' : '') +
        (onClick ? 'transition active:scale-95 ' : '') +
        className
      }
      style={{ width: s.w, height: s.h }}
    >
      <svg
        viewBox={`0 0 ${FACE_W} ${FACE_H}`}
        width={s.w}
        height={s.h}
        role="img"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="tile-body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fdfcf7" />
            <stop offset="100%" stopColor="#ebe6d6" />
          </linearGradient>
          <linearGradient id="tile-back" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2f7f5b" />
            <stop offset="100%" stopColor="#1d5a3f" />
          </linearGradient>
        </defs>
        <rect
          x={0}
          y={0}
          width={FACE_W}
          height={FACE_H}
          fill={faceDown ? 'url(#tile-back)' : 'url(#tile-body)'}
        />
        {faceDown ? null : <TileFace id={id} />}
      </svg>
      {winning ? (
        <span className="absolute -top-1 -right-1 rounded-full bg-gold px-1 text-[8px] font-bold leading-tight text-ink">
          WIN
        </span>
      ) : null}
    </Element>
  )
}

export function TileGroupRow({
  tiles, size = 'sm', winningTile, className = '',
}: {
  tiles: TileId[]
  size?: TileSize
  winningTile?: TileId
  className?: string
}) {
  const winAt = winningTile ? tiles.indexOf(winningTile) : -1
  return (
    <div className={'flex gap-0.5 ' + className}>
      {tiles.map((id, i) => (
        <Tile key={id + i} id={id} size={size} winning={i === winAt} />
      ))}
    </div>
  )
}
