/**
 * Tile recognition on Vercel.
 *
 * Speaks the same request and response shape as the local server in `server/`
 * and the Supabase Edge Function, so the app cannot tell them apart. The API
 * key stays here; it never reaches the browser.
 *
 *   GET   /api/recognize   is this deployment able to read photos
 *   POST  /api/recognize   { image: base64, media_type } -> { tiles, notes }
 *
 * Set ANTHROPIC_API_KEY in the Vercel project. RECOGNIZE_BASE_URL plus
 * RECOGNIZE_API_KEY point it at any OpenAI-compatible endpoint instead.
 */

import { SYSTEM_PROMPT, USER_PROMPT } from '../shared/recognizePrompt.js'

export const config = { runtime: 'edge' }

const CORS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type, apikey',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  })
}

/** Every tile id the app understands. Anything else is dropped, not guessed. */
const VALID_TILES = new Set<string>([
  ...['b', 'c', 'd'].flatMap((s) => [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => s + n)),
  'we', 'ws', 'ww', 'wn', 'dr', 'dg', 'dw',
  'f1', 'f2', 'f3', 'f4', 's1', 's2', 's3', 's4',
])

interface Provider {
  id: string
  label: string
  read(imageBase64: string, mediaType: string): Promise<string>
}

function selectProvider(): Provider | null {
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (anthropicKey) {
    return {
      id: 'anthropic',
      label: 'Anthropic API',
      async read(image, mediaType) {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: process.env.RECOGNIZE_MODEL ?? 'claude-opus-5',
            max_tokens: 4096,
            system: SYSTEM_PROMPT,
            messages: [{
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: { type: 'base64', media_type: mediaType, data: image },
                },
                { type: 'text', text: USER_PROMPT },
              ],
            }],
          }),
        })
        if (!res.ok) {
          throw new Error('Anthropic returned ' + res.status + ': ' + (await res.text()))
        }
        const body = await res.json() as { content?: Array<{ type: string; text?: string }> }
        return (body.content ?? [])
          .filter((c) => c.type === 'text')
          .map((c) => c.text ?? '')
          .join('\n')
      },
    }
  }

  const base = process.env.RECOGNIZE_BASE_URL
  if (base) {
    return {
      id: 'openai',
      label: 'OpenAI-compatible endpoint',
      async read(image, mediaType) {
        const res = await fetch(base.replace(/\/$/, '') + '/chat/completions', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: 'Bearer ' + (process.env.RECOGNIZE_API_KEY ?? ''),
          },
          body: JSON.stringify({
            model: process.env.RECOGNIZE_MODEL ?? 'gpt-4o',
            max_tokens: 4096,
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              {
                role: 'user',
                content: [
                  { type: 'text', text: USER_PROMPT },
                  {
                    type: 'image_url',
                    image_url: { url: 'data:' + mediaType + ';base64,' + image },
                  },
                ],
              },
            ],
          }),
        })
        if (!res.ok) {
          throw new Error('Upstream returned ' + res.status + ': ' + (await res.text()))
        }
        const body = await res.json() as {
          choices?: Array<{ message?: { content?: string } }>
        }
        return body.choices?.[0]?.message?.content ?? ''
      },
    }
  }

  return null
}

/**
 * Pulls the JSON object out of a model reply. Models wrap JSON in code fences
 * or add a sentence of preamble often enough that scanning for the outermost
 * balanced object is more reliable than trusting the whole string.
 */
function extractJson(text: string): Record<string, unknown> | null {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced ? fenced[1].trim() : trimmed

  try {
    return JSON.parse(candidate) as Record<string, unknown>
  } catch {
    // fall through to the brace scan
  }

  const start = candidate.indexOf('{')
  if (start < 0) return null
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') inString = true
    else if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) {
        try {
          return JSON.parse(candidate.slice(start, i + 1)) as Record<string, unknown>
        } catch {
          return null
        }
      }
    }
  }
  return null
}

function clamp01(n: unknown, fallback: number): number {
  const value = Number(n)
  if (!Number.isFinite(value)) return fallback
  return Math.max(0, Math.min(1, value))
}

interface RawTile {
  tile?: string
  confidence?: number
  group?: string
  bounding_box?: Record<string, number>
  boundingBox?: Record<string, number>
}

function normalise(parsed: Record<string, unknown>) {
  const raw = Array.isArray(parsed.tiles) ? (parsed.tiles as RawTile[]) : []
  const tiles = []
  const rejected: string[] = []

  for (const entry of raw) {
    const id = String(entry?.tile ?? '').trim().toLowerCase()
    if (!VALID_TILES.has(id)) {
      if (id) rejected.push(id)
      continue
    }
    const box = entry.bounding_box ?? entry.boundingBox ?? {}
    const group = entry.group === 'melded' || entry.group === 'bonus'
      ? entry.group
      : 'concealed'
    tiles.push({
      tile: id,
      confidence: clamp01(entry.confidence, 0.5),
      group,
      bounding_box: {
        x: clamp01(box.x, 0),
        y: clamp01(box.y, 0),
        width: clamp01(box.width, 0),
        height: clamp01(box.height, 0),
      },
    })
  }

  tiles.sort((a, b) =>
    a.bounding_box.y - b.bounding_box.y || a.bounding_box.x - b.bounding_box.x)

  const notes = [
    typeof parsed.notes === 'string' ? parsed.notes : '',
    rejected.length > 0
      ? 'Ignored ' + rejected.length + ' unrecognised label' +
        (rejected.length === 1 ? '' : 's') + ': ' + rejected.join(', ') + '.'
      : '',
  ].filter(Boolean).join(' ')

  return { tiles, notes }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const provider = selectProvider()

  if (req.method === 'GET') {
    return json({
      ok: Boolean(provider),
      provider: provider?.id ?? null,
      label: provider?.label ?? null,
      detail: provider
        ? 'Reading photos through ' + provider.label + '.'
        : 'This deployment has no model key. Set ANTHROPIC_API_KEY in the Vercel ' +
          'project settings and redeploy.',
    })
  }

  if (req.method !== 'POST') return json({ error: 'Use GET or POST.' }, 405)

  if (!provider) {
    return json({
      error: 'This deployment has no model key, so photos cannot be read. ' +
        'Set ANTHROPIC_API_KEY in the Vercel project settings and redeploy.',
    }, 503)
  }

  let image: string
  let mediaType: string
  try {
    const body = await req.json() as { image?: string; media_type?: string }
    image = String(body.image ?? '').replace(/^data:[^,]+,/, '')
    mediaType = String(body.media_type ?? 'image/jpeg')
    if (!image) return json({ error: 'No image was sent.' }, 400)
  } catch {
    return json({ error: 'The request body was not valid JSON.' }, 400)
  }

  const started = Date.now()
  let text: string
  try {
    text = await provider.read(image, mediaType)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return json({ error: provider.label + ' could not read the photo. ' + message }, 502)
  }

  const parsed = extractJson(text)
  if (!parsed) {
    return json({
      error: provider.label + ' did not answer with JSON.',
      detail: text.slice(0, 400),
    }, 502)
  }

  return json({
    ...normalise(parsed),
    provider: provider.id,
    elapsed_ms: Date.now() - started,
  })
}
