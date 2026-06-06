import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { ScanBarcode, History, FileBarChart2, Upload, Cog, Users, LogOut } from "lucide-react";

const ROLE_BADGE = {
  admin: "bg-red-100 text-red-700 border-red-200",
  supervisor: "bg-yellow-100 text-yellow-800 border-yellow-200",
  operator: "bg-green-100 text-green-700 border-green-200",
};

const LINKS = [
  { to: "/scan", label: "Scan", icon: ScanBarcode, roles: ["operator", "supervisor", "admin"] },
  { to: "/history", label: "Batch History", icon: History, roles: ["operator", "supervisor", "admin"] },
  { to: "/reports", label: "Reports", icon: FileBarChart2, roles: ["supervisor", "admin"] },
  { to: "/admin/machines", label: "Machines", icon: Cog, roles: ["supervisor", "admin"] },
  { to: "/admin/import", label: "Import", icon: Upload, roles: ["admin"] },
  { to: "/admin/users", label: "Users", icon: Users, roles: ["admin"] },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;
  const links = LINKS.filter((l) => l.roles.includes(user.role));

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#1e40af] text-white flex items-center justify-center font-bold">
              PB
            </div>
            <div>
              <div className="font-semibold text-slate-900 leading-tight">Process Barcode</div>
              <div className="text-xs text-slate-500 leading-tight">Scan & Track System</div>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-1">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                data-testid={`nav-${l.to.replace(/\//g, "-")}`}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-[#1e40af] text-white"
                      : "text-slate-700 hover:bg-slate-100"
                  }`
                }
              >
                <l.icon className="w-4 h-4" />
                {l.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-medium text-slate-900 leading-tight" data-testid="nav-user-name">
                {user.full_name}
              </div>
              <div className="text-xs text-slate-500 leading-tight">{user.employee_id}</div>
            </div>
            <span
              data-testid="nav-user-role"
              className={`text-xs font-medium border rounded-full px-2.5 py-1 capitalize ${ROLE_BADGE[user.role]}`}
            >
              {user.role}
            </span>
            <Button
              variant="outline"
              size="sm"
              data-testid="logout-button"
              onClick={() => {
                logout();
                navigate("/login");
              }}
            >
              <LogOut className="w-4 h-4 mr-1" /> Logout
            </Button>
          </div>
        </div>

        <nav className="md:hidden border-t border-slate-200 px-2 py-2 flex gap-1 overflow-x-auto">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `whitespace-nowrap flex items-center gap-1.5 px-3 py-1.5 rounded text-sm ${
                  isActive ? "bg-[#1e40af] text-white" : "text-slate-700 bg-slate-100"
                }`
              }
            >
              <l.icon className="w-3.5 h-3.5" />
              {l.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <Outlet />
      </main>
    </div>
  );
}
