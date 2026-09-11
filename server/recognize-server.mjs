#!/usr/bin/env node
/**
 * Local tile-recognition API.
 *
 * Exists so the app has a working recognition endpoint on a laptop, without a
 * deployed Supabase Edge Function and without an API key in the browser
 * bundle. It speaks the same request and response shape as the Edge Function,
 * so the app cannot tell them apart.
 *
 *   GET  /recognize  which provider is active and whether it is ready
 *   GET  /health     the same answer, kept for scripts
 *   POST /recognize  { image: base64, media_type } -> { tiles, notes, ... }
 *
 *   npm run recognize
 */

import { createServer } from 'node:http'

import { PROVIDERS, selectProvider } from './providers.mjs'

const PORT = Number(process.env.RECOGNIZE_PORT ?? 8788)
const HOST = process.env.RECOGNIZE_HOST ?? '127.0.0.1'
const MAX_BODY_BYTES = 12 * 1024 * 1024

/** Every tile id the app understands. Anything else is dropped, not guessed. */
const VALID_TILES = new Set([
  ...['b', 'c', 'd'].flatMap((s) => [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => s + n)),
  'we', 'ws', 'ww', 'wn', 'dr', 'dg', 'dw',
  'f1', 'f2', 'f3', 'f4', 's1', 's2', 's3', 's4',
])

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type, apikey',
  'access-control-allow-methods': 'POST, GET, OPTIONS',
}

function send(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, { ...CORS, 'content-type': 'application/json' })
  res.end(payload)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error('The photo is larger than 12 MB.'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

/**
 * Pulls the JSON object out of a model reply. Models wrap JSON in code fences
 * or add a sentence of preamble often enough that scanning for the outermost
 * balanced object is more reliable than trusting the whole string.
 */
function extractJson(text) {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced ? fenced[1].trim() : trimmed

  try {
    return JSON.parse(candidate)
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
          return JSON.parse(candidate.slice(start, i + 1))
        } catch {
          return null
        }
      }
    }
  }
  return null
}

function clamp01(n, fallback) {
  const value = Number(n)
  if (!Number.isFinite(value)) return fallback
  return Math.max(0, Math.min(1, value))
}

/** Normalises whatever the model said into the shape the app expects. */
function normalise(parsed) {
  const raw = Array.isArray(parsed?.tiles) ? parsed.tiles : []
  const tiles = []
  const rejected = []

  for (const entry of raw) {
    const id = String(entry?.tile ?? '').trim().toLowerCase()
    if (!VALID_TILES.has(id)) {
      if (id) rejected.push(id)
      continue
    }
    const box = entry?.bounding_box ?? entry?.boundingBox ?? {}
    const group = entry?.group === 'melded' || entry?.group === 'bonus'
      ? entry.group
      : 'concealed'
    tiles.push({
      tile: id,
      confidence: clamp01(entry?.confidence, 0.5),
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
    typeof parsed?.notes === 'string' ? parsed.notes : '',
    rejected.length > 0
      ? 'Ignored ' + rejected.length + ' unrecognised label' +
        (rejected.length === 1 ? '' : 's') + ': ' + rejected.join(', ') + '.'
      : '',
  ].filter(Boolean).join(' ')

  return { tiles, notes }
}

async function handleRecognize(req, res, provider) {
  let body
  try {
    body = JSON.parse((await readBody(req)).toString('utf8'))
  } catch (err) {
    send(res, 400, { error: 'The request body was not valid JSON. ' + err.message })
    return
  }

  const base64 = String(body?.image ?? '').replace(/^data:[^,]+,/, '')
  if (!base64) {
    send(res, 400, { error: 'No image was sent.' })
    return
  }

  const jpeg = Buffer.from(base64, 'base64')
  if (jpeg.length === 0) {
    send(res, 400, { error: 'The image could not be decoded.' })
    return
  }

  const started = Date.now()
  let text
  try {
    text = await provider.recognize(jpeg)
  } catch (err) {
    console.error('[recognize] provider failed:', err.message)
    send(res, 502, { error: provider.label + ' could not read the photo. ' + err.message })
    return
  }

  const parsed = extractJson(text)
  if (!parsed) {
    console.error('[recognize] unparseable reply:', text.slice(0, 400))
    send(res, 502, {
      error: provider.label + ' did not answer with JSON.',
      detail: text.slice(0, 400),
    })
    return
  }

  const result = normalise(parsed)
  const elapsed = Date.now() - started
  console.log(
    '[recognize] ' + result.tiles.length + ' tiles in ' + (elapsed / 1000).toFixed(1) + 's',
  )
  send(res, 200, { ...result, provider: provider.id, elapsed_ms: elapsed })
}

const server = createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS)
    res.end()
    return
  }

  const url = new URL(req.url, 'http://' + HOST)

  const healthPaths = ['/health', '/recognize', '/']
  if (req.method === 'GET' && healthPaths.includes(url.pathname)) {
    let provider = null
    let error = null
    try {
      provider = selectProvider()
    } catch (err) {
      error = err.message
    }
    send(res, 200, {
      ok: Boolean(provider),
      provider: provider?.id ?? null,
      label: provider?.label ?? null,
      detail: provider?.describe() ?? error ?? 'No recognition provider is available.',
      candidates: PROVIDERS.map((p) => ({
        id: p.id, label: p.label, available: p.available(),
      })),
    })
    return
  }

  if (req.method === 'POST' && (url.pathname === '/recognize' || url.pathname === '/')) {
    let provider
    try {
      provider = selectProvider()
    } catch (err) {
      send(res, 500, { error: err.message })
      return
    }
    if (!provider) {
      send(res, 503, {
        error: 'No recognition provider is available. Install Hermes, set ' +
          'ANTHROPIC_API_KEY, or set RECOGNIZE_BASE_URL.',
      })
      return
    }
    void handleRecognize(req, res, provider)
    return
  }

  send(res, 404, { error: 'Use POST /recognize or GET /health.' })
})

server.listen(PORT, HOST, () => {
  let provider = null
  try {
    provider = selectProvider()
  } catch (err) {
    console.error('[recognize] ' + err.message)
  }
  console.log('[recognize] listening on http://' + HOST + ':' + PORT)
  console.log('[recognize] provider: ' + (provider ? provider.describe() : 'none available'))
})
