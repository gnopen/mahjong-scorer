/**
 * Where tile recognition is sent, and whether that place is actually alive.
 *
 * Four endpoints speak the same request and response shape:
 *
 *   local  the recognize server in `server/`, which wraps Hermes, an
 *          Anthropic key, or any OpenAI-compatible endpoint
 *   hosted the serverless function shipped with the site at /api/recognize,
 *          which is what a Vercel deployment uses
 *   edge   the deployed Supabase Edge Function
 *   direct the Anthropic API straight from the page, development only
 *
 * The screens ask `probeRecognizer()` rather than assuming, so the UI never
 * claims recognition works when the server behind it is not running.
 */

export type EndpointKind = 'local' | 'hosted' | 'edge' | 'direct' | 'none'

export interface Endpoint {
  kind: EndpointKind
  url: string
  label: string
}

/**
 * The recognition server runs next to the dev server, so it lives on the same
 * host the page came from. Using `location.hostname` rather than `localhost`
 * matters the moment a phone opens the app over wifi: on the phone,
 * `localhost` is the phone.
 */
function defaultLocalUrl(): string {
  const host = typeof location !== 'undefined' && location.hostname
    ? location.hostname
    : 'localhost'
  return 'http://' + host + ':8788/recognize'
}

function edgeUrl(): string | null {
  const base = import.meta.env.VITE_SUPABASE_URL
  const name = import.meta.env.VITE_RECOGNIZE_FUNCTION || 'recognize-tiles'
  if (!base || base.includes('YOUR-PROJECT')) return null
  return base.replace(/\/$/, '') + '/functions/v1/' + name
}

/** The endpoint this build will use, without touching the network. */
export function recognizerEndpoint(): Endpoint {
  const explicit = import.meta.env.VITE_RECOGNIZE_URL
  if (explicit) {
    return { kind: 'local', url: explicit, label: 'Local recognition server' }
  }

  const edge = edgeUrl()
  if (edge) {
    return { kind: 'edge', url: edge, label: 'Supabase Edge Function' }
  }

  if (import.meta.env.DEV) {
    return { kind: 'local', url: defaultLocalUrl(), label: 'Local recognition server' }
  }

  if (import.meta.env.VITE_DEV_ANTHROPIC_API_KEY) {
    return {
      kind: 'direct',
      url: 'https://api.anthropic.com/v1/messages',
      label: 'Anthropic API, called from the browser',
    }
  }

  // A deployed build asks its own origin. On Vercel that is the function in
  // `api/`, which answers with a clear message when no key is configured.
  if (typeof location !== 'undefined' && location.protocol.startsWith('http')) {
    return {
      kind: 'hosted',
      url: '/api/recognize',
      label: 'Recognition service on this site',
    }
  }

  return { kind: 'none', url: '', label: 'Not configured' }
}

export interface RecognizerStatus {
  ready: boolean
  endpoint: Endpoint
  /** One sentence describing what is or is not set up. */
  detail: string
  /** Which model provider answered the health check, when it said. */
  provider?: string
}

/**
 * Both the local server and the hosted function answer a GET on the same URL
 * with their own status, so there is one way to ask.
 */
export async function probeRecognizer(): Promise<RecognizerStatus> {
  const endpoint = recognizerEndpoint()

  if (endpoint.kind === 'none') {
    return {
      ready: false,
      endpoint,
      detail:
        'Photo recognition needs a server to read the picture, and this copy of the app ' +
        'does not have one. Everything else works, and the tile picker gives exactly the ' +
        'same score.',
    }
  }

  // The Supabase Edge Function only handles POST, so it is judged by
  // configuration rather than asked.
  if (endpoint.kind === 'edge' || endpoint.kind === 'direct') {
    return { ready: true, endpoint, detail: endpoint.label + ' is configured.' }
  }

  try {
    const res = await fetch(endpoint.url, { signal: AbortSignal.timeout(4000) })
    if (!res.ok) {
      return {
        ready: false,
        endpoint,
        detail: endpoint.kind === 'local'
          ? 'The recognition server answered with ' + res.status + '.'
          : 'This site has no recognition service deployed, so photo scoring is off. ' +
            'The tile picker gives exactly the same score.',
      }
    }
    const body = (await res.json()) as {
      ok?: boolean
      provider?: string
      label?: string
      detail?: string
    }
    if (!body.ok) {
      return {
        ready: false,
        endpoint,
        detail: body.detail ?? 'The recognition server has no provider available.',
      }
    }
    return {
      ready: true,
      endpoint,
      provider: body.provider,
      detail: 'Reading photos through ' + (body.label ?? body.provider ?? 'a local provider') + '.',
    }
  } catch {
    return {
      ready: false,
      endpoint,
      detail: endpoint.kind === 'local'
        ? 'The recognition server is not running. Start it with npm run recognize, ' +
          'or use npm run dev:all to run it alongside the app.'
        : 'The recognition service on this site did not answer. Photo scoring is off; ' +
          'the tile picker gives exactly the same score.',
    }
  }
}
