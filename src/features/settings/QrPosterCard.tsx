import { useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Download, Printer } from 'lucide-react'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'

const DOWNLOAD_SIZE = 1024

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function posterHtml({
  title,
  url,
  steps,
  svgMarkup,
}: {
  title: string
  url: string
  steps: string[]
  svgMarkup: string
}) {
  const stepItems = steps.map((step) => `<li>${escapeHtml(step)}</li>`).join('')
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      @page { margin: 18mm; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
        color: #0f172a;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .poster {
        max-width: 560px;
        margin: 0 auto;
        padding: 32px;
        border: 1px solid #e2e8f0;
        border-radius: 20px;
        text-align: center;
      }
      .kicker {
        margin: 0;
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: #64748b;
      }
      h1 { margin: 8px 0 4px; font-size: 30px; line-height: 1.2; }
      .lead { margin: 0 0 24px; font-size: 14px; line-height: 1.55; color: #475569; }
      .qr {
        display: inline-block;
        padding: 16px;
        border: 1px solid #e2e8f0;
        border-radius: 16px;
        background: #ffffff;
      }
      .qr svg { display: block; width: 240px; height: 240px; }
      .url { margin: 18px 0 0; font-size: 13px; color: #334155; word-break: break-all; }
      .steps { max-width: 400px; margin: 20px auto 0; text-align: left; font-size: 13px; line-height: 1.6; color: #475569; }
      .steps p { margin: 0; font-weight: 600; color: #0f172a; }
      .steps ol { margin: 8px 0 0; padding-left: 18px; }
      .footer { margin: 24px 0 0; font-size: 11px; color: #94a3b8; }
    </style>
  </head>
  <body>
    <main class="poster">
      <p class="kicker">GymTrack</p>
      <h1>${escapeHtml(title)}</h1>
      <p class="lead">Scan the QR code with your phone camera.</p>
      <div class="qr">${svgMarkup}</div>
      <p class="url">${escapeHtml(url)}</p>
      <div class="steps">
        <p>How it works</p>
        <ol>${stepItems}</ol>
      </div>
      <p class="footer">Keep this link private to your gym. Check-in is verified on the server.</p>
    </main>
  </body>
</html>`
}

export function QrPosterCard({
  title,
  description,
  url,
  isFallback,
  fileName,
  steps,
}: {
  title: string
  description: string
  url: string
  isFallback: boolean
  fileName: string
  steps: string[]
}) {
  const toast = useToast()
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  const getSvgMarkup = () => {
    const svg = wrapperRef.current?.querySelector('svg')
    if (!svg) {
      toast.error('QR code is not ready', 'Wait a moment and try again.')
      return null
    }
    const clone = svg.cloneNode(true) as SVGSVGElement
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    return new XMLSerializer().serializeToString(clone)
  }

  const handlePrint = () => {
    const svgMarkup = getSvgMarkup()
    if (!svgMarkup) return

    const frame = document.createElement('iframe')
    frame.setAttribute('aria-hidden', 'true')
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;'
    document.body.appendChild(frame)

    const frameDocument = frame.contentDocument
    if (!frameDocument) {
      frame.remove()
      toast.error('Could not open the print dialog', 'Try a different browser.')
      return
    }

    frameDocument.open()
    frameDocument.write(posterHtml({ title, url, steps, svgMarkup }))
    frameDocument.close()

    window.setTimeout(() => {
      frame.contentWindow?.focus()
      frame.contentWindow?.print()
      window.setTimeout(() => frame.remove(), 1500)
    }, 250)
  }

  const handleDownload = () => {
    const svgMarkup = getSvgMarkup()
    if (!svgMarkup) return

    const objectUrl = URL.createObjectURL(
      new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' }),
    )
    const image = new Image()

    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = DOWNLOAD_SIZE
      canvas.height = DOWNLOAD_SIZE
      const context = canvas.getContext('2d')
      if (!context) {
        URL.revokeObjectURL(objectUrl)
        toast.error('Could not create the image')
        return
      }
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, DOWNLOAD_SIZE, DOWNLOAD_SIZE)
      context.drawImage(image, 0, 0, DOWNLOAD_SIZE, DOWNLOAD_SIZE)
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(objectUrl)
        if (!blob) {
          toast.error('Could not create the image')
          return
        }
        const downloadUrl = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = downloadUrl
        link.download = `${fileName}.png`
        link.click()
        window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000)
        toast.success('QR code downloaded', `${fileName}.png`)
      }, 'image/png')
    }

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      toast.error('Could not create the image')
    }

    image.src = objectUrl
  }

  return (
    <Card>
      <CardHeader title={title} description={description} />
      <CardBody className="flex flex-col items-center">
        <div ref={wrapperRef} className="inline-flex rounded-2xl border border-white/15 bg-white p-4">
          <QRCodeSVG
            value={url}
            size={220}
            level="M"
            marginSize={2}
            bgColor="#ffffff"
            fgColor="#0f172a"
            title={`${title} QR code`}
          />
        </div>

        <p className="glass-inset mt-4 w-full break-all rounded-xl px-3 py-2 text-center font-mono text-xs text-slate-300">
          {url}
        </p>

        {isFallback ? (
          <p className="mt-2 text-center text-xs text-slate-500">
            Using this site's URL. Set a custom link above to encode a different address.
          </p>
        ) : (
          <p className="mt-2 text-center text-xs text-slate-500">
            Encodes the link in the field above. Save changes to keep it.
          </p>
        )}

        <div className="mt-4 flex w-full flex-col gap-2 sm:flex-row">
          <Button className="flex-1" onClick={handlePrint}>
            <Printer className="size-4" aria-hidden />
            Print poster
          </Button>
          <Button className="flex-1" variant="outline" onClick={handleDownload}>
            <Download className="size-4" aria-hidden />
            Download PNG
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}
