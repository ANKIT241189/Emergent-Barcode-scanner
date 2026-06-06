import React, { useState, useEffect } from "react";
import axios from "axios";
import { API } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Cog } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function MachinesPage() {
  const [machines, setMachines] = useState([]);
  const [selected, setSelected] = useState(null);
  const [processes, setProcesses] = useState([]);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    axios.get(`${API}/masters/machines`).then((r) => setMachines(r.data.machines));
    axios.get(`${API}/masters/summary`).then((r) => setSummary(r.data));
  }, []);

  useEffect(() => {
    if (!selected) {
      setProcesses([]);
      return;
    }
    axios.get(`${API}/masters/machines/${selected.id}/processes`).then((r) => setProcesses(r.data.processes));
  }, [selected]);

  return (
    <div data-testid="machines-page">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold text-slate-900">Machines & Process Mapping</h1>
        <p className="text-sm text-slate-500">View configured machine ↔ process mappings</p>
      </div>

      {summary && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-white border border-slate-200 rounded-md p-4"><div className="text-xs uppercase text-slate-500">Machines</div><div className="text-2xl font-semibold">{summary.machineCount}</div></div>
          <div className="bg-white border border-slate-200 rounded-md p-4"><div className="text-xs uppercase text-slate-500">Processes</div><div className="text-2xl font-semibold">{summary.processCount}</div></div>
          <div className="bg-white border border-slate-200 rounded-md p-4"><div className="text-xs uppercase text-slate-500">Mappings</div><div className="text-2xl font-semibold">{summary.mappingCount}</div></div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-slate-200 md:col-span-1">
          <CardHeader><CardTitle>Machines</CardTitle></CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[480px]">
              {machines.length === 0 ? (
                <div className="text-sm text-slate-400 p-6 text-center" data-testid="no-machines">
                  No machines configured. Import master data first.
                </div>
              ) : (
                <ul className="divide-y divide-slate-100" data-testid="machines-list">
                  {machines.map((m) => (
                    <li key={m.id}>
                      <button
                        data-testid={`machine-row-${m.id}`}
                        onClick={() => setSelected(m)}
                        className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-slate-50 ${
                          selected?.id === m.id ? "bg-blue-50 border-l-4 border-[#1e40af]" : ""
                        }`}
                      >
                        <Cog className="w-4 h-4 text-[#1e40af] shrink-0" />
                        <div>
                          <div className="font-medium text-slate-900">{m.machine_no}</div>
                          {m.machine_name && <div className="text-xs text-slate-500">{m.machine_name}</div>}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="border-slate-200 md:col-span-2">
          <CardHeader>
            <CardTitle>
              {selected ? `Processes for ${selected.machine_no}` : "Select a machine"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selected && (
              <div className="text-sm text-slate-400 py-12 text-center">
                Click a machine on the left to see its configured processes
              </div>
            )}
            {selected && processes.length === 0 && (
              <div className="text-sm text-slate-500 py-8 text-center" data-testid="no-machine-processes">
                No processes configured for this machine
              </div>
            )}
            {selected && processes.length > 0 && (
              <ul className="space-y-2" data-testid="machine-processes-list">
                {processes.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-3 border border-slate-200 rounded-md p-3 bg-white"
                  >
                    <Check className="w-5 h-5 text-green-600" />
                    <div>
                      <div className="font-medium text-slate-900">{p.process_name}</div>
                      <div className="text-xs text-slate-500">{p.process_code}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
