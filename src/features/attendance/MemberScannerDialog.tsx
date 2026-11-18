import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Camera,
  CameraOff,
  CheckCircle2,
  QrCode,
  RefreshCw,
  ScanLine,
  LogOut,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Alert } from '@/components/ui/Feedback'
import { Badge } from '@/components/ui/Badge'
import { formatTimeIn } from '@/lib/utils'
import type { ToggleAttendanceResult } from '@/types/database'
import { attendanceErrorMessage, toggleAttendance } from './attendanceApi'

type BarcodeDetectorLike = {
  detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]>
}
type BarcodeDetectorCtor = {
  new (options?: { formats?: string[] }): BarcodeDetectorLike
  getSupportedFormats?: () => Promise<string[]>
}

type CameraState = 'idle' | 'starting' | 'active' | 'error'

type TorchCapabilities = MediaTrackCapabilities & { torch?: boolean }

function getDetectorCtor(): BarcodeDetectorCtor | null {
  const candidate = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector
  return typeof candidate === 'function' ? candidate : null
}

function cameraErrorMessage(error: unknown): string {
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return 'The camera only works over HTTPS. Open this site using its secure https:// address.'
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return 'This browser cannot access the camera. Enter the member code manually or try another browser.'
  }
  const name = error instanceof DOMException ? error.name : ''
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
    return 'Camera permission was blocked. Allow camera access for this site in your browser settings, then tap Retry camera.'
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'No camera was found on this device. You can still enter the member code manually.'
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'The camera is already in use by another app. Close it and tap Retry camera.'
  }
  if (name === 'OverconstrainedError') {
    return 'The camera could not start with the requested settings. Tap Retry camera.'
  }
  return 'The camera could not start. Tap Retry camera, or enter the member code manually.'
}

async function openCameraStream(): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    })
  } catch (error) {
    if (error instanceof DOMException && (error.name === 'OverconstrainedError' || error.name === 'TypeError')) {
      return navigator.mediaDevices.getUserMedia({ audio: false, video: true })
    }
    throw error
  }
}

export function MemberScannerDialog({
  open,
  onClose,
  timeZone,
}: {
  open: boolean
  onClose: () => void
  timeZone?: string
}) {
  const queryClient = useQueryClient()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ToggleAttendanceResult | null>(null)
  const [cameraState, setCameraState] = useState<CameraState>('idle')
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [cameraOn, setCameraOn] = useState(false)
  const [cameraSession, setCameraSession] = useState(0)
  const [torchOn, setTorchOn] = useState(false)
  const [torchAvailable, setTorchAvailable] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const trackRef = useRef<MediaStreamTrack | null>(null)
  const onCodeRef = useRef<(value: string) => void>(() => {})
  const decodingRef = useRef(false)

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['attendance'] })
    queryClient.invalidateQueries({ queryKey: ['attendance-stats'] })
    queryClient.invalidateQueries({ queryKey: ['my-open-session'] })
    queryClient.invalidateQueries({ queryKey: ['my-attendance'] })
    queryClient.invalidateQueries({ queryKey: ['my-membership-state'] })
  }

  const mutation = useMutation({
    mutationFn: (value: string) => toggleAttendance(value),
    onSuccess: (row) => {
      setResult(row)
      setCode('')
      setError(null)
      setCameraError(null)
      setCameraOn(false)
      setCameraState('idle')
      if (typeof navigator.vibrate === 'function') navigator.vibrate(60)
      invalidate()
    },
    onError: (mutationError) => {
      setError(attendanceErrorMessage(mutationError))
      decodingRef.current = false
    },
  })

  const runCode = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) {
      setError('Enter or scan a member QR code.')
      decodingRef.current = false
      return
    }
    setCameraOn(false)
    setCameraState('idle')
    setError(null)
    mutation.mutate(trimmed)
  }

  useEffect(() => {
    onCodeRef.current = runCode
  })

  // Every time the dialog opens, reset state and start the camera automatically.
  useEffect(() => {
    if (!open) {
      setCode('')
      setError(null)
      setResult(null)
      setCameraOn(false)
      setCameraState('idle')
      setCameraError(null)
      setTorchOn(false)
      setTorchAvailable(false)
      decodingRef.current = false
      return
    }
    setCameraError(null)
    setTorchOn(false)
    setTorchAvailable(false)
    decodingRef.current = false
    setCameraOn(true)
  }, [open])

  // Stop the camera when the tab is hidden so the phone can release it.
  useEffect(() => {
    if (!open) return
    const onVisibility = () => {
      if (document.hidden) {
        setCameraOn(false)
        setCameraState('idle')
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [open])

  useEffect(() => {
    if (!open || !cameraOn) return

    let cancelled = false
    let stream: MediaStream | null = null
    let timer: number | undefined
    let detector: BarcodeDetectorLike | null = null
    let jsQrDecode: ((data: Uint8ClampedArray, width: number, height: number, options?: { inversionAttempts?: string }) => { data: string } | null) | null = null
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d', { willReadFrequently: true })
    const videoEl = videoRef.current

    setCameraState('starting')
    setCameraError(null)

    const handleCode = (raw: string | undefined) => {
      const value = raw?.trim()
      if (!value || cancelled || decodingRef.current) return
      decodingRef.current = true
      onCodeRef.current(value)
    }

    const decode = () => {
      if (cancelled || decodingRef.current) return
      const video = videoRef.current
      if (!video || video.readyState < 2 || !video.videoWidth) return

      if (detector) {
        void detector
          .detect(video)
          .then((codes) => handleCode(codes[0]?.rawValue))
          .catch(() => {
            // Ignore transient frame decode errors.
          })
        return
      }

      if (!jsQrDecode || !context) return
      try {
        // Decode a downscaled frame to keep phones responsive.
        const maxWidth = 640
        const scale = Math.min(1, maxWidth / video.videoWidth)
        canvas.width = Math.round(video.videoWidth * scale)
        canvas.height = Math.round(video.videoHeight * scale)
        context.drawImage(video, 0, 0, canvas.width, canvas.height)
        const image = context.getImageData(0, 0, canvas.width, canvas.height)
        const found = jsQrDecode(image.data, image.width, image.height, {
          inversionAttempts: 'dontInvert',
        })
        if (found?.data) handleCode(found.data)
      } catch {
        // Ignore transient frame decode errors.
      }
    }

    const start = async () => {
      try {
        const nativeCtor = getDetectorCtor()
        let useNative = false
        if (nativeCtor) {
          try {
            const formats = await nativeCtor.getSupportedFormats?.()
            useNative = !formats || formats.includes('qr_code')
          } catch {
            useNative = true
          }
        }

        if (!useNative) {
          const module = await import('jsqr')
          jsQrDecode = module.default as typeof jsQrDecode
        }

        stream = await openCameraStream()
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        const video = videoRef.current
        if (!video) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        video.srcObject = stream
        await video.play()

        const track = stream.getVideoTracks()[0] ?? null
        trackRef.current = track
        if (track) {
          try {
            const capabilities = track.getCapabilities() as TorchCapabilities
            setTorchAvailable(Boolean(capabilities?.torch))
          } catch {
            setTorchAvailable(false)
          }
        }

        if (useNative && nativeCtor) {
          detector = new nativeCtor({ formats: ['qr_code'] })
        }

        setCameraState('active')
        timer = window.setInterval(decode, 280)
      } catch (startError) {
        if (cancelled) return
        setCameraOn(false)
        setCameraState('error')
        setCameraError(cameraErrorMessage(startError))
      }
    }

    void start()

    return () => {
      cancelled = true
      if (timer) window.clearInterval(timer)
      if (stream) stream.getTracks().forEach((track) => track.stop())
      trackRef.current = null
      if (videoEl) videoEl.srcObject = null
    }
  }, [open, cameraOn, cameraSession])

  const startCamera = () => {
    decodingRef.current = false
    setResult(null)
    setError(null)
    setCameraError(null)
    setTorchOn(false)
    setCameraSession((value) => value + 1)
    setCameraOn(true)
  }

  const stopCamera = () => {
    setCameraOn(false)
    setCameraState('idle')
    setTorchOn(false)
  }

  const toggleTorch = async () => {
    const track = trackRef.current
    if (!track) return
    const next = !torchOn
    try {
      await track.applyConstraints({
        advanced: [{ torch: next } as unknown as MediaTrackConstraintSet],
      })
      setTorchOn(next)
    } catch {
      setTorchAvailable(false)
    }
  }

  const scanning = cameraState === 'starting' || cameraState === 'active'

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!mutation.isPending) onClose()
      }}
      title="Check in / out member"
      description="Scan the member's QR code, or type their member code or QR token."
      footer={
        result ? (
          <Button onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="member-scan-form"
              loading={mutation.isPending}
              disabled={!code.trim()}
            >
              <ScanLine className="size-4" aria-hidden />
              Submit code
            </Button>
          </>
        )
      }
    >
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        {mutation.isPending && (
          <Alert tone="info">Looking up this code and updating attendance…</Alert>
        )}
        {cameraError && (
          <Alert tone="warning" title="Camera unavailable">
            {cameraError}
          </Alert>
        )}

        {result ? (
          <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-400" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-emerald-200">
                  {result.action === 'checked_in' ? 'Checked in' : 'Checked out'}:{' '}
                  {result.display_name ?? 'Unnamed member'}
                </p>
                <p className="mt-0.5 text-xs text-emerald-300">
                  {result.member_code ?? 'No member code'} ·{' '}
                  {formatTimeIn(result.occurred_at, timeZone)}
                </p>
              </div>
              <Badge tone={result.action === 'checked_in' ? 'green' : 'slate'} dot>
                {result.action === 'checked_in' ? 'In gym' : 'Completed'}
              </Badge>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={scanning ? 'secondary' : 'outline'}
                className="min-w-0 flex-1"
                onClick={scanning ? stopCamera : startCamera}
              >
                {scanning ? (
                  <CameraOff className="size-4" aria-hidden />
                ) : cameraError ? (
                  <RefreshCw className="size-4" aria-hidden />
                ) : (
                  <Camera className="size-4" aria-hidden />
                )}
                {scanning ? 'Stop camera' : cameraError ? 'Retry camera' : 'Start camera'}
              </Button>
            </div>

            <div
              className="relative aspect-square overflow-hidden rounded-xl border border-white/10 bg-slate-950"
              aria-live="polite"
            >
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`size-full object-cover ${scanning ? '' : 'hidden'}`}
              />

              {cameraState === 'starting' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950/70 p-6 text-center">
                  <span className="size-7 animate-spin rounded-full border-2 border-white/20 border-t-brand-400" />
                  <p className="text-sm text-slate-300">Starting camera…</p>
                  <p className="text-xs text-slate-500">Allow camera access when your browser asks.</p>
                </div>
              )}

              {!scanning && (
                <div className="flex size-full flex-col items-center justify-center gap-2 p-6 text-center">
                  <QrCode className="size-10 text-slate-400" aria-hidden />
                  <p className="text-sm text-slate-400">
                    {cameraError
                      ? 'Fix the camera issue and tap Retry camera.'
                      : 'Camera is off. Tap Start camera, or enter the code below.'}
                  </p>
                </div>
              )}

              {cameraState === 'active' && (
                <>
                  <div className="pointer-events-none absolute inset-8 rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(2,6,23,0.35)]" />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-slate-950/80 to-transparent px-3 pb-3 pt-8">
                    <p className="text-center text-xs font-medium text-slate-200">
                      Point the camera at the member's QR code
                    </p>
                  </div>
                </>
              )}

              {cameraState === 'active' && torchAvailable && (
                <button
                  type="button"
                  onClick={() => void toggleTorch()}
                  className={`absolute right-3 top-3 flex size-9 items-center justify-center rounded-full border backdrop-blur transition-colors ${
                    torchOn
                      ? 'border-amber-300/50 bg-amber-400/20 text-amber-200'
                      : 'border-white/20 bg-slate-950/60 text-slate-200 hover:bg-slate-900/80'
                  }`}
                  aria-label={torchOn ? 'Turn off flashlight' : 'Turn on flashlight'}
                  aria-pressed={torchOn}
                >
                  <Zap className="size-4" aria-hidden />
                </button>
              )}
            </div>

            <p className="text-xs leading-relaxed text-slate-500">
              Camera frames are decoded on this device and are never uploaded. If the camera cannot
              start, the member code below always works.
            </p>

            <form
              id="member-scan-form"
              onSubmit={(event) => {
                event.preventDefault()
                runCode(code)
              }}
            >
              <Input
                label="QR token or member code"
                placeholder="e.g. GT-0001 or a scanned token"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                autoComplete="off"
                autoCapitalize="characters"
                enterKeyHint="go"
              />
            </form>
          </>
        )}

        {result && (
          <Button variant="outline" className="w-full" onClick={startCamera}>
            <LogOut className="size-4 rotate-180" aria-hidden />
            Check in another member
          </Button>
        )}
      </div>
    </Modal>
  )
}
