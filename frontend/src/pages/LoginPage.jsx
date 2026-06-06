import React, { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { ScanBarcode, Loader2 } from "lucide-react";

export default function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/scan" replace />;

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!employeeId || !password) {
      toast.error("Employee ID and password are required");
      return;
    }
    setLoading(true);
    try {
      await login(employeeId.trim(), password);
      toast.success("Welcome back!");
      navigate("/scan");
    } catch (err) {
      const msg = err?.response?.data?.error || "Login failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-200 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-xl bg-[#1e40af] text-white flex items-center justify-center mb-3 shadow-md">
            <ScanBarcode className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">Process Barcode</h1>
          <p className="text-sm text-slate-500">Sign in to start scanning</p>
        </div>

        <Card className="shadow-md border-slate-200">
          <CardHeader>
            <CardTitle>Operator Login</CardTitle>
            <CardDescription>Use your employee credentials</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={onSubmit} data-testid="login-form">
              <div className="space-y-1.5">
                <Label htmlFor="employee_id">Employee ID</Label>
                <Input
                  id="employee_id"
                  data-testid="login-employee-id"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  autoFocus
                  autoComplete="username"
                  placeholder="e.g. admin"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  data-testid="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="Enter password"
                />
              </div>
              <Button
                type="submit"
                data-testid="login-submit"
                disabled={loading}
                className="w-full bg-[#1e40af] hover:bg-[#1d3a9c] text-white"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Sign In
              </Button>
            </form>
            <p className="text-xs text-slate-400 mt-4 text-center">
              Default admin: <span className="font-mono">admin / admin123</span>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
