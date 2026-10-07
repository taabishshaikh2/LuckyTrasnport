import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Truck } from "lucide-react";
import { api, message } from "./api/client";
import Shell, { More } from "./layouts/Shell";
import Home from "./pages/Home";
import Masters from "./pages/Masters";
import { TripList, TripDetail } from "./pages/Trips";
import TripForm from "./features/TripForm";
import {
  InvoiceList,
  InvoiceForm,
  InvoiceDetail,
  Payments,
} from "./pages/Invoices";
import Import from "./pages/Import";
import { Reports, Settings } from "./pages/Reports";
import "./styles.css";
function Login({ onLogin }) {
  const [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = (await api.post("/auth/login", { username, password })).data
        .data;
      sessionStorage.setItem("token", r.token);
      onLogin(r.user);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login">
      <section className="login-brand">
        <Truck size={62} />
        <p className="eyebrow">LUCKY TRANSPORT SERVICES</p>
        <h1>
          Every trip.
          <br />
          Every invoice.
          <br />
          Under control.
        </h1>
        <p>Your transport operations, simplified.</p>
      </section>
      <form className="login-form" onSubmit={submit}>
        <span className="brand-mark">L</span>
        <h2>Welcome back</h2>
        <p className="muted">Sign in to your operations workspace.</p>
        <label className="field">
          <span>Username</span>
          <input
            autoComplete="username"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="wide" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <p className="muted">Lucky Transport Services · Mumbai</p>
      </form>
    </div>
  );
}
function App() {
  const [user, setUser] = useState(null),
    [loading, setLoading] = useState(!!sessionStorage.getItem("token"));
  const logout = () => {
    sessionStorage.removeItem("token");
    setUser(null);
  };
  useEffect(() => {
    window.addEventListener("session-expired", logout);
    if (sessionStorage.getItem("token"))
      api
        .get("/auth/me")
        .then((r) => setUser(r.data.data))
        .catch(logout)
        .finally(() => setLoading(false));
    return () => window.removeEventListener("session-expired", logout);
  }, []);
  if (loading) return <div className="state">Opening workspace…</div>;
  if (!user) return <Login onLogin={setUser} />;
  const ops = user.role !== "DRIVER";
  return (
    <Routes>
      <Route element={<Shell user={user} logout={logout} />}>
        <Route index element={<Home user={user} />} />
        <Route path="trips" element={<TripList user={user} />} />
        <Route path="trips/:id" element={<TripDetail user={user} />} />
        <Route path="more" element={<More user={user} logout={logout} />} />
        {ops && (
          <>
            <Route path="trips/new" element={<TripForm />} />
            {[
              "vehicles",
              "drivers",
              "customers",
              "routes",
              "rates",
              "agreements",
              ...(user.role === "ADMIN" ? ["users"] : []),
            ].map((entity) => (
              <Route
                key={entity}
                path={entity}
                element={<Masters key={entity} entity={entity} user={user} />}
              />
            ))}
            <Route path="invoices" element={<InvoiceList />} />
            <Route path="invoices/new" element={<InvoiceForm />} />
            <Route path="invoices/:id" element={<InvoiceDetail />} />
            <Route path="payments" element={<Payments />} />
            <Route path="import" element={<Import />} />
            <Route path="reports" element={<Reports />} />
            <Route path="settings" element={<Settings user={user} />} />
          </>
        )}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
