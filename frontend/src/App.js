import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";
import LoginPage from "@/pages/LoginPage";
import ScanPage from "@/pages/ScanPage";
import BatchHistoryPage from "@/pages/BatchHistoryPage";
import ReportsPage from "@/pages/ReportsPage";
import ImportMasterPage from "@/pages/ImportMasterPage";
import MachinesPage from "@/pages/MachinesPage";
import UsersPage from "@/pages/UsersPage";
import "@/App.css";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" richColors closeButton />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/scan" replace />} />
            <Route path="/scan" element={<ScanPage />} />
            <Route path="/history" element={<BatchHistoryPage />} />
            <Route
              path="/reports"
              element={
                <ProtectedRoute roles={["supervisor", "admin"]}>
                  <ReportsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/machines"
              element={
                <ProtectedRoute roles={["supervisor", "admin"]}>
                  <MachinesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/import"
              element={
                <ProtectedRoute roles={["admin"]}>
                  <ImportMasterPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute roles={["admin"]}>
                  <UsersPage />
                </ProtectedRoute>
              }
            />
          </Route>
          <Route path="*" element={<Navigate to="/scan" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
