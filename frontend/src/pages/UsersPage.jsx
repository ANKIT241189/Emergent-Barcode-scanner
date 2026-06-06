import React, { useState, useEffect } from "react";
import axios from "axios";
import { API } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { UserPlus, Edit2, X, Save } from "lucide-react";

const ROLE_BADGE = {
  admin: "bg-red-100 text-red-700 border-red-200",
  supervisor: "bg-yellow-100 text-yellow-800 border-yellow-200",
  operator: "bg-green-100 text-green-700 border-green-200",
};

const EMPTY_FORM = {
  employee_id: "",
  full_name: "",
  password: "",
  role: "operator",
  department: "",
};

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const r = await axios.get(`${API}/users`);
    setUsers(r.data.users);
  };

  useEffect(() => {
    load();
  }, []);

  const createUser = async () => {
    if (!form.employee_id || !form.full_name || !form.password) {
      toast.error("Employee ID, name and password required");
      return;
    }
    setBusy(true);
    try {
      await axios.post(`${API}/users`, form);
      toast.success("User created");
      setForm(EMPTY_FORM);
      setShowCreate(false);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Create failed");
    } finally {
      setBusy(false);
    }
  };

  const beginEdit = (u) => {
    setEditingId(u.id);
    setEditForm({
      full_name: u.full_name,
      role: u.role,
      department: u.department || "",
      password: "",
    });
  };

  const saveEdit = async (u) => {
    setBusy(true);
    try {
      const payload = { ...editForm };
      if (!payload.password) delete payload.password;
      await axios.put(`${API}/users/${u.id}`, payload);
      toast.success("User updated");
      setEditingId(null);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (u) => {
    try {
      await axios.put(`${API}/users/${u.id}`, { is_active: !u.is_active });
      load();
    } catch (err) {
      toast.error("Failed to toggle");
    }
  };

  return (
    <div data-testid="users-page">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">User Management</h1>
          <p className="text-sm text-slate-500">Manage operators, supervisors, and admins</p>
        </div>
        <Button
          onClick={() => setShowCreate((v) => !v)}
          data-testid="toggle-create-user"
          className="bg-[#1e40af] hover:bg-[#1d3a9c]"
        >
          <UserPlus className="w-4 h-4 mr-1" />
          {showCreate ? "Close" : "Add User"}
        </Button>
      </div>

      {showCreate && (
        <Card className="border-slate-200 mb-4" data-testid="create-user-card">
          <CardHeader><CardTitle>Create User</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div>
                <Label>Employee ID</Label>
                <Input data-testid="new-user-employee-id" value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} />
              </div>
              <div>
                <Label>Full Name</Label>
                <Input data-testid="new-user-full-name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
              </div>
              <div>
                <Label>Password</Label>
                <Input data-testid="new-user-password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
              <div>
                <Label>Role</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger data-testid="new-user-role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="operator">Operator</SelectItem>
                    <SelectItem value="supervisor">Supervisor</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Department</Label>
                <Input data-testid="new-user-department" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
              </div>
            </div>
            <div className="mt-4">
              <Button onClick={createUser} disabled={busy} data-testid="submit-create-user" className="bg-[#1e40af] hover:bg-[#1d3a9c]">
                Create User
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-slate-200">
        <CardHeader><CardTitle>All Users ({users.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm" data-testid="users-table">
              <thead className="bg-slate-100">
                <tr>
                  {["Employee ID", "Name", "Role", "Department", "Status", "Last Login", "Actions"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-medium text-slate-700">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u, idx) => (
                  <tr key={u.id} className={idx % 2 ? "bg-slate-50" : ""} data-testid={`user-row-${u.id}`}>
                    <td className="px-3 py-2 font-mono">{u.employee_id}</td>
                    <td className="px-3 py-2">
                      {editingId === u.id ? (
                        <Input data-testid={`edit-name-${u.id}`} value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} />
                      ) : (
                        u.full_name
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {editingId === u.id ? (
                        <Select value={editForm.role} onValueChange={(v) => setEditForm({ ...editForm, role: v })}>
                          <SelectTrigger data-testid={`edit-role-${u.id}`} className="w-32"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="operator">Operator</SelectItem>
                            <SelectItem value="supervisor">Supervisor</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className={`text-xs border rounded-full px-2 py-0.5 capitalize ${ROLE_BADGE[u.role]}`}>{u.role}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {editingId === u.id ? (
                        <Input data-testid={`edit-dept-${u.id}`} value={editForm.department} onChange={(e) => setEditForm({ ...editForm, department: e.target.value })} />
                      ) : (
                        u.department || <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={!!u.is_active}
                          onCheckedChange={() => toggleActive(u)}
                          data-testid={`toggle-active-${u.id}`}
                        />
                        <span className={u.is_active ? "text-green-700" : "text-slate-400"}>
                          {u.is_active ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {u.last_login ? new Date(u.last_login).toLocaleString() : <span className="text-slate-400">Never</span>}
                    </td>
                    <td className="px-3 py-2">
                      {editingId === u.id ? (
                        <div className="flex gap-1">
                          <Button size="sm" onClick={() => saveEdit(u)} disabled={busy} data-testid={`save-edit-${u.id}`} className="bg-[#1e40af] hover:bg-[#1d3a9c]">
                            <Save className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingId(null)} data-testid={`cancel-edit-${u.id}`}>
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => beginEdit(u)} data-testid={`edit-user-${u.id}`}>
                          <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
