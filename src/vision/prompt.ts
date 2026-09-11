/**
 * The recognition prompt and its output schema. Kept separate from the
 * transport so the Edge Function and the browser use exactly the same wording.
 */

export const TILE_SCHEMA = {
  name: 'report_tiles',
  description:
    'Report every Mahjong tile visible in the photograph, left to right and top to bottom.',
  input_schema: {
    type: 'object' as const,
    properties: {
      tiles: {
        type: 'array',
        description: 'One entry per physical tile face visible in the photo.',
        items: {
          type: 'object',
          properties: {
            tile: {
              type: 'string',
              description:
                'Tile id. Suits: b1-b9 Bamboo, c1-c9 Characters, d1-d9 Dots. ' +
                'Winds: we, ws, ww, wn. Dragons: dr (red), dg (green), dw (white). ' +
                'Bonus: f1-f4 flowers, s1-s4 seasons.',
            },
            confidence: {
              type: 'number',
              description: 'How certain you are, from 0 to 1.',
            },
            group: {
              type: 'string',
              enum: ['concealed', 'melded', 'bonus'],
              description:
                'concealed for the row still in hand, melded for a set laid on the table, ' +
                'bonus for flowers and seasons set aside.',
            },
            bounding_box: {
              type: 'object',
              description: 'Position as fractions of the image width and height.',
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
      notes: {
        type: 'string',
        description:
          'Anything that made reading the photo hard: glare, overlap, tiles cut off at the edge.',
      },
    },
    required: ['tiles'],
  },
}

export const SYSTEM_PROMPT = `You read photographs of Mahjong tiles on a table and report what you see.

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
