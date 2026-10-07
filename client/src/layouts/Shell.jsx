import React, { useState } from "react";
import { NavLink, Link, Outlet } from "react-router-dom";
import {
  Home,
  Route,
  Receipt,
  Truck,
  Menu,
  Users,
  Contact,
  MapPin,
  Wallet,
  FileSpreadsheet,
  Settings,
  LogOut,
  Shield,
  BookOpen,
} from "lucide-react";
const items = [
  ["/", "Home", Home],
  ["/trips", "Trips", Route],
  ["/invoices", "Invoices", Receipt],
  ["/vehicles", "Vehicles", Truck],
  ["/more", "More", Menu],
];
export const moreItems = [
  ["/drivers", "Drivers", Users],
  ["/customers", "Customers", Contact],
  ["/rates", "Rate chart", BookOpen],
  ["/agreements", "Vehicle agreements", BookOpen],
  ["/routes", "Locations", MapPin],
  ["/payments", "Payments", Wallet],
  ["/reports", "Reports & exports", FileSpreadsheet],
  ["/settings", "Settings", Settings],
  ["/users", "User management", Shield],
];
export function More({ user, logout }) {
  return (
    <>
      <h1>More</h1>
      <div className="card-grid">
        {user.role !== "DRIVER" &&
          moreItems
            .filter(([url]) => url !== "/users" || user.role === "ADMIN")
            .map(([url, title, Icon]) => (
              <Link key={url} className="card menu-link" to={url}>
                <Icon size={22} />
                {title}
                <span>→</span>
              </Link>
            ))}
        <button className="card menu-link" onClick={logout}>
          <LogOut />
          Sign out
        </button>
      </div>
    </>
  );
}
export default function Shell({ user, logout }) {
  const [quick, setQuick] = useState(false);
  const visible =
    user.role === "DRIVER"
      ? items.filter(([url]) => ["/", "/trips", "/more"].includes(url))
      : items;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" to="/">
          <span className="brand-mark">L</span>
          <span>
            LUCKY<span className="brand-sub">TRANSPORT SERVICES</span>
          </span>
        </Link>
        <p className="sidebar-label">WORKSPACE</p>
        <nav>
          {visible.map(([url, title, Icon]) => (
            <NavLink key={url} to={url} end={url === "/"}>
              <Icon size={20} />
              {title}
            </NavLink>
          ))}
          {user.role !== "DRIVER" &&
            moreItems
              .filter(([url]) => url !== "/users" || user.role === "ADMIN")
              .map(([url, title, Icon]) => (
                <NavLink key={url} to={url}>
                  <Icon size={19} />
                  {title}
                </NavLink>
              ))}
        </nav>
        <div className="sidebar-user">
          <strong>{user.name}</strong>
          <span>{user.role}</span>
          <button className="quiet" onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>
      <div className="main-wrap">
        <header className="topbar">
          <Link className="mobile-brand" to="/">
            LUCKY <span>TRANSPORT</span>
          </Link>
          <span className="muted desktop-only">Operations workspace</span>
          <div className="row">
            <span className="avatar">{user.name[0]}</span>
            <span>
              {user.name} <small>{user.role}</small>
            </span>
          </div>
        </header>
        <main>
          <Outlet />
        </main>
        <footer className="app-footer">
          Lucky Transport Services · Mumbai
        </footer>
      </div>
      <nav className="bottom-nav">
        {visible.map(([url, title, Icon]) => (
          <NavLink key={url} to={url} end={url === "/"}>
            <Icon size={21} />
            <span>{title}</span>
          </NavLink>
        ))}
      </nav>
      {user.role !== "DRIVER" && (
        <button
          className="floating-add"
          aria-label="Quick add"
          onClick={() => setQuick(true)}
        >
          +
        </button>
      )}
      {quick && (
        <div className="modal-backdrop">
          <section className="modal">
            <div className="page-head">
              <h2>Quick add</h2>
              <button className="quiet" onClick={() => setQuick(false)}>
                Close
              </button>
            </div>
            <div className="card-grid">
              {[
                ["/trips/new", "Trip"],
                ["/vehicles?new=1", "Vehicle"],
                ["/drivers?new=1", "Driver"],
                ["/customers?new=1", "Customer"],
              ].map(([url, label]) => (
                <Link
                  className="card menu-link"
                  to={url}
                  key={url}
                  onClick={() => setQuick(false)}
                >
                  + Add {label}
                </Link>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
