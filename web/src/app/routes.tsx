import { Navigate, Route, Routes } from "react-router-dom";
import { AdminLayout } from "./layout/AdminLayout";
import { AuthLayout } from "./layout/AuthLayout";
import { PublicLayout } from "./layout/PublicLayout";
import { useAuth } from "./providers/AuthProvider";

import { Login } from "../pages/auth/Login";
import { Register } from "../pages/auth/Register";
import { Home } from "../pages/public/Home";
import { Dashboard } from "../pages/admin/Dashboard";
import { Users } from "../pages/admin/Users";
import { Listings } from "../pages/admin/Listings";
import { Auctions } from "../pages/admin/Auctions";
import { Deals } from "../pages/admin/Deals";
import { Reports } from "../pages/admin/Reports";
import { Chats } from "../pages/admin/Chats";
import { TCG } from "../pages/admin/TCG";
import { Verifications } from "../pages/admin/Verifications";
import { Payments } from "../pages/admin/Payments";
import { Plans } from "../pages/admin/Plans";
import { Stores } from "../pages/admin/Stores";
import { Events } from "../pages/admin/Events";
import { Settings } from "../pages/admin/Settings";
import { SellerDashboard } from "../pages/seller/Dashboard";
import { StoreDashboard } from "../pages/store/Dashboard";
import { Account } from "../pages/account/Account";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();
  if (!ready) {
    return <div className="p-10 text-slate-400">Cargando sesión...</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function RequireRole({ children, roles }: { children: React.ReactNode; roles: string[] }) {
  const { user } = useAuth();
  if (!user) return null;
  const ok = user.roles.some((role) => roles.includes(role));
  if (!ok) {
    return <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-6 text-red-200">Acceso denegado.</div>;
  }
  return <>{children}</>;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <PublicLayout>
            <Home />
          </PublicLayout>
        }
      />
      <Route
        path="/login"
        element={
          <AuthLayout>
            <Login />
          </AuthLayout>
        }
      />
      <Route
        path="/register"
        element={
          <AuthLayout>
            <Register />
          </AuthLayout>
        }
      />
      <Route
        path="/admin"
        element={
          <RequireAuth>
            <RequireRole roles={["ADMIN", "MOD"]}>
              <AdminLayout />
            </RequireRole>
          </RequireAuth>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="users" element={<Users />} />
        <Route path="listings" element={<Listings />} />
        <Route path="auctions" element={<Auctions />} />
        <Route path="deals" element={<Deals />} />
        <Route path="reports" element={<Reports />} />
        <Route path="chats" element={<Chats />} />
        <Route path="tcg" element={<TCG />} />
        <Route path="verifications" element={<Verifications />} />
        <Route path="payments" element={<Payments />} />
        <Route path="plans" element={<Plans />} />
        <Route path="stores" element={<Stores />} />
        <Route path="events" element={<Events />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route
        path="/seller"
        element={
          <RequireAuth>
            <RequireRole roles={["SELLER"]}>
              <SellerDashboard />
            </RequireRole>
          </RequireAuth>
        }
      />
      <Route
        path="/store"
        element={
          <RequireAuth>
            <RequireRole roles={["STORE"]}>
              <StoreDashboard />
            </RequireRole>
          </RequireAuth>
        }
      />
      <Route
        path="/account"
        element={
          <RequireAuth>
            <Account />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
