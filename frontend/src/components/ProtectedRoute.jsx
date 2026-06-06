import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export default function ProtectedRoute({ children, roles }) {
  const { user, loading, token } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div data-testid="auth-loading" className="text-slate-500">Loading...</div>
      </div>
    );
  }
  if (!token || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (roles && roles.length && !roles.includes(user.role)) {
    return <Navigate to="/scan" replace />;
  }
  return children;
}
