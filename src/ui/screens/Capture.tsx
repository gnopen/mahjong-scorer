import { useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useHandDraft } from '../../state/handDraft'
import {
  cropImage, prepareImage, recognizeTiles, rotateImage, type BoundingBox,
} from '../../vision/recognize'
import { useRecognizerStatus } from '../../state/useRecognizer'
import { Banner, Screen, Section } from '../components/Layout'

const FULL: BoundingBox = { x: 0, y: 0, width: 1, height: 1 }

type Corner = 'tl' | 'tr' | 'bl' | 'br'

export function Capture() {
  const { gameId } = useParams()
  const navigate = useNavigate()
  const loadDetection = useHandDraft((s) => s.loadDetection)
  const { status: recognizer, recheck } = useRecognizerStatus()

  const fileInput = useRef<HTMLInputElement>(null)
  const frame = useRef<HTMLDivElement>(null)

  const [image, setImage] = useState<string | null>(null)
  const [crop, setCrop] = useState<BoundingBox>(FULL)
  const [cropping, setCropping] = useState(false)
  const [working, setWorking] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const pick = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    setWorking('Preparing the photo')
    try {
      const { dataUrl } = await prepareImage(file)
      setImage(dataUrl)
      setCrop(FULL)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setWorking(null)
    }
  }

  const rotate = async () => {
    if (!image) return
    setWorking('Rotating')
    setImage(await rotateImage(image, 1))
    setCrop(FULL)
    setWorking(null)
  }

  const applyCrop = async () => {
    if (!image) return
    setWorking('Cropping')
    setImage(await cropImage(image, crop))
    setCrop(FULL)
    setCropping(false)
    setWorking(null)
  }

  const dragCorner = (corner: Corner) => (e: React.PointerEvent) => {
    e.preventDefault()
    const box = frame.current?.getBoundingClientRect()
    if (!box) return
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)

    const move = (ev: PointerEvent) => {
      const px = Math.min(1, Math.max(0, (ev.clientX - box.left) / box.width))
      const py = Math.min(1, Math.max(0, (ev.clientY - box.top) / box.height))
      setCrop((c) => {
        let { x, y, width, height } = c
        const right = x + width
        const bottom = y + height
        if (corner === 'tl' || corner === 'bl') { x = Math.min(px, right - 0.1); width = right - x }
        else { width = Math.max(0.1, px - x) }
        if (corner === 'tl' || corner === 'tr') { y = Math.min(py, bottom - 0.1); height = bottom - y }
        else { height = Math.max(0.1, py - y) }
        return { x, y, width: Math.min(width, 1 - x), height: Math.min(height, 1 - y) }
      })
    }
    const up = () => {
      target.removeEventListener('pointermove', move)
      target.removeEventListener('pointerup', up)
    }
    target.addEventListener('pointermove', move)
    target.addEventListener('pointerup', up)
  }

  const analyse = async () => {
    if (!image) return
    setError(null)
    setWorking('Reading the tiles')
    try {
      const result = await recognizeTiles(image)
      loadDetection(result, image)
      navigate('/game/' + gameId + '/tiles', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setWorking(null)
    }
  }

  const skipToManual = () => navigate('/game/' + gameId + '/tiles')

  return (
    <Screen
      title="Photograph the hand"
      back={'/game/' + gameId}
      subtitle="Lay the whole hand out flat and fill the frame"
    >
      {error ? (
        <div className="mb-4">
          <Banner tone="error" title="Recognition failed">
            <p>{error}</p>
            <button className="btn-ghost mt-3 w-full" onClick={skipToManual}>
              Enter the tiles by hand instead
            </button>
          </Banner>
        </div>
      ) : null}

      {recognizer && !recognizer.ready ? (
        <div className="mb-4">
          <Banner tone="warn" title="Recognition is unavailable">
            <p>{recognizer.detail}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button className="btn-ghost" onClick={recheck}>
                Check again
              </button>
              <button className="btn-ghost" onClick={skipToManual}>
                Open the tile picker
              </button>
            </div>
          </Banner>
        </div>
      ) : null}

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => void pick(e.target.files?.[0])}
      />

      {image ? (
        <>
          <div
            ref={frame}
            className="relative mb-3 overflow-hidden rounded-2xl border border-ink-line bg-black"
          >
            <img src={image} alt="The hand you photographed" className="block w-full" />
            {cropping ? (
              <>
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    boxShadow: 'inset 0 0 0 9999px rgba(0,0,0,0.55)',
                    clipPath:
                      'polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0,' +
                      crop.x * 100 + '% ' + crop.y * 100 + '%,' +
                      (crop.x + crop.width) * 100 + '% ' + crop.y * 100 + '%,' +
                      (crop.x + crop.width) * 100 + '% ' + (crop.y + crop.height) * 100 + '%,' +
                      crop.x * 100 + '% ' + (crop.y + crop.height) * 100 + '%,' +
                      crop.x * 100 + '% ' + crop.y * 100 + '%)',
                  }}
                />
                <div
                  className="pointer-events-none absolute border-2 border-gold"
                  style={{
                    left: crop.x * 100 + '%',
                    top: crop.y * 100 + '%',
                    width: crop.width * 100 + '%',
                    height: crop.height * 100 + '%',
                  }}
                />
                {(['tl', 'tr', 'bl', 'br'] as Corner[]).map((c) => (
                  <button
                    key={c}
                    onPointerDown={dragCorner(c)}
                    aria-label={'Drag the ' + c + ' corner'}
                    className="absolute h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-gold bg-ink/70"
                    style={{
                      left: (c === 'tl' || c === 'bl' ? crop.x : crop.x + crop.width) * 100 + '%',
                      top: (c === 'tl' || c === 'tr' ? crop.y : crop.y + crop.height) * 100 + '%',
                    }}
                  />
                ))}
              </>
            ) : null}
          </div>

          <div className="mb-3 grid grid-cols-3 gap-2">
            <button className="btn-ghost" onClick={() => fileInput.current?.click()}>
              Retake
            </button>
            <button className="btn-ghost" onClick={() => void rotate()}>
              Rotate
            </button>
            {cropping ? (
              <button className="btn-ghost" onClick={() => void applyCrop()}>
                Apply crop
              </button>
            ) : (
              <button className="btn-ghost" onClick={() => { setCrop({ x: 0.05, y: 0.2, width: 0.9, height: 0.6 }); setCropping(true) }}>
                Crop
              </button>
            )}
          </div>

          <button
            className="btn-gold w-full py-4 text-base"
            disabled={Boolean(working) || !recognizer?.ready}
            onClick={() => void analyse()}
          >
            {working ?? 'Read these tiles'}
          </button>
          {recognizer?.ready && !working ? (
            <p className="mt-2 text-center text-[11px] text-slate-500">
              {recognizer.detail} A reading usually takes a few seconds.
            </p>
          ) : null}
          <button className="btn-ghost mt-2 w-full" onClick={skipToManual}>
            Skip and enter by hand
          </button>
        </>
      ) : (
        <>
          <button
            onClick={() => fileInput.current?.click()}
            className="card flex w-full flex-col items-center gap-3 border-dashed py-12 text-slate-300"
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            <span className="font-semibold">Take or choose a photo</span>
            <span className="max-w-[16rem] text-center text-xs text-slate-500">
              {working ?? 'Shoot straight down, avoid glare, and keep every tile in frame.'}
            </span>
          </button>

          <Section title="For the best reading" hint="">
            <ul className="card space-y-2 text-sm text-slate-400">
              <li>Spread the hand into one row with no tiles overlapping.</li>
              <li>Put melds in their own group, slightly apart from the concealed tiles.</li>
              <li>Keep flowers and seasons in the shot; they are read separately.</li>
              <li>Shoot from directly above so the faces are not foreshortened.</li>
            </ul>
          </Section>

          <button className="btn-ghost w-full" onClick={skipToManual}>
            Enter the tiles by hand
          </button>
        </>
      )}
    </Screen>
  )
}
