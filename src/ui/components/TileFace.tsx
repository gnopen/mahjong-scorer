/**
 * Tile faces drawn as SVG, following the artwork in A Guide to Mahjong:
 * Bamboo tiles show sticks with a bird for the 1, Dots tiles show rings, and
 * Characters tiles show a Chinese numeral above 萬.
 *
 * Drawn rather than photographed so the tiles stay sharp at any size, need no
 * download, and work with no network at the table.
 */

import { tile, type TileId } from '../../engine/tiles'

const GREEN = '#1b7a4b'
const RED = '#b3312c'
const BLUE = '#215f9a'
const INK = '#1c1c22'

/** viewBox the faces are drawn in. Everything below is in these units. */
export const FACE_W = 60
export const FACE_H = 84

/* --------------------------------------------------------------- numerals */

const NUMERAL = ['', '一', '二', '三', '四', '伍', '六', '七', '八', '九']

function Characters({ rank }: { rank: number }) {
  return (
    <>
      <text
        x={FACE_W / 2}
        y={36}
        textAnchor="middle"
        fontSize={30}
        fill={INK}
        fontFamily="'Noto Serif SC','Songti SC','SimSun','Microsoft YaHei',serif"
      >
        {NUMERAL[rank]}
      </text>
      <text
        x={FACE_W / 2}
        y={70}
        textAnchor="middle"
        fontSize={26}
        fill={RED}
        fontFamily="'Noto Serif SC','Songti SC','SimSun','Microsoft YaHei',serif"
      >
        萬
      </text>
    </>
  )
}

/* ------------------------------------------------------------------- dots */

/** Positions as fractions of the drawing area, per rank. */
const DOT_LAYOUT: Record<number, Array<[number, number]>> = {
  1: [[0.5, 0.5]],
  2: [[0.5, 0.25], [0.5, 0.75]],
  3: [[0.24, 0.22], [0.5, 0.5], [0.76, 0.78]],
  4: [[0.28, 0.26], [0.72, 0.26], [0.28, 0.74], [0.72, 0.74]],
  5: [[0.26, 0.22], [0.74, 0.22], [0.5, 0.5], [0.26, 0.78], [0.74, 0.78]],
  6: [[0.29, 0.18], [0.71, 0.18], [0.29, 0.5], [0.71, 0.5], [0.29, 0.82], [0.71, 0.82]],
  7: [
    [0.24, 0.14], [0.5, 0.14], [0.76, 0.14],
    [0.29, 0.52], [0.71, 0.52], [0.29, 0.84], [0.71, 0.84],
  ],
  8: [
    [0.29, 0.12], [0.71, 0.12], [0.29, 0.37], [0.71, 0.37],
    [0.29, 0.63], [0.71, 0.63], [0.29, 0.88], [0.71, 0.88],
  ],
  9: [
    [0.2, 0.16], [0.5, 0.16], [0.8, 0.16],
    [0.2, 0.5], [0.5, 0.5], [0.8, 0.5],
    [0.2, 0.84], [0.5, 0.84], [0.8, 0.84],
  ],
}

/** Which dots are drawn in red, mirroring the traditional colouring. */
const DOT_RED: Record<number, number[]> = {
  1: [0], 3: [2], 5: [2], 6: [], 7: [0, 1, 2], 9: [3, 4, 5],
}

const DOT_BLUE: Record<number, number[]> = {
  2: [1], 4: [1, 2], 6: [0, 3, 5], 8: [1, 3, 5, 7],
}

function Dots({ rank }: { rank: number }) {
  const layout = DOT_LAYOUT[rank] ?? []
  const x0 = 11
  const x1 = FACE_W - 11
  const y0 = 12
  const y1 = FACE_H - 12
  const r = rank === 1 ? 15 : rank <= 4 ? 8 : rank <= 6 ? 7 : 6
  const reds = new Set(DOT_RED[rank] ?? [])
  const blues = new Set(DOT_BLUE[rank] ?? [])

  return (
    <>
      {layout.map(([fx, fy], i) => {
        const cx = x0 + fx * (x1 - x0)
        const cy = y0 + fy * (y1 - y0)
        const colour = reds.has(i) ? RED : blues.has(i) ? BLUE : GREEN
        return (
          <g key={i}>
            <circle cx={cx} cy={cy} r={r} fill="none" stroke={colour} strokeWidth={r > 10 ? 3 : 2} />
            <circle cx={cx} cy={cy} r={r * 0.42} fill={colour} />
            {rank === 1 ? (
              <circle cx={cx} cy={cy} r={r * 0.72} fill="none" stroke={RED} strokeWidth={1.6} />
            ) : null}
          </g>
        )
      })}
    </>
  )
}

/* ----------------------------------------------------------------- bamboo */

const BAMBOO_LAYOUT: Record<number, Array<[number, number]>> = {
  2: [[0.5, 0.26], [0.5, 0.74]],
  3: [[0.5, 0.2], [0.28, 0.72], [0.72, 0.72]],
  4: [[0.28, 0.26], [0.72, 0.26], [0.28, 0.74], [0.72, 0.74]],
  5: [[0.24, 0.22], [0.76, 0.22], [0.5, 0.5], [0.24, 0.78], [0.76, 0.78]],
  6: [
    [0.2, 0.26], [0.5, 0.26], [0.8, 0.26],
    [0.2, 0.74], [0.5, 0.74], [0.8, 0.74],
  ],
  7: [
    [0.5, 0.13],
    [0.2, 0.5], [0.5, 0.5], [0.8, 0.5],
    [0.2, 0.86], [0.5, 0.86], [0.8, 0.86],
  ],
  8: [
    [0.26, 0.16], [0.5, 0.16], [0.74, 0.16],
    [0.38, 0.5], [0.62, 0.5],
    [0.26, 0.84], [0.5, 0.84], [0.74, 0.84],
  ],
  9: [
    [0.2, 0.16], [0.5, 0.16], [0.8, 0.16],
    [0.2, 0.5], [0.5, 0.5], [0.8, 0.5],
    [0.2, 0.84], [0.5, 0.84], [0.8, 0.84],
  ],
}

const BAMBOO_RED: Record<number, number[]> = {
  5: [2], 7: [0], 9: [3, 4, 5],
}

function Stick({ cx, cy, h, colour }: { cx: number; cy: number; h: number; colour: string }) {
  const w = 5
  return (
    <g>
      <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} rx={2.2} fill={colour} />
      <rect x={cx - w / 2 - 1.6} y={cy - 1.4} width={w + 3.2} height={2.8} rx={1.2} fill={colour} />
    </g>
  )
}

/** The 1 Bamboo, which the guide draws as a bird rather than a stick. */
function BambooBird() {
  return (
    <g transform={`translate(${FACE_W / 2}, ${FACE_H / 2})`}>
      {/* tail sweeping down to the left */}
      <path d="M -4 6 C -12 14 -16 22 -13 26 C -8 24 -3 16 -1 10 Z" fill={GREEN} />
      {/* body */}
      <ellipse cx={1} cy={2} rx={8} ry={11} transform="rotate(-12 1 2)" fill={GREEN} />
      {/* folded wing */}
      <path d="M -2 -4 C -9 0 -9 8 -3 10 C 1 7 1 -1 -2 -4 Z" fill="#0f5c37" />
      {/* head and beak */}
      <circle cx={4} cy={-12} r={5.4} fill={GREEN} />
      <circle cx={5.6} cy={-13} r={1.3} fill="#f7f5ef" />
      <path d="M 9 -12 L 15 -10 L 9 -8.5 Z" fill={RED} />
      {/* crest */}
      <path d="M 2 -17 C 1 -22 4 -24 6 -22" stroke={RED} strokeWidth={1.6} fill="none" />
      {/* legs */}
      <path d="M 1 12 L -1 21 M 1 12 L 5 21" stroke={RED} strokeWidth={1.8} fill="none" />
      <path d="M -1 21 L -4 23 M 5 21 L 8 23" stroke={RED} strokeWidth={1.5} fill="none" />
    </g>
  )
}

function Bamboo({ rank }: { rank: number }) {
  if (rank === 1) return <BambooBird />
  const layout = BAMBOO_LAYOUT[rank] ?? []
  const x0 = 12
  const x1 = FACE_W - 12
  const y0 = 13
  const y1 = FACE_H - 13
  const reds = new Set(BAMBOO_RED[rank] ?? [])
  const h = rank <= 4 ? 24 : rank <= 6 ? 22 : 18

  return (
    <>
      {layout.map(([fx, fy], i) => (
        <Stick
          key={i}
          cx={x0 + fx * (x1 - x0)}
          cy={y0 + fy * (y1 - y0)}
          h={h}
          colour={reds.has(i) ? RED : GREEN}
        />
      ))}
    </>
  )
}

/* --------------------------------------------------------- honors and bonus */

const HONOR_GLYPH: Record<string, { glyph: string; colour: string; label?: string }> = {
  we: { glyph: '東', colour: INK },
  ws: { glyph: '南', colour: INK },
  ww: { glyph: '西', colour: INK },
  wn: { glyph: '北', colour: INK },
  dr: { glyph: '中', colour: RED },
  dg: { glyph: '發', colour: GREEN },
  f1: { glyph: '梅', colour: RED, label: 'Plum' },
  f2: { glyph: '蘭', colour: GREEN, label: 'Orchid' },
  f3: { glyph: '菊', colour: '#c07c18', label: 'Chrys' },
  f4: { glyph: '竹', colour: GREEN, label: 'Bamboo' },
  s1: { glyph: '春', colour: RED, label: 'Spring' },
  s2: { glyph: '夏', colour: GREEN, label: 'Summer' },
  s3: { glyph: '秋', colour: '#c07c18', label: 'Autumn' },
  s4: { glyph: '冬', colour: BLUE, label: 'Winter' },
}

function Honor({ id }: { id: TileId }) {
  // The White Dragon is a blank tile inside a frame, not a character.
  if (id === 'dw') {
    return (
      <rect
        x={14}
        y={16}
        width={FACE_W - 28}
        height={FACE_H - 32}
        rx={3}
        fill="none"
        stroke={BLUE}
        strokeWidth={3}
      />
    )
  }
  const face = HONOR_GLYPH[id]
  if (!face) return null
  const isBonus = tile(id).bonus
  return (
    <>
      <text
        x={FACE_W / 2}
        y={isBonus ? 50 : 58}
        textAnchor="middle"
        fontSize={isBonus ? 32 : 42}
        fill={face.colour}
        fontFamily="'Noto Serif SC','Songti SC','SimSun','Microsoft YaHei',serif"
      >
        {face.glyph}
      </text>
      {isBonus && face.label ? (
        <text
          x={FACE_W / 2}
          y={FACE_H - 12}
          textAnchor="middle"
          fontSize={10}
          fill="#6b6b73"
          fontFamily="Inter, system-ui, sans-serif"
        >
          {face.label}
        </text>
      ) : null}
    </>
  )
}

/* ------------------------------------------------------------------ export */

export function TileFace({ id }: { id: TileId }) {
  const t = tile(id)
  if (t.group === 'c') return <Characters rank={t.rank} />
  if (t.group === 'd') return <Dots rank={t.rank} />
  if (t.group === 'b') return <Bamboo rank={t.rank} />
  return <Honor id={id} />
}
