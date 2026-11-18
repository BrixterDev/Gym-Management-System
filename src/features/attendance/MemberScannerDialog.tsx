import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Camera, CameraOff, CheckCircle2, QrCode, ScanLine, LogOut } from 'lucide-react'
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
type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike

function getDetectorCtor(): BarcodeDetectorCtor | null {
  const candidate = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector
  return typeof candidate === 'function' ? candidate : null
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
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
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
    setCameraActive(false)
    setError(null)
    mutation.mutate(trimmed)
  }

  onCodeRef.current = runCode

  useEffect(() => {
    if (!open) {
      setCode('')
      setError(null)
      setResult(null)
      setCameraActive(false)
      setCameraError(null)
      decodingRef.current = false
    }
  }, [open])

  useEffect(() => {
    if (!open || !cameraActive) return
    const detectorCtor = getDetectorCtor()
    let stream: MediaStream | null = null
    let timer: number | undefined
    let cancelled = false

    if (!detectorCtor) {
      setCameraError('Live scanning is not supported by this browser. Enter the code instead.')
      setCameraActive(false)
      return
    }

    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        await video.play()

        const detector = new detectorCtor({ formats: ['qr_code'] })
        timer = window.setInterval(() => {
          if (cancelled || decodingRef.current) return
          const current = videoRef.current
          if (!current || current.readyState < 2) return
          void detector
            .detect(current)
            .then((codes) => {
              const raw = codes[0]?.rawValue?.trim()
              if (!raw || decodingRef.current) return
              decodingRef.current = true
              onCodeRef.current(raw)
            })
            .catch(() => {
              // Ignore transient frame decode errors.
            })
        }, 350)
      } catch {
        if (cancelled) return
        setCameraError(
          'Camera access was blocked. Allow camera permission or enter the member code manually.',
        )
        setCameraActive(false)
      }
    }

    void start()

    return () => {
      cancelled = true
      if (timer) window.clearInterval(timer)
      if (stream) stream.getTracks().forEach((track) => track.stop())
      const video = videoRef.current
      if (video) video.srcObject = null
    }
  }, [open, cameraActive])

  const startAgain = () => {
    decodingRef.current = false
    setResult(null)
    setError(null)
    setCameraActive(true)
  }

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
        {cameraError && <Alert tone="warning">{cameraError}</Alert>}

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
            <div className="flex gap-2">
              <Button
                type="button"
                variant={cameraActive ? 'secondary' : 'outline'}
                className="flex-1"
                onClick={() => {
                  decodingRef.current = false
                  setCameraError(null)
                  setCameraActive((current) => !current)
                }}
              >
                {cameraActive ? (
                  <CameraOff className="size-4" aria-hidden />
                ) : (
                  <Camera className="size-4" aria-hidden />
                )}
                {cameraActive ? 'Stop camera' : 'Scan with camera'}
              </Button>
            </div>

            <div className="relative aspect-square overflow-hidden rounded-xl border border-white/10 bg-slate-950">
              <video
                ref={videoRef}
                playsInline
                muted
                className={`size-full object-cover ${cameraActive ? '' : 'hidden'}`}
              />
              {!cameraActive && (
                <div className="flex size-full flex-col items-center justify-center gap-2 p-6 text-center">
                  <QrCode className="size-10 text-slate-400" aria-hidden />
                  <p className="text-sm text-slate-400">
                    Camera preview appears here. Manual entry always works.
                  </p>
                </div>
              )}
              {cameraActive && (
                <div className="pointer-events-none absolute inset-8 rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(2,6,23,0.35)]" />
              )}
            </div>

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
                autoFocus
              />
            </form>
          </>
        )}

        {result && (
          <Button variant="outline" className="w-full" onClick={startAgain}>
            <LogOut className="size-4 rotate-180" aria-hidden />
            Check in another member
          </Button>
        )}
      </div>
    </Modal>
  )
}
