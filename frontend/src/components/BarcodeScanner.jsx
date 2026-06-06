import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, X, FlipHorizontal2 } from "lucide-react";

const ELEMENT_ID = "pb-camera-scanner-region";

const FORMATS = [
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.CODE_93,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.ITF,
  Html5QrcodeSupportedFormats.CODABAR,
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.DATA_MATRIX,
];

/**
 * Mobile / desktop camera barcode scanner.
 * Renders a Camera icon button; on click opens a modal with the live viewfinder.
 * Calls onDetected(code) with the first successful decode then auto-closes.
 *
 * Props:
 *   - onDetected(code): called when a barcode is decoded
 *   - label: optional button label (defaults to "Camera")
 *   - testId: optional data-testid root
 *   - buttonClassName: optional classes for the trigger button
 *   - variant, size: passed to <Button>
 */
export default function BarcodeScanner({
  onDetected,
  label = "Camera",
  testId = "barcode-scanner",
  buttonClassName = "",
  variant = "outline",
  size = "default",
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [activeCamId, setActiveCamId] = useState(null);
  const html5QrRef = useRef(null);
  const startedRef = useRef(false);

  const stop = async () => {
    if (html5QrRef.current && startedRef.current) {
      try {
        await html5QrRef.current.stop();
      } catch {}
      try {
        await html5QrRef.current.clear();
      } catch {}
      startedRef.current = false;
    }
  };

  const start = async (camId) => {
    if (!html5QrRef.current) return;
    setError(null);
    try {
      await html5QrRef.current.start(
        camId || { facingMode: { ideal: "environment" } },
        {
          fps: 12,
          qrbox: (vw, vh) => {
            const m = Math.min(vw, vh);
            return { width: Math.floor(m * 0.85), height: Math.floor(m * 0.55) };
          },
          aspectRatio: 1.6,
          formatsToSupport: FORMATS,
        },
        (decodedText) => {
          // Success — fire callback and close
          onDetected(decodedText);
          setOpen(false);
        },
        // ignore per-frame "not found" errors
        () => {}
      );
      startedRef.current = true;
    } catch (e) {
      setError(
        e?.message ||
          "Unable to start camera. Grant camera permission and use a secure (https) connection."
      );
    }
  };

  // Enumerate cameras + start when modal opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      html5QrRef.current = new Html5Qrcode(ELEMENT_ID, { formatsToSupport: FORMATS });
      try {
        const devs = await Html5Qrcode.getCameras();
        if (cancelled) return;
        setCameras(devs);
        // Prefer back camera if found
        const back = devs.find((d) => /back|rear|environment/i.test(d.label));
        const startCam = back?.id || devs[0]?.id || null;
        setActiveCamId(startCam);
        await start(startCam);
      } catch (e) {
        if (cancelled) return;
        setError(
          e?.message ||
            "Cannot access cameras. Check permission and that you're on a secure (https) URL."
        );
      }
    })();
    return () => {
      cancelled = true;
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const switchCamera = async () => {
    if (!cameras.length) return;
    const idx = cameras.findIndex((c) => c.id === activeCamId);
    const next = cameras[(idx + 1) % cameras.length];
    setActiveCamId(next.id);
    await stop();
    html5QrRef.current = new Html5Qrcode(ELEMENT_ID, { formatsToSupport: FORMATS });
    await start(next.id);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant={variant}
          size={size}
          className={buttonClassName}
          data-testid={`${testId}-open`}
        >
          <Camera className="w-4 h-4 mr-1" /> {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden" data-testid={`${testId}-dialog`}>
        <DialogHeader className="px-4 py-3 border-b border-slate-200">
          <DialogTitle className="text-base">Scan with Camera</DialogTitle>
          <DialogDescription className="text-xs">
            Hold the barcode steady inside the frame
          </DialogDescription>
        </DialogHeader>

        <div className="relative bg-black">
          <div id={ELEMENT_ID} className="w-full" style={{ minHeight: 280 }} />
          {error && (
            <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-white bg-black/80">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-white">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={switchCamera}
            disabled={cameras.length < 2}
            data-testid={`${testId}-switch`}
          >
            <FlipHorizontal2 className="w-4 h-4 mr-1" /> Switch camera
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setOpen(false)}
            data-testid={`${testId}-close`}
          >
            <X className="w-4 h-4 mr-1" /> Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
