import React, { useState } from "react";
import axios from "axios";
import { API } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Download } from "lucide-react";

const todayStr = () => new Date().toISOString().slice(0, 10);

function StatCard({ label, value, testId }) {
  return (
    <div className="bg-white border border-slate-200 rounded-md p-4 shadow-sm" data-testid={testId}>
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-2xl font-semibold text-slate-900 mt-1">{value}</div>
    </div>
  );
}

function ChartBlock({ title, data, testId }) {
  return (
    <div className="bg-white border border-slate-200 rounded-md p-4 shadow-sm" data-testid={testId}>
      <div className="text-sm font-semibold text-slate-700 mb-3">{title}</div>
      <div style={{ width: "100%", height: 240 }}>
        <ResponsiveContainer>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="count" fill="#1e40af" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ResultTable({ records }) {
  if (!records?.length) {
    return (
      <div className="text-center py-8 text-slate-500" data-testid="reports-empty">
        No records for the selected period
      </div>
    );
  }
  return (
    <div className="overflow-x-auto" data-testid="reports-table">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-100 sticky top-0">
          <tr>
            {["Batch", "Machine", "Process", "Operator", "Date", "Time", "Notes"].map((h) => (
              <th key={h} className="px-3 py-2 text-left font-medium text-slate-700">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {records.map((r, i) => (
            <tr key={i} className={i % 2 ? "bg-slate-50" : ""}>
              <td className="px-3 py-2 font-mono">{r.batch_barcode}</td>
              <td className="px-3 py-2">{r.machine_no} <span className="text-slate-400">— {r.machine_name}</span></td>
              <td className="px-3 py-2">{r.process_name}</td>
              <td className="px-3 py-2">{r.operator_name} <span className="text-slate-400">({r.operator_id})</span></td>
              <td className="px-3 py-2">{r.scan_date}</td>
              <td className="px-3 py-2">{r.scan_time}</td>
              <td className="px-3 py-2 text-slate-500">{r.notes || ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ExportButtons({ from, to }) {
  const token = localStorage.getItem("pb_token");
  const dl = (kind) => {
    const url = `${API}/reports/export/${kind}?from=${from}&to=${to}&token=${token}`;
    // Use fetch with auth header → blob
    fetch(`${API}/reports/export/${kind}?from=${from}&to=${to}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.blob() : Promise.reject(r)))
      .then((blob) => {
        const u = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = u;
        a.download = `scan_report_${from}_to_${to}.${kind === "excel" ? "xlsx" : "csv"}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(u);
      })
      .catch(() => toast.error("Download failed"));
  };
  return (
    <div className="flex gap-2">
      <Button variant="outline" data-testid="export-excel-btn" onClick={() => dl("excel")}>
        <Download className="w-4 h-4 mr-1" /> Excel
      </Button>
      <Button variant="outline" data-testid="export-csv-btn" onClick={() => dl("csv")}>
        <Download className="w-4 h-4 mr-1" /> CSV
      </Button>
    </div>
  );
}

export default function ReportsPage() {
  const [tab, setTab] = useState("daily");
  const [busy, setBusy] = useState(false);

  // Daily
  const [date, setDate] = useState(todayStr());
  const [daily, setDaily] = useState(null);

  // Weekly
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(todayStr());
  const [weekly, setWeekly] = useState(null);

  // Monthly
  const now = new Date();
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [monthly, setMonthly] = useState(null);

  const fetchDaily = async () => {
    setBusy(true);
    try {
      const r = await axios.get(`${API}/reports/daily?date=${date}`);
      setDaily(r.data);
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to load report");
    } finally {
      setBusy(false);
    }
  };
  const fetchWeekly = async () => {
    setBusy(true);
    try {
      const r = await axios.get(`${API}/reports/weekly?from=${from}&to=${to}`);
      setWeekly(r.data);
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to load report");
    } finally {
      setBusy(false);
    }
  };
  const fetchMonthly = async () => {
    setBusy(true);
    try {
      const r = await axios.get(`${API}/reports/monthly?year=${year}&month=${month}`);
      setMonthly(r.data);
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to load report");
    } finally {
      setBusy(false);
    }
  };

  const monthsList = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  return (
    <div data-testid="reports-page">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold text-slate-900">Reports</h1>
        <p className="text-sm text-slate-500">Daily, weekly, and monthly scan analytics</p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList data-testid="reports-tabs">
          <TabsTrigger value="daily" data-testid="tab-daily">Daily</TabsTrigger>
          <TabsTrigger value="weekly" data-testid="tab-weekly">Weekly</TabsTrigger>
          <TabsTrigger value="monthly" data-testid="tab-monthly">Monthly</TabsTrigger>
        </TabsList>

        <TabsContent value="daily">
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>Daily Report</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <Label htmlFor="daily-date">Date</Label>
                  <Input
                    id="daily-date"
                    data-testid="daily-date-input"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
                <Button
                  onClick={fetchDaily}
                  disabled={busy}
                  data-testid="generate-daily"
                  className="bg-[#1e40af] hover:bg-[#1d3a9c]"
                >
                  Generate Report
                </Button>
                {daily && <ExportButtons from={date} to={date} />}
              </div>

              {daily && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <StatCard label="Total Scans" value={daily.summary.totalScans} testId="stat-total-scans" />
                    <StatCard label="Machines Used" value={daily.summary.machinesUsed} testId="stat-machines-used" />
                    <StatCard label="Unique Processes" value={daily.summary.byProcess.length} testId="stat-processes" />
                    <StatCard label="Operators" value={daily.summary.byOperator.length} testId="stat-operators" />
                  </div>
                  <ResultTable records={daily.records} />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="weekly">
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>Weekly Report</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <Label htmlFor="weekly-from">From</Label>
                  <Input id="weekly-from" data-testid="weekly-from-input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="weekly-to">To</Label>
                  <Input id="weekly-to" data-testid="weekly-to-input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                </div>
                <Button onClick={fetchWeekly} disabled={busy} data-testid="generate-weekly" className="bg-[#1e40af] hover:bg-[#1d3a9c]">
                  Generate Report
                </Button>
                {weekly && <ExportButtons from={from} to={to} />}
              </div>

              {weekly && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <StatCard label="Total Scans" value={weekly.summary.totalScans} testId="weekly-stat-total" />
                    <StatCard label="Machines Used" value={weekly.summary.machinesUsed} testId="weekly-stat-machines" />
                    <StatCard label="Unique Processes" value={weekly.summary.byProcess.length} testId="weekly-stat-processes" />
                    <StatCard label="Operators" value={weekly.summary.byOperator.length} testId="weekly-stat-operators" />
                  </div>
                  <ResultTable records={weekly.records} />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monthly">
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>Monthly Report</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <Label>Year</Label>
                  <Input data-testid="monthly-year-input" value={year} onChange={(e) => setYear(e.target.value)} className="w-28" />
                </div>
                <div>
                  <Label>Month</Label>
                  <Select value={month} onValueChange={setMonth}>
                    <SelectTrigger className="w-32" data-testid="monthly-month-select"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {monthsList.map((m, i) => (
                        <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={fetchMonthly} disabled={busy} data-testid="generate-monthly" className="bg-[#1e40af] hover:bg-[#1d3a9c]">
                  Generate Report
                </Button>
                {monthly && <ExportButtons from={monthly.from} to={monthly.to} />}
              </div>

              {monthly && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <StatCard label="Total Scans" value={monthly.summary.totalScans} testId="monthly-stat-total" />
                    <StatCard label="Machines Used" value={monthly.summary.machinesUsed} testId="monthly-stat-machines" />
                    <StatCard label="Unique Processes" value={monthly.summary.byProcess.length} testId="monthly-stat-processes" />
                    <StatCard label="Operators" value={monthly.summary.byOperator.length} testId="monthly-stat-operators" />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <ChartBlock title="By Machine" data={monthly.summary.byMachine} testId="chart-machines" />
                    <ChartBlock title="By Process" data={monthly.summary.byProcess} testId="chart-processes" />
                    <ChartBlock title="By Operator" data={monthly.summary.byOperator} testId="chart-operators" />
                  </div>

                  <ResultTable records={monthly.records} />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
