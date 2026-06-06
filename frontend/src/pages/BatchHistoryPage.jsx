import React, { useState, useRef } from "react";
import axios from "axios";
import { API } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Cog, User, Calendar } from "lucide-react";
import { toast } from "sonner";
import BarcodeScanner from "@/components/BarcodeScanner";

export default function BatchHistoryPage() {
  const [code, setCode] = useState("");
  const [records, setRecords] = useState(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  const search = async (e, codeOverride) => {
    if (e?.preventDefault) e.preventDefault();
    const q = (codeOverride ?? code).trim();
    if (!q) return;
    setCode(q);
    setBusy(true);
    try {
      const r = await axios.get(`${API}/scans/batch/${encodeURIComponent(q)}`);
      setRecords(r.data.records || []);
    } catch (err) {
      toast.error(err?.response?.data?.error || "Search failed");
      setRecords([]);
    } finally {
      setBusy(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  return (
    <div data-testid="batch-history-page">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold text-slate-900">Batch History</h1>
        <p className="text-sm text-slate-500">View the complete journey of any batch card</p>
      </div>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle>Search Batch</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={search} className="flex gap-2">
            <Input
              ref={inputRef}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Scan or type batch barcode and press Enter"
              data-testid="batch-search-input"
              autoFocus
              className="text-lg h-12"
            />
            <BarcodeScanner
              testId="history-camera-scanner"
              label="Camera"
              buttonClassName="h-12"
              onDetected={(c) => search(null, c)}
            />
            <Button
              type="submit"
              disabled={busy || !code.trim()}
              data-testid="batch-search-submit"
              className="bg-[#1e40af] hover:bg-[#1d3a9c] h-12"
            >
              <Search className="w-4 h-4 mr-1" /> Search
            </Button>
          </form>
        </CardContent>
      </Card>

      {records !== null && (
        <Card className="mt-5 border-slate-200">
          <CardHeader>
            <CardTitle>
              Journey for <span className="font-mono">{code}</span>
              <span className="ml-2 text-sm text-slate-500 font-normal">
                ({records.length} step{records.length === 1 ? "" : "s"})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {records.length === 0 ? (
              <div
                className="text-center text-slate-500 py-10 border border-dashed border-slate-200 rounded-md"
                data-testid="batch-no-records"
              >
                No records found for this batch barcode
              </div>
            ) : (
              <ol className="relative border-l-2 border-[#1e40af]/30 ml-3" data-testid="batch-timeline">
                {records.map((r, i) => (
                  <li key={r.id} className="ml-6 mb-6 last:mb-0" data-testid={`timeline-step-${i + 1}`}>
                    <span className="absolute -left-3 mt-1 flex items-center justify-center w-6 h-6 bg-[#1e40af] text-white rounded-full text-xs font-bold">
                      {i + 1}
                    </span>
                    <div className="bg-white border border-slate-200 rounded-md p-4 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 font-semibold text-slate-900">
                          <Cog className="w-4 h-4 text-[#1e40af]" />
                          {r.machine_no} {r.machine_name ? ` — ${r.machine_name}` : ""}
                        </div>
                        <div className="text-xs px-2 py-1 rounded-full bg-blue-50 text-[#1e40af] border border-blue-100">
                          {r.process_name}
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5" /> {r.operator_name} ({r.operator_id})
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" /> {r.scan_date} {r.scan_time}
                        </div>
                      </div>
                      {r.notes && <div className="mt-2 text-xs text-slate-500">Notes: {r.notes}</div>}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
