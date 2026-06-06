import React, { useEffect, useRef, useState, useId } from "react";
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
 * Opens a modal with a live viewfinder; calls onDetected(code) with the first
 * successful decode, then auto-closes.
 */
export default function BarcodeScanner({
  onDetected,
  label = "Camera",
  testId = "barcode-scanner",
  buttonClassName = "",
  variant = "outline",
  size = "default",
}) {
  // Unique DOM id per instance — multiple scanners can live on the same page.
  const reactId = useId().replace(/:/g, "");
  const elementId = `pb-cam-${reactId}`;

  const [open, setOpen] = useState(false);
  const [error, setError] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [activeCamId, setActiveCamId] = useState(null);
  const [ready, setReady] = useState(false); // true once the target div exists in DOM
  const html5QrRef = useRef(null);
  const startedRef = useRef(false);
  const containerRef = useRef(null);

  const stop = async () => {
    if (html5QrRef.current && startedRef.current) {
      try {
        await html5QrRef.current.stop();
      } catch {}
      startedRef.current = false;
    }
    if (html5QrRef.current) {
      try {
        await html5QrRef.current.clear();
      } catch {}
      html5QrRef.current = null;
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
          onDetected(decodedText);
          setOpen(false);
        },
        () => {} // per-frame "not found" errors — ignore
      );
      startedRef.current = true;
    } catch (e) {
      setError(
        e?.message ||
          "Unable to start camera. Grant camera permission and use a secure (https) connection."
      );
    }
  };

  // Initialize once the dialog has rendered the target div in the DOM.
  useEffect(() => {
    if (!open || !ready) return;
    let cancelled = false;

    (async () => {
      try {
        if (!document.getElementById(elementId)) {
          setError("Camera UI failed to attach.");
          return;
        }
        html5QrRef.current = new Html5Qrcode(elementId, { formatsToSupport: FORMATS });

        let devs = [];
        try {
          devs = await Html5Qrcode.getCameras();
        } catch (e) {
          // some browsers throw if no permission yet — we'll fall back to facingMode
        }
        if (cancelled) return;
        setCameras(devs || []);
        const back = (devs || []).find((d) => /back|rear|environment/i.test(d.label));
        const startCam = back?.id || devs?.[0]?.id || null;
        setActiveCamId(startCam);
        await start(startCam);
      } catch (e) {
        if (cancelled) return;
        setError(
          e?.message ||
            "Cannot access the camera. Check permissions and a secure (https) URL."
        );
      }
    })();

    return () => {
      cancelled = true;
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ready]);

  // Reset state whenever the dialog closes
  useEffect(() => {
    if (!open) {
      setReady(false);
      setError(null);
      setCameras([]);
      setActiveCamId(null);
    }
  }, [open]);

  const switchCamera = async () => {
    if (!cameras.length) return;
    const idx = cameras.findIndex((c) => c.id === activeCamId);
    const next = cameras[(idx + 1) % cameras.length];
    setActiveCamId(next.id);
    await stop();
    if (!document.getElementById(elementId)) return;
    html5QrRef.current = new Html5Qrcode(elementId, { formatsToSupport: FORMATS });
    await start(next.id);
  };

  // Callback ref runs the moment React attaches the div to the DOM.
  const attachRef = (el) => {
    containerRef.current = el;
    if (el && !ready) setReady(true);
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
          <div id={elementId} ref={attachRef} className="w-full" style={{ minHeight: 280 }} />
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
