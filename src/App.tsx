import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';

import { Login } from './pages/Login';
import { AppLayout } from './components/layout/AppLayout';
import { Dashboard } from './pages/Dashboard';
import { HouseManagement } from './pages/HouseManagement';
import { HouseProfile } from './pages/HouseProfile';
import { DefaultersReport } from './pages/DefaultersReport';
import { MonthlyCollection } from './pages/MonthlyCollection';
import { ExpenseManagement } from './pages/ExpenseManagement';
import { StaffManagement } from './pages/StaffManagement';
import { SalaryManagement } from './pages/SalaryManagement';
import { AttendanceSystem } from './pages/AttendanceSystem';
import { AccountsLedger } from './pages/AccountsLedger';
import { Reports } from './pages/Reports';
import { ReceiptPrinting } from './pages/ReceiptPrinting';
import { UserManagement } from './pages/UserManagement';
import { SettingsPage } from './pages/SettingsPage';
import { AuditLogsPage } from './pages/AuditLogsPage';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-teal-700 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-bold text-slate-600">Authenticating Session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="houses" element={<HouseManagement />} />
              <Route path="houses/:id" element={<HouseProfile />} />
              <Route path="defaulters" element={<DefaultersReport />} />
              <Route path="collections" element={<MonthlyCollection />} />
              <Route path="expenses" element={<ExpenseManagement />} />
              <Route path="staff" element={<StaffManagement />} />
              <Route path="salaries" element={<SalaryManagement />} />
              <Route path="attendance" element={<AttendanceSystem />} />
              <Route path="ledger" element={<AccountsLedger />} />
              <Route path="reports" element={<Reports />} />
              <Route path="print-receipts" element={<ReceiptPrinting />} />
              <Route path="users" element={<UserManagement />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="audit-logs" element={<AuditLogsPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </SettingsProvider>
    </AuthProvider>
  );
}
