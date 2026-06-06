import React, { useState, useEffect } from "react";
import axios from "axios";
import { API } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, CheckCircle2, Trash2, AlertTriangle } from "lucide-react";

function Summary({ summary }) {
  if (!summary) return null;
  return (
    <div className="grid grid-cols-3 gap-3 mb-5" data-testid="master-summary">
      <div className="bg-white border border-slate-200 rounded-md p-4">
        <div className="text-xs uppercase text-slate-500">Machines</div>
        <div className="text-2xl font-semibold text-slate-900">{summary.machineCount}</div>
      </div>
      <div className="bg-white border border-slate-200 rounded-md p-4">
        <div className="text-xs uppercase text-slate-500">Process Types</div>
        <div className="text-2xl font-semibold text-slate-900">{summary.processCount}</div>
      </div>
      <div className="bg-white border border-slate-200 rounded-md p-4">
        <div className="text-xs uppercase text-slate-500">Mappings</div>
        <div className="text-2xl font-semibold text-slate-900">{summary.mappingCount}</div>
      </div>
    </div>
  );
}

export default function ImportMasterPage() {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [summary, setSummary] = useState(null);
  const [wipeHistory, setWipeHistory] = useState(false);

  const loadSummary = async () => {
    try {
      const r = await axios.get(`${API}/masters/summary`);
      setSummary(r.data);
    } catch {}
  };

  useEffect(() => {
    loadSummary();
  }, []);

  const upload = async () => {
    if (!file) {
      toast.error("Select a file first");
      return;
    }
    const fd = new FormData();
    fd.append("file", file);
    setBusy(true);
    try {
      const r = await axios.post(`${API}/masters/import`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(r.data);
      toast.success(
        `Imported ${r.data.machinesAdded} new machines · ${r.data.mappingsAdded} mappings`
      );
      loadSummary();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const resetMasters = async () => {
    setResetBusy(true);
    try {
      const q = wipeHistory ? "?wipe_history=1" : "";
      await axios.post(`${API}/masters/reset${q}`);
      toast.success(
        wipeHistory ? "Master data and scan history wiped" : "Master data wiped"
      );
      setResult(null);
      loadSummary();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Reset failed");
    } finally {
      setResetBusy(false);
    }
  };

  return (
    <div data-testid="import-master-page">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Import Master Data</h1>
          <p className="text-sm text-slate-500">
            Upload Excel (.xlsx/.xls) or CSV with machine ↔ process mappings
          </p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="text-red-700 border-red-200 hover:bg-red-50" data-testid="open-reset-dialog">
              <Trash2 className="w-4 h-4 mr-1" /> Reset Master Data
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" /> Reset master data?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This deletes all machines, process types and mappings. Scan history is preserved unless you tick the box below.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <Checkbox
                checked={wipeHistory}
                onCheckedChange={(v) => setWipeHistory(!!v)}
                data-testid="wipe-history-checkbox"
              />
              Also delete all scan history (records & sessions)
            </label>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="reset-cancel">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={resetMasters}
                disabled={resetBusy}
                className="bg-red-600 hover:bg-red-700"
                data-testid="reset-confirm"
              >
                {resetBusy ? "Resetting…" : "Yes, reset"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <Summary summary={summary} />

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle>Expected File Format</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600 mb-3">
            The importer supports two formats. Same machine repeated on multiple rows = multiple processes for that machine.
            A row with an empty machine column is treated as a continuation of the previous machine.
            Machines that share a type prefix (e.g. "JIGGER NO 1", "JIGGER NO 2"…) inherit all processes
            defined on any sibling of the same type.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
            <div>
              <div className="text-xs font-semibold text-slate-700 mb-1">Simple (2 columns)</div>
              <table className="text-sm border border-slate-200 rounded w-full">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-slate-700">Machine Number</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-700">Process Type</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  <tr className="border-t border-slate-100"><td className="px-3 py-1.5 font-mono">MC-001</td><td className="px-3 py-1.5">Welding</td></tr>
                  <tr className="border-t border-slate-100 bg-slate-50"><td className="px-3 py-1.5 font-mono">MC-001</td><td className="px-3 py-1.5">Grinding</td></tr>
                </tbody>
              </table>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-700 mb-1">Full (4 columns)</div>
              <table className="text-sm border border-slate-200 rounded w-full">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-2 py-2 text-left font-medium text-slate-700">M/C Number Code</th>
                    <th className="px-2 py-2 text-left font-medium text-slate-700">Process M/C Details</th>
                    <th className="px-2 py-2 text-left font-medium text-slate-700">Proc_CD</th>
                    <th className="px-2 py-2 text-left font-medium text-slate-700">Proc_Desc</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  <tr className="border-t border-slate-100"><td className="px-2 py-1.5 font-mono">3401</td><td className="px-2 py-1.5">JIGGER NO 1</td><td className="px-2 py-1.5">18</td><td className="px-2 py-1.5">JIGGER BLEACH</td></tr>
                  <tr className="border-t border-slate-100 bg-slate-50"><td className="px-2 py-1.5 font-mono">3402</td><td className="px-2 py-1.5">JIGGER NO 2</td><td className="px-2 py-1.5 text-slate-400">(empty)</td><td className="px-2 py-1.5 text-slate-400">(inherits)</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <label
            htmlFor="file-input"
            className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-slate-300 rounded-md p-8 cursor-pointer hover:bg-slate-50 transition"
            data-testid="file-drop-area"
          >
            <FileSpreadsheet className="w-10 h-10 text-[#1e40af]" />
            <div className="text-sm text-slate-700">
              {file ? <span className="font-medium">{file.name}</span> : "Click to choose .xlsx / .xls / .csv file"}
            </div>
            <input
              id="file-input"
              data-testid="file-input"
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </label>

          <div className="mt-4 flex items-center gap-3">
            <Button
              onClick={upload}
              disabled={busy || !file}
              data-testid="upload-submit"
              className="bg-[#1e40af] hover:bg-[#1d3a9c]"
            >
              <Upload className="w-4 h-4 mr-1" /> {busy ? "Uploading…" : "Upload File"}
            </Button>
          </div>

          {result && (
            <div className="mt-5 rounded-md border border-green-200 bg-green-50 p-4" data-testid="upload-result">
              <div className="flex items-center gap-2 text-green-800 font-medium">
                <CheckCircle2 className="w-4 h-4" /> Import complete
              </div>
              <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div><div className="text-slate-500 text-xs">Rows read</div><div className="font-semibold">{result.totalRows}</div></div>
                <div><div className="text-slate-500 text-xs">Machines (new)</div><div className="font-semibold">{result.machinesAdded} <span className="text-slate-400">/ {result.machines}</span></div></div>
                <div><div className="text-slate-500 text-xs">Processes added</div><div className="font-semibold">{result.processesAdded}</div></div>
                <div><div className="text-slate-500 text-xs">Mappings added</div><div className="font-semibold">{result.mappingsAdded}</div></div>
              </div>
              {result.inheritedMachines > 0 && (
                <div className="text-xs text-slate-700 mt-2">
                  {result.inheritedMachines} machine(s) inherited processes from same-type siblings
                </div>
              )}
              {result.machinesWithoutProcesses?.length > 0 && (
                <div className="mt-3">
                  <div className="text-xs font-medium text-amber-800 mb-1">
                    {result.machinesWithoutProcesses.length} machines were imported but have no processes
                    (no sibling of same type had any either):
                  </div>
                  <ScrollArea className="h-28 rounded border border-amber-200 bg-white">
                    <ul className="text-xs px-3 py-2 space-y-0.5" data-testid="machines-without-processes">
                      {result.machinesWithoutProcesses.map((s, i) => (
                        <li key={i} className="font-mono text-slate-700">{s}</li>
                      ))}
                    </ul>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
