/**
 * Tile recognition. The photo is downscaled in the browser and posted to
 * whichever endpoint `endpoint.ts` selected: the local recognition server, the
 * deployed Supabase Edge Function, or the Anthropic API directly in
 * development. No API key ever lives in the shipped bundle.
 *
 * Recognition is never trusted: everything it returns lands in the tile editor
 * for the player to confirm before anything is scored.
 */

import { isTileId, type TileId } from '../engine/tiles'
import { recognizerEndpoint, type Endpoint } from './endpoint'
import { SYSTEM_PROMPT, TILE_SCHEMA } from './prompt'

export interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
}

export interface DetectedTile {
  tile: TileId
  confidence: number
  group: 'concealed' | 'melded' | 'bonus'
  boundingBox: BoundingBox
}

export interface RecognitionResult {
  tiles: DetectedTile[]
  notes: string
  /** Tiles the model named that this app does not recognise. */
  unreadable: string[]
  /** Which endpoint answered, for the confirmation screen. */
  source: string
  elapsedMs: number
}

export class RecognitionUnavailable extends Error {}

/** Longest edge Claude accepts without downscaling server-side. */
const MAX_EDGE = 1568

/** Downscales and re-encodes so a 12 megapixel phone photo is not uploaded whole. */
export async function prepareImage(file: Blob): Promise<{ dataUrl: string; blob: Blob }> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('This browser cannot process images.')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Could not encode the photo.'))),
      'image/jpeg',
      0.85,
    )
  })
  return { dataUrl: canvas.toDataURL('image/jpeg', 0.85), blob }
}

/** Rotates a data URL by a quarter turn, used by the retake controls. */
export async function rotateImage(dataUrl: string, quarterTurns: number): Promise<string> {
  const img = new Image()
  img.src = dataUrl
  await img.decode()
  const turns = ((quarterTurns % 4) + 4) % 4
  const swap = turns % 2 === 1
  const canvas = document.createElement('canvas')
  canvas.width = swap ? img.height : img.width
  canvas.height = swap ? img.width : img.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return dataUrl
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate((turns * Math.PI) / 2)
  ctx.drawImage(img, -img.width / 2, -img.height / 2)
  return canvas.toDataURL('image/jpeg', 0.85)
}

/** Crops a data URL to a rectangle given in fractions of the image size. */
export async function cropImage(dataUrl: string, box: BoundingBox): Promise<string> {
  const img = new Image()
  img.src = dataUrl
  await img.decode()
  const sx = Math.max(0, box.x * img.width)
  const sy = Math.max(0, box.y * img.height)
  const sw = Math.min(img.width - sx, box.width * img.width)
  const sh = Math.min(img.height - sy, box.height * img.height)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(sw)
  canvas.height = Math.round(sh)
  const ctx = canvas.getContext('2d')
  if (!ctx) return dataUrl
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.85)
}

function base64Of(dataUrl: string): string {
  return dataUrl.slice(dataUrl.indexOf(',') + 1)
}

interface RawTile {
  tile?: string
  confidence?: number
  group?: string
  bounding_box?: Partial<BoundingBox>
}

function normalise(raw: RawTile[]): { tiles: DetectedTile[]; unreadable: string[] } {
  const tiles: DetectedTile[] = []
  const unreadable: string[] = []
  for (const r of raw) {
    const id = String(r.tile ?? '').trim().toLowerCase()
    if (!isTileId(id)) {
      if (id) unreadable.push(id)
      continue
    }
    const box = r.bounding_box ?? {}
    tiles.push({
      tile: id,
      confidence: Math.max(0, Math.min(1, Number(r.confidence ?? 0.5))),
      group: r.group === 'melded' || r.group === 'bonus' ? r.group : 'concealed',
      boundingBox: {
        x: Number(box.x ?? 0),
        y: Number(box.y ?? 0),
        width: Number(box.width ?? 0),
        height: Number(box.height ?? 0),
      },
    })
  }
  tiles.sort((a, b) =>
    a.boundingBox.y - b.boundingBox.y || a.boundingBox.x - b.boundingBox.x)
  return { tiles, unreadable }
}

const MODEL = 'claude-opus-5'

/** Posts the photo to the local server or the Supabase Edge Function. */
async function callEndpoint(endpoint: Endpoint, dataUrl: string): Promise<unknown> {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (endpoint.kind === 'edge' && import.meta.env.VITE_SUPABASE_ANON_KEY) {
    headers.authorization = 'Bearer ' + import.meta.env.VITE_SUPABASE_ANON_KEY
  }
  const res = await fetch(endpoint.url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ image: base64Of(dataUrl), media_type: 'image/jpeg' }),
  })
  if (!res.ok) {
    let detail = await res.text()
    try {
      detail = (JSON.parse(detail) as { error?: string }).error ?? detail
    } catch {
      // the body was not JSON, so show it as it came back
    }
    throw new Error(detail || 'The recognition endpoint returned ' + res.status + '.')
  }
  return res.json()
}

/**
 * Development-only direct call. The key would be visible in the built bundle,
 * so this path stays off unless VITE_DEV_ANTHROPIC_API_KEY is set locally.
 */
async function callAnthropicDirect(dataUrl: string): Promise<unknown> {
  const key = import.meta.env.VITE_DEV_ANTHROPIC_API_KEY
  if (!key) throw new RecognitionUnavailable('no-api-key')
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: [TILE_SCHEMA],
      tool_choice: { type: 'tool', name: 'report_tiles' },
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/jpeg', data: base64Of(dataUrl) },
          },
          { type: 'text', text: 'Read the Mahjong tiles in this photo.' },
        ],
      }],
    }),
  })
  if (!res.ok) throw new Error('Recognition failed: ' + res.status + ' ' + (await res.text()))
  return res.json()
}

/** Pulls the tile list out of either endpoint's reply shape. */
function extractToolInput(payload: unknown): { tiles: RawTile[]; notes: string } {
  const p = payload as Record<string, unknown>
  if (Array.isArray(p?.tiles)) {
    return { tiles: p.tiles as RawTile[], notes: String(p.notes ?? '') }
  }
  const content = (p?.content ?? []) as Array<Record<string, unknown>>
  const toolUse = content.find((c) => c.type === 'tool_use')
  const input = (toolUse?.input ?? {}) as Record<string, unknown>
  return { tiles: (input.tiles as RawTile[]) ?? [], notes: String(input.notes ?? '') }
}

export async function recognizeTiles(dataUrl: string): Promise<RecognitionResult> {
  const started = performance.now()
  const endpoint = recognizerEndpoint()
  if (endpoint.kind === 'none') {
    throw new RecognitionUnavailable(
      'No recognition endpoint is configured. Run npm run recognize, or deploy the ' +
      'Supabase Edge Function.',
    )
  }

  const payload = endpoint.kind === 'direct'
    ? await callAnthropicDirect(dataUrl)
    : await callEndpoint(endpoint, dataUrl)

  const { tiles: raw, notes } = extractToolInput(payload)
  const { tiles, unreadable } = normalise(raw)
  return {
    tiles,
    notes,
    unreadable,
    source: endpoint.label,
    elapsedMs: performance.now() - started,
  }
}

export { recognizerEndpoint } from './endpoint'
export { probeRecognizer, type RecognizerStatus } from './endpoint'
