/**
 * Recognition providers. Each one takes a JPEG buffer and returns the raw text
 * the model produced; parsing and validation happen in the server.
 *
 * The server picks the first provider that reports itself available, so the
 * same endpoint works whether the machine has Hermes, an Anthropic key, or an
 * OpenAI-compatible endpoint such as `hermes proxy start`.
 */

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { writeFile, unlink, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { SYSTEM_PROMPT, USER_PROMPT } from './prompt.mjs'

const CALL_TIMEOUT_MS = Number(process.env.RECOGNIZE_TIMEOUT_MS ?? 180_000)

/* ------------------------------------------------------------------ hermes */

/** Locates the Hermes CLI, which ships inside its own virtualenv. */
export function hermesBinary() {
  if (process.env.HERMES_BIN && existsSync(process.env.HERMES_BIN)) {
    return process.env.HERMES_BIN
  }
  const home = process.env.HERMES_HOME
  if (!home) return null
  const candidates = [
    path.join(home, 'hermes-agent', 'venv', 'Scripts', 'hermes.exe'),
    path.join(home, 'hermes-agent', 'venv', 'Scripts', 'hermes'),
    path.join(home, 'hermes-agent', 'venv', 'bin', 'hermes'),
  ]
  return candidates.find((c) => existsSync(c)) ?? null
}

function runHermes(bin, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { windowsHide: true })
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error('Hermes did not answer within ' + CALL_TIMEOUT_MS / 1000 + ' seconds.'))
    }, CALL_TIMEOUT_MS)

    child.stdout.on('data', (d) => { stdout += d })
    child.stderr.on('data', (d) => { stderr += d })
    child.on('error', (err) => { clearTimeout(timer); reject(err) })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code !== 0) {
        reject(new Error('Hermes exited with code ' + code + '. ' + stderr.trim()))
        return
      }
      resolve(stdout)
    })
  })
}

/**
 * Hermes prints a `session_id:` line alongside the answer in quiet mode, and
 * may wrap JSON in a fenced block. Strip both.
 */
function cleanHermesOutput(raw) {
  return raw
    .split('\n')
    .filter((line) => !/^\s*session_id:/i.test(line))
    .join('\n')
}

export const hermesProvider = {
  id: 'hermes',
  label: 'Hermes CLI',
  available() {
    return hermesBinary() !== null
  },
  describe() {
    const bin = hermesBinary()
    return bin ? 'Hermes CLI at ' + bin : 'Hermes CLI not found'
  },
  async recognize(jpeg) {
    const bin = hermesBinary()
    if (!bin) throw new Error('Hermes is not installed on this machine.')
    const dir = await mkdtemp(path.join(tmpdir(), 'mahjong-'))
    const file = path.join(dir, 'hand.jpg')
    await writeFile(file, jpeg)
    try {
      // `-t ""` turns off tool use: this is a single vision question, and the
      // agent loop would only slow it down.
      const out = await runHermes(bin, [
        'chat', '-Q', '-t', '', '--image', file,
        '-q', SYSTEM_PROMPT + '\n\n' + USER_PROMPT,
      ])
      return cleanHermesOutput(out)
    } finally {
      await unlink(file).catch(() => {})
    }
  },
}

/* --------------------------------------------------------------- anthropic */

export const anthropicProvider = {
  id: 'anthropic',
  label: 'Anthropic API',
  available() {
    return Boolean(process.env.ANTHROPIC_API_KEY)
  },
  describe() {
    return 'Anthropic API as ' + (process.env.RECOGNIZE_MODEL ?? 'claude-opus-5')
  },
  async recognize(jpeg) {
    const res = await fetch(
      (process.env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com') + '/v1/messages',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
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
                source: { type: 'base64', media_type: 'image/jpeg', data: jpeg.toString('base64') },
              },
              { type: 'text', text: USER_PROMPT },
            ],
          }],
        }),
        signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
      },
    )
    if (!res.ok) throw new Error('Anthropic returned ' + res.status + ': ' + (await res.text()))
    const body = await res.json()
    return (body.content ?? []).filter((c) => c.type === 'text').map((c) => c.text).join('\n')
  },
}

/* ------------------------------------------------- openai-compatible proxy */

/**
 * Any OpenAI-compatible chat-completions endpoint, which is what
 * `hermes proxy start` exposes on 127.0.0.1:8645.
 */
export const openAiCompatibleProvider = {
  id: 'openai',
  label: 'OpenAI-compatible endpoint',
  available() {
    return Boolean(process.env.RECOGNIZE_BASE_URL)
  },
  describe() {
    return 'OpenAI-compatible endpoint at ' + process.env.RECOGNIZE_BASE_URL
  },
  async recognize(jpeg) {
    const base = process.env.RECOGNIZE_BASE_URL.replace(/\/$/, '')
    const res = await fetch(base + '/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer ' + (process.env.RECOGNIZE_API_KEY ?? 'local'),
      },
      body: JSON.stringify({
        model: process.env.RECOGNIZE_MODEL ?? 'gpt-5.6-terra',
        max_tokens: 4096,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: USER_PROMPT },
              {
                type: 'image_url',
                image_url: { url: 'data:image/jpeg;base64,' + jpeg.toString('base64') },
              },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
    })
    if (!res.ok) throw new Error('Upstream returned ' + res.status + ': ' + (await res.text()))
    const body = await res.json()
    return body.choices?.[0]?.message?.content ?? ''
  },
}

/**
 * Providers in preference order. An explicit RECOGNIZE_PROVIDER wins; the
 * hosted APIs come before Hermes because they answer faster.
 */
export const PROVIDERS = [anthropicProvider, openAiCompatibleProvider, hermesProvider]

export function selectProvider() {
  const wanted = process.env.RECOGNIZE_PROVIDER
  if (wanted) {
    const chosen = PROVIDERS.find((p) => p.id === wanted)
    if (!chosen) throw new Error('Unknown RECOGNIZE_PROVIDER: ' + wanted)
    return chosen
  }
  return PROVIDERS.find((p) => p.available()) ?? null
}
