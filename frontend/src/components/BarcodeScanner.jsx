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

const waitForElement = (id, maxTries = 40) =>
  new Promise((resolve) => {
    let tries = 0;
    const tick = () => {
      const el = document.getElementById(id);
      if (el) return resolve(el);
      if (++tries >= maxTries) return resolve(null);
      requestAnimationFrame(tick);
    };
    tick();
  });

/**
 * Mobile / desktop camera barcode scanner.
 * Opens a dialog with a live viewfinder. Calls onDetected(code) with the first
 * successful decode and then closes. Robust against open / close / re-open cycles.
 */
export default function BarcodeScanner({
  onDetected,
  label = "Camera",
  testId = "barcode-scanner",
  buttonClassName = "",
  variant = "outline",
  size = "default",
}) {
  // Per-instance unique DOM id (multiple scanners can live on the same page).
  const reactId = useId().replace(/:/g, "");
  const elementId = `pb-cam-${reactId}`;

  const [open, setOpen] = useState(false);
  const [error, setError] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [activeCamId, setActiveCamId] = useState(null);

  // We do NOT track readiness in state — the effect itself waits for the element.
  const scannerRef = useRef(null); // current Html5Qrcode instance
  const cancelRef = useRef(false); // session-level cancel flag

  const teardown = async () => {
    const s = scannerRef.current;
    scannerRef.current = null;
    if (!s) return;
    try {
      // stop() throws if it was never started — ignore.
      await s.stop();
    } catch {}
    try {
      await s.clear();
    } catch {}
  };

  const startScanner = async (scanner, camId) => {
    await scanner.start(
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
      async (decodedText) => {
        // Hand the value to the parent and immediately tear down so the next
        // open is a clean slate. Closing the dialog will also trigger teardown,
        // but we do it first to avoid races during the very next open.
        try {
          onDetected(decodedText);
        } finally {
          setOpen(false);
        }
      },
      () => {} // per-frame "not found" events — ignore
    );
  };

  // Main lifecycle: when the dialog opens, find the (just-mounted) target div,
  // create a fresh Html5Qrcode instance, enumerate cameras and start.
  useEffect(() => {
    if (!open) return;
    cancelRef.current = false;
    setError(null);

    (async () => {
      const target = await waitForElement(elementId);
      if (cancelRef.current) return;
      if (!target) {
        setError("Camera UI failed to attach.");
        return;
      }

      // Safety: if a stale scanner is still around for any reason, wipe it.
      if (scannerRef.current) {
        try { await scannerRef.current.stop(); } catch {}
        try { await scannerRef.current.clear(); } catch {}
        scannerRef.current = null;
      }
      // The div might have been left non-empty by a previous library teardown
      // in an edge case — make sure it's pristine before constructing.
      target.innerHTML = "";

      let scanner;
      try {
        scanner = new Html5Qrcode(elementId, { formatsToSupport: FORMATS });
      } catch (e) {
        setError(e?.message || "Camera UI failed to attach.");
        return;
      }
      if (cancelRef.current) {
        try { await scanner.clear(); } catch {}
        return;
      }
      scannerRef.current = scanner;

      let devs = [];
      try {
        devs = await Html5Qrcode.getCameras();
      } catch {
        /* permission may not be granted yet — facingMode fallback will be used */
      }
      if (cancelRef.current) return;
      setCameras(devs || []);
      const back = (devs || []).find((d) => /back|rear|environment/i.test(d.label));
      const startCam = back?.id || devs?.[0]?.id || null;
      setActiveCamId(startCam);

      try {
        await startScanner(scanner, startCam);
      } catch (e) {
        if (!cancelRef.current) {
          setError(
            e?.message ||
              "Unable to start camera. Grant camera permission and use a secure (https) connection."
          );
        }
      }
    })();

    return () => {
      cancelRef.current = true;
      teardown();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const switchCamera = async () => {
    if (!cameras.length) return;
    const idx = cameras.findIndex((c) => c.id === activeCamId);
    const next = cameras[(idx + 1) % cameras.length];
    setActiveCamId(next.id);
    const s = scannerRef.current;
    if (!s) return;
    try { await s.stop(); } catch {}
    try { await startScanner(s, next.id); } catch (e) {
      setError(e?.message || "Failed to switch camera");
    }
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
          <div id={elementId} className="w-full" style={{ minHeight: 280 }} />
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
