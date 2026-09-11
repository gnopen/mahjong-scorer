// Supabase Edge Function (Deno). Proxies tile recognition to the Claude API so
// the API key never reaches the browser.
//
// Deploy:
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//   supabase functions deploy recognize-tiles

const MODEL = 'claude-opus-5'

const SYSTEM_PROMPT = `You read photographs of Mahjong tiles on a table and report what you see.

Rules for reading the photo:
- Report every tile face you can see, including tiles laid out as melds and any flower or season tiles set aside.
- Do not report a tile you cannot actually see. A face-down tile is not reported.
- A winning hand is normally 14 tiles, or more when kongs are present. If you count fewer, still report exactly what is visible rather than inventing tiles to reach 14.
- Characters tiles carry a Chinese numeral above the 萬 character. Bamboo tiles show sticks, and 1 Bamboo is usually drawn as a bird. Dots tiles show circles.
- Dragons: red 中, green 發, white is a blank tile with a blue or green frame.
- Winds carry 東 South 南 West 西 North 北.
- Set confidence below 0.7 for any tile that is partly hidden, blurred, at a steep angle, or washed out by glare.
- Use the bounding box to say where each tile sits, as fractions of the image size.

Report your reading with the report_tiles tool. Do not write anything else.`

const TOOL = {
  name: 'report_tiles',
  description:
    'Report every Mahjong tile visible in the photograph, left to right and top to bottom.',
  input_schema: {
    type: 'object',
    properties: {
      tiles: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            tile: {
              type: 'string',
              description:
                'Tile id. b1-b9 Bamboo, c1-c9 Characters, d1-d9 Dots, we/ws/ww/wn winds, ' +
                'dr/dg/dw dragons, f1-f4 flowers, s1-s4 seasons.',
            },
            confidence: { type: 'number' },
            group: { type: 'string', enum: ['concealed', 'melded', 'bonus'] },
            bounding_box: {
              type: 'object',
              properties: {
                x: { type: 'number' },
                y: { type: 'number' },
                width: { type: 'number' },
                height: { type: 'number' },
              },
              required: ['x', 'y', 'width', 'height'],
            },
          },
          required: ['tile', 'confidence', 'group', 'bounding_box'],
        },
      },
      notes: { type: 'string' },
    },
    required: ['tiles'],
  },
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type, apikey',
  'access-control-allow-methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405)

  const key = Deno.env.get('ANTHROPIC_API_KEY')
  if (!key) return json({ error: 'ANTHROPIC_API_KEY is not set on this function.' }, 500)

  let image: string
  let mediaType: string
  try {
    const body = await req.json()
    image = String(body.image ?? '')
    mediaType = String(body.media_type ?? 'image/jpeg')
    if (!image) return json({ error: 'No image was sent.' }, 400)
  } catch {
    return json({ error: 'The request body was not valid JSON.' }, 400)
  }

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: [TOOL],
      tool_choice: { type: 'tool', name: 'report_tiles' },
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
          { type: 'text', text: 'Read the Mahjong tiles in this photo.' },
        ],
      }],
    }),
  })

  if (!upstream.ok) {
    return json({ error: 'Claude returned ' + upstream.status, detail: await upstream.text() }, 502)
  }

  const reply = await upstream.json()
  const toolUse = (reply.content ?? []).find(
    (c: { type: string }) => c.type === 'tool_use',
  )
  if (!toolUse) return json({ tiles: [], notes: 'Claude did not report any tiles.' })
  return json(toolUse.input)
})
