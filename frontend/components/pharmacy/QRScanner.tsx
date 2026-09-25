'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Camera, CameraOff, ImagePlus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { t as tr } from '@/lib/i18n';

/** Health-card QRs hold a bare token; links to /patient/qr/<token> are accepted too. */
export function extractQrPayload(text: string) {
  const t = text.trim();
  const m = t.match(/\/patient\/qr\/([^/?#\s]+)/);
  return m ? decodeURIComponent(m[1]) : t;
}

interface QRScannerProps {
  onScan: (data: string) => void;
  onError?: (error: string) => void;
  /** Start the camera immediately. */
  isActive: boolean;
  className?: string;
}

/**
 * Camera QR scanner with an image-upload fallback (desktops often have no
 * rear camera). html5-qrcode is loaded lazily so it never runs on the server.
 */
export function QRScanner({ onScan, onError, isActive, className }: QRScannerProps) {
  const reactId = useId().replace(/:/g, '');
  const regionId = `qr-region-${reactId}`;
  const scannerRef = useRef<any>(null);
  const doneRef = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<'idle' | 'starting' | 'running' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [decodingFile, setDecodingFile] = useState(false);

  const stop = useCallback(async () => {
    const s = scannerRef.current;
    scannerRef.current = null;
    if (!s) return;
    try {
      const st = s.getState?.();
      if (st === 2 || st === 3) await s.stop();
      s.clear?.();
    } catch {
      /* already stopped */
    }
  }, []);

  const fail = useCallback(
    (err: unknown) => {
      const raw = typeof err === 'string' ? err : (err as any)?.message || '';
      const msg = /permission|notallowed/i.test(raw)
        ? tr("Camera permission was denied. Allow camera access in the browser, or upload a photo of the QR instead.")
        : /notfound|no camera|requested device not found/i.test(raw)
          ? tr("No camera was found on this device. Upload a photo of the QR instead.")
          : tr("The camera could not start. Upload a photo of the QR instead.");
      setState('error');
      setMessage(msg);
      onError?.(msg);
    },
    [onError]
  );

  const start = useCallback(async () => {
    doneRef.current = false;
    setState('starting');
    setMessage(null);
    try {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
      const el = document.getElementById(regionId);
      if (!el) return;
      el.innerHTML = '';
      const scanner = new Html5Qrcode(regionId, { formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE], verbose: false });
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 20, qrbox: (w: number, h: number) => { const s = Math.floor(Math.min(w, h) * 0.7); return { width: s, height: s }; } },
        (text: string) => {
          if (doneRef.current) return;
          doneRef.current = true;
          stop();
          setState('idle');
          onScan(extractQrPayload(text));
        },
        () => {}
      );
      setState('running');
    } catch (err) {
      await stop();
      fail(err);
    }
  }, [regionId, onScan, stop, fail]);

  useEffect(() => {
    if (isActive) start();
    return () => {
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  const decodeFile = async (file: File) => {
    setDecodingFile(true);
    setMessage(null);
    try {
      await stop();
      const { Html5Qrcode } = await import('html5-qrcode');
      const tmpId = `${regionId}-file`;
      let holder = document.getElementById(tmpId);
      if (!holder) {
        holder = document.createElement('div');
        holder.id = tmpId;
        holder.style.display = 'none';
        document.body.appendChild(holder);
      }
      const reader = new Html5Qrcode(tmpId, { verbose: false } as any);
      const text = await reader.scanFile(file, false);
      reader.clear();
      setState('idle');
      onScan(extractQrPayload(text));
    } catch {
      setMessage(tr("No QR code was found in that image. Try a sharper, well-lit photo."));
    } finally {
      setDecodingFile(false);
    }
  };

  return (
    <div className={cn('space-y-3', className)}>
      <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-2xl border bg-foreground/[0.04]">
        <div id={regionId} className="h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover" />
        {state !== 'running' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            {state === 'starting' ? (
              <>
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <p className="text-[13px] text-muted-foreground">{tr("Starting camera…")}</p>
              </>
            ) : (
              <>
                <span className="flex h-12 w-12 items-center justify-center rounded-xl border bg-card text-muted-foreground">
                  {state === 'error' ? <CameraOff className="h-5 w-5" /> : <Camera className="h-5 w-5" />}
                </span>
                <p className="max-w-[240px] text-[13px] text-muted-foreground">{message || tr("Point the camera at the QR code on the health card or prescription.")}</p>
                <button type="button" onClick={start} className="inline-flex h-9 items-center gap-2 rounded-[10px] bg-primary px-3.5 text-[13px] font-medium text-primary-foreground shadow-button">
                  <Camera className="h-4 w-4" /> {state === 'error' ? tr("Try camera again") : tr("Start camera")}
                </button>
              </>
            )}
          </div>
        )}
        {state === 'running' && (
          <>
            <div className="pointer-events-none absolute inset-[15%] rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
            <button type="button" onClick={() => { stop(); setState('idle'); }} className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur">{tr("Stop camera")}</button>
          </>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) decodeFile(f); }} />
      <button type="button" onClick={() => fileRef.current?.click()} disabled={decodingFile} className="mx-auto flex h-9 items-center gap-2 rounded-[10px] border bg-card px-3.5 text-[13px] font-medium shadow-sm hover:bg-muted disabled:opacity-60">
        {decodingFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}{' '}{tr("Upload a photo of the QR")}</button>
      {message && state !== 'error' && <p className="text-center text-xs text-destructive">{message}</p>}
    </div>
  );
}
