import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AuthProvider } from './features/auth/AuthProvider';
import { Loading, ToastProvider } from './components/ui';
import AppLayout from './layouts/AppLayout';
import Login from './pages/Login';
const Dashboard=lazy(()=>import('./pages/Dashboard'));
const Attendance=lazy(()=>import('./pages/Attendance'));
const NewImport=lazy(()=>import('./pages/NewImport'));
const Imports=lazy(()=>import('./pages/Imports').then(m=>({default:m.Imports})));
const ImportDetail=lazy(()=>import('./pages/Imports').then(m=>({default:m.ImportDetail})));
const Employees=lazy(()=>import('./pages/Employees'));
const Users=lazy(()=>import('./pages/Users'));
const Settings=lazy(()=>import('./pages/Settings'));
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route element={<AppLayout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/attendance" element={<Attendance key="attendance" />} />
                <Route path="/issues" element={<Attendance key="issues" issuesOnly />} />
                <Route path="/imports" element={<Imports />} />
                <Route path="/imports/new" element={<NewImport />} />
                <Route path="/imports/:id" element={<ImportDetail />} />
                <Route path="/employees" element={<Employees />} />
                <Route path="/users" element={<Users />} />
                <Route path="/settings" element={<Settings />} />
              </Route>
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
