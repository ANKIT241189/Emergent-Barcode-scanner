import React, { useState, useEffect } from "react";
import axios from "axios";
import { API } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, CheckCircle2 } from "lucide-react";

function Summary({ summary, onRefresh }) {
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
  const [result, setResult] = useState(null);
  const [summary, setSummary] = useState(null);

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
      toast.success(`Imported ${r.data.processed} mappings`);
      loadSummary();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-testid="import-master-page">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold text-slate-900">Import Master Data</h1>
        <p className="text-sm text-slate-500">Upload Excel file with machine ↔ process mappings</p>
      </div>

      <Summary summary={summary} />

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle>Expected Excel Format</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="text-sm border border-slate-200 rounded mb-5">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-slate-700">Machine Number</th>
                <th className="px-3 py-2 text-left font-medium text-slate-700">Process Type</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              <tr className="border-t border-slate-100"><td className="px-3 py-1.5 font-mono">MC-001</td><td className="px-3 py-1.5">Welding</td></tr>
              <tr className="border-t border-slate-100 bg-slate-50"><td className="px-3 py-1.5 font-mono">MC-001</td><td className="px-3 py-1.5">Grinding</td></tr>
              <tr className="border-t border-slate-100"><td className="px-3 py-1.5 font-mono">MC-002</td><td className="px-3 py-1.5">Drilling</td></tr>
            </tbody>
          </table>
          <p className="text-xs text-slate-500 mb-4">
            Repeating the same machine number on different rows creates multiple processes for it.
          </p>

          <label
            htmlFor="file-input"
            className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-slate-300 rounded-md p-8 cursor-pointer hover:bg-slate-50 transition"
            data-testid="file-drop-area"
          >
            <FileSpreadsheet className="w-10 h-10 text-[#1e40af]" />
            <div className="text-sm text-slate-700">
              {file ? <span className="font-medium">{file.name}</span> : "Click to choose .xlsx or .xls file"}
            </div>
            <input
              id="file-input"
              data-testid="file-input"
              type="file"
              accept=".xlsx,.xls"
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
              <Upload className="w-4 h-4 mr-1" /> Upload File
            </Button>

            {result && (
              <div className="text-sm text-green-700 flex items-center gap-2" data-testid="upload-result">
                <CheckCircle2 className="w-4 h-4" />
                Processed: {result.processed} · Skipped: {result.skipped}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
