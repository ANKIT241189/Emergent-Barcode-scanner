import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { API } from "@/context/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, AlertTriangle, ArrowLeft, RotateCcw, ScanLine } from "lucide-react";
import BarcodeScanner from "@/components/BarcodeScanner";

const STEPS = [
  { id: 1, label: "Scan Machine" },
  { id: 2, label: "Select Process" },
  { id: 3, label: "Scan Batches" },
];

function StepBar({ current }) {
  return (
    <div className="flex items-center gap-3 mb-6" data-testid="step-progress">
      {STEPS.map((s, i) => (
        <React.Fragment key={s.id}>
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium border transition-colors ${
              current === s.id
                ? "bg-[#1e40af] text-white border-[#1e40af]"
                : current > s.id
                ? "bg-green-100 text-green-800 border-green-200"
                : "bg-white text-slate-500 border-slate-200"
            }`}
            data-testid={`step-indicator-${s.id}`}
          >
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                current === s.id
                  ? "bg-white text-[#1e40af]"
                  : current > s.id
                  ? "bg-green-600 text-white"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {current > s.id ? <Check className="w-3.5 h-3.5" /> : s.id}
            </span>
            {s.label}
          </div>
          {i < STEPS.length - 1 && <div className="h-px flex-1 bg-slate-200" />}
        </React.Fragment>
      ))}
    </div>
  );
}

export default function ScanPage() {
  const [step, setStep] = useState(1);
  const [machineInput, setMachineInput] = useState("");
  const [machine, setMachine] = useState(null);
  const [processes, setProcesses] = useState([]);
  const [selectedProcessId, setSelectedProcessId] = useState(null);
  const [session, setSession] = useState(null);
  const [batchInput, setBatchInput] = useState("");
  const [scans, setScans] = useState([]);
  const [busy, setBusy] = useState(false);

  const machineRef = useRef(null);
  const batchRef = useRef(null);

  useEffect(() => {
    if (step === 1) machineRef.current?.focus();
    if (step === 3) batchRef.current?.focus();
  }, [step]);

  const reset = () => {
    setStep(1);
    setMachineInput("");
    setMachine(null);
    setProcesses([]);
    setSelectedProcessId(null);
    setSession(null);
    setBatchInput("");
    setScans([]);
  };

  const lookupMachine = async (e) => {
    e.preventDefault();
    const code = machineInput.trim();
    if (!code) return;
    setBusy(true);
    try {
      const r = await axios.get(`${API}/masters/machines/lookup/${encodeURIComponent(code)}`);
      setMachine(r.data.machine);
      setProcesses(r.data.processes || []);
      if ((r.data.processes || []).length === 1) {
        setSelectedProcessId(r.data.processes[0].id);
      } else {
        setSelectedProcessId(null);
      }
      setStep(2);
      toast.success(`Machine ${r.data.machine.machine_no} loaded`);
    } catch (err) {
      const msg = err?.response?.data?.error || "Machine not found";
      toast.error(msg);
      setMachineInput("");
      machineRef.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  const startSession = async () => {
    if (!selectedProcessId) {
      toast.error("Please select a process");
      return;
    }
    setBusy(true);
    try {
      const r = await axios.post(`${API}/scans/session`, {
        machine_id: machine.id,
        process_type_id: selectedProcessId,
      });
      setSession(r.data);
      setScans([]);
      setStep(3);
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to start session");
    } finally {
      setBusy(false);
    }
  };

  const recordScan = async (e, codeOverride) => {
    if (e?.preventDefault) e.preventDefault();
    const code = (codeOverride ?? batchInput).trim();
    if (!code || !session) return;
    setBusy(true);
    try {
      const r = await axios.post(`${API}/scans/record`, {
        session_uuid: session.session_uuid,
        batch_barcode: code,
      });
      const entry = {
        id: r.data.id,
        batch_barcode: code,
        scanned_at: r.data.record.scanned_at,
        scan_time: r.data.record.scan_time,
        duplicate_today: r.data.duplicate_today,
        previous_scan: r.data.previous_scan,
      };
      setScans((prev) => [entry, ...prev]);
      if (r.data.duplicate_today) {
        toast.warning(`Warning: ${code} already scanned today`);
      } else {
        toast.success(`Recorded ${code}`);
      }
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to record scan");
    } finally {
      setBatchInput("");
      setBusy(false);
      setTimeout(() => batchRef.current?.focus(), 0);
    }
  };

  const selectedProcess = processes.find((p) => p.id === selectedProcessId);

  return (
    <div data-testid="scan-page">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold text-slate-900">Scan Workflow</h1>
        <p className="text-sm text-slate-500">Scan machine, pick a process, then scan batches</p>
      </div>

      <StepBar current={step} />

      {step === 1 && (
        <Card data-testid="step-1-card" className="border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ScanLine className="w-5 h-5 text-[#1e40af]" />
              Step 1 — Scan Machine Barcode
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={lookupMachine} className="space-y-3">
              <Label htmlFor="machine-barcode">Machine Barcode</Label>
              <div className="flex gap-2">
                <Input
                  id="machine-barcode"
                  data-testid="machine-barcode-input"
                  ref={machineRef}
                  value={machineInput}
                  onChange={(e) => setMachineInput(e.target.value)}
                  placeholder="Scan or type machine barcode and press Enter"
                  className="text-lg h-12 flex-1"
                  autoFocus
                  disabled={busy}
                />
                <BarcodeScanner
                  testId="machine-camera-scanner"
                  label="Camera"
                  buttonClassName="h-12"
                  onDetected={(code) => lookupMachine(null, code)}
                />
              </div>
              <div className="text-xs text-slate-500">
                Honeywell USB scanner auto-submits on Enter. Or tap{" "}
                <span className="font-medium">Camera</span> to scan with your phone camera.
              </div>
              <Button
                type="submit"
                data-testid="machine-lookup-submit"
                disabled={busy || !machineInput.trim()}
                className="bg-[#1e40af] hover:bg-[#1d3a9c]"
              >
                Look Up Machine
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {step === 2 && machine && (
        <Card data-testid="step-2-card" className="border-slate-200">
          <CardHeader>
            <CardTitle>Step 2 — Select Process</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-green-50 border border-green-200 rounded-md p-3 mb-5 flex items-center gap-3" data-testid="machine-confirmation">
              <Check className="w-5 h-5 text-green-600" />
              <div>
                <div className="font-semibold text-green-900">
                  {machine.machine_no} — {machine.machine_name || "Unnamed Machine"}
                </div>
                {machine.location && (
                  <div className="text-xs text-green-800">Location: {machine.location}</div>
                )}
              </div>
            </div>

            {processes.length === 0 ? (
              <div className="text-sm text-slate-500" data-testid="no-processes-msg">
                No processes are mapped to this machine. Ask admin to configure mappings.
              </div>
            ) : (
              <RadioGroup
                value={selectedProcessId ? String(selectedProcessId) : ""}
                onValueChange={(v) => setSelectedProcessId(parseInt(v, 10))}
                className="space-y-2"
                data-testid="process-radio-group"
              >
                {processes.map((p) => (
                  <label
                    key={p.id}
                    htmlFor={`proc-${p.id}`}
                    className={`flex items-center gap-3 border rounded-md p-3 cursor-pointer transition-colors ${
                      selectedProcessId === p.id
                        ? "border-[#1e40af] bg-blue-50"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <RadioGroupItem id={`proc-${p.id}`} value={String(p.id)} data-testid={`process-option-${p.id}`} />
                    <div>
                      <div className="font-medium text-slate-900">{p.process_name}</div>
                      <div className="text-xs text-slate-500">{p.process_code}</div>
                    </div>
                  </label>
                ))}
              </RadioGroup>
            )}

            <div className="flex gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setStep(1);
                  setMachineInput("");
                }}
                data-testid="back-to-step-1"
              >
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <Button
                disabled={!selectedProcessId || busy}
                onClick={startSession}
                data-testid="confirm-start-scanning"
                className="bg-[#1e40af] hover:bg-[#1d3a9c]"
              >
                Confirm & Start Scanning
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && session && (
        <div className="space-y-4">
          <div className="bg-[#1e40af] text-white rounded-md p-4 flex flex-wrap gap-4 items-center justify-between" data-testid="session-banner">
            <div className="flex gap-6 items-center">
              <div>
                <div className="text-xs uppercase tracking-wide opacity-80">Machine</div>
                <div className="font-semibold">{machine.machine_no}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide opacity-80">Process</div>
                <div className="font-semibold">{selectedProcess?.process_name}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide opacity-80">Batches Scanned</div>
                <div className="font-semibold" data-testid="scan-count">{scans.length}</div>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              data-testid="new-session-button"
              onClick={reset}
              className="bg-white text-[#1e40af] hover:bg-slate-100"
            >
              <RotateCcw className="w-4 h-4 mr-1" /> New Session
            </Button>
          </div>

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ScanLine className="w-5 h-5 text-[#1e40af]" />
                Step 3 — Scan Batch Card Barcodes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={recordScan} className="space-y-3">
                <Label htmlFor="batch-barcode">Batch Card Barcode</Label>
                <div className="flex gap-2">
                  <Input
                    id="batch-barcode"
                    data-testid="batch-barcode-input"
                    ref={batchRef}
                    value={batchInput}
                    onChange={(e) => setBatchInput(e.target.value)}
                    placeholder="Scan batch card barcode and press Enter"
                    className="text-lg h-12 flex-1"
                    autoFocus
                    disabled={busy}
                  />
                  <BarcodeScanner
                    testId="batch-camera-scanner"
                    label="Camera"
                    buttonClassName="h-12"
                    onDetected={(code) => recordScan(null, code)}
                  />
                </div>
              </form>

              <div className="mt-5">
                <div className="text-sm font-medium text-slate-700 mb-2">
                  Scanned Batches ({scans.length})
                </div>
                {scans.length === 0 ? (
                  <div className="text-sm text-slate-400 border border-dashed border-slate-200 rounded-md p-6 text-center" data-testid="empty-scans">
                    No batches scanned yet. Scan a batch card to start.
                  </div>
                ) : (
                  <ScrollArea className="h-80 rounded-md border border-slate-200">
                    <ul className="divide-y divide-slate-100" data-testid="scans-list">
                      {scans.map((s) => (
                        <li
                          key={s.id}
                          className={`flex items-center gap-3 px-4 py-3 ${
                            s.duplicate_today ? "bg-yellow-50" : "bg-green-50"
                          }`}
                          data-testid={`scan-row-${s.id}`}
                        >
                          {s.duplicate_today ? (
                            <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0" />
                          ) : (
                            <Check className="w-5 h-5 text-green-600 shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-mono font-semibold text-slate-900 truncate">
                              {s.batch_barcode}
                            </div>
                            {s.duplicate_today && s.previous_scan && (
                              <div className="text-xs text-yellow-800">
                                Previously scanned today at{" "}
                                {String(s.previous_scan.scanned_at).slice(11, 19)}
                              </div>
                            )}
                          </div>
                          <Badge
                            variant="outline"
                            className={`shrink-0 ${
                              s.duplicate_today ? "border-yellow-300 text-yellow-800" : "border-green-300 text-green-800"
                            }`}
                          >
                            {s.scan_time}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
