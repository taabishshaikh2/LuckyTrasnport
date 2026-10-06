import React from "react";
import { Link } from "react-router-dom";
import { Truck, Route, Receipt, IndianRupee, ArrowUpRight } from "lucide-react";
import { useData } from "../hooks/useData";
import { State, currency, date, Badge } from "../components/UI";
export default function Home({ user }) {
  const r = useData("/dashboard");
  if (user.role === "DRIVER")
    return (
      <>
        <h1>Hello, {user.name}</h1>
        <section className="card">
          <h2>Your assigned trips</h2>
          <p>See your current assignments and duty information.</p>
          <Link className="button" to="/trips">
            View trips
          </Link>
        </section>
      </>
    );
  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">LUCKY TRANSPORT SERVICES · MUMBAI</p>
          <h1>Hello, {user.name.split(" ")[0]}</h1>
          <p className="muted">Your operations, all in one place.</p>
        </div>
        <span className="date-label">{date(new Date())}</span>
      </div>
      <section className="welcome">
        <div>
          <span className="eyebrow">KEEP BUSINESS MOVING</span>
          <h2>
            A clear view of every trip.
            <br />A confident start to your day.
          </h2>
          <p>Manage your fleet, review charges and keep billing on track.</p>
          <Link className="button gold" to="/trips/new">
            + Create a trip
          </Link>
        </div>
        <Truck size={96} strokeWidth={1} />
      </section>
      <div className="quick-actions">
        <Link to="/trips/new">
          <Route size={20} /> New trip
        </Link>
        <Link to="/invoices/new">
          <Receipt size={20} /> New invoice
        </Link>
        <Link to="/vehicles">
          <Truck size={20} /> Add vehicle
        </Link>
        <Link to="/import">
          <ArrowUpRight size={20} /> Import Excel
        </Link>
      </div>
      <State {...r}>
        {r.data && (
          <>
            <div className="stats">
              {[
                [Truck, "Active vehicles", r.data.activeVehicles],
                [Route, "Trips this month", r.data.tripsThisMonth],
                [Receipt, "Pending invoices", r.data.pendingInvoices],
                [
                  IndianRupee,
                  "Outstanding amount",
                  currency(r.data.outstanding),
                ],
              ].map(([Icon, label, val]) => (
                <div className="card stat" key={label}>
                  <Icon size={22} />
                  <p>{label}</p>
                  <strong>{val}</strong>
                </div>
              ))}
            </div>
            <div className="dashboard-columns">
              <section>
                <div className="page-head">
                  <h2>Recent trips</h2>
                  <Link to="/trips">View all →</Link>
                </div>
                {r.data.recentTrips.map((t) => (
                  <Link
                    className="card record"
                    key={t._id}
                    to={"/trips/" + t._id}
                  >
                    <div className="row">
                      <strong>
                        {t.tripId} · {t.customerId?.companyName}
                      </strong>
                      <Badge>{t.status}</Badge>
                    </div>
                    <p>
                      {t.pickupLocation} → {t.dropLocation}
                    </p>
                    <div className="row">
                      <span>{t.vehicleNumber}</span>
                      <strong>{currency(t.totalAmount)}</strong>
                    </div>
                  </Link>
                ))}
                {!r.data.recentTrips.length && (
                  <div className="card state">
                    Your first trip starts here.
                    <br />
                    <Link to="/trips/new">Create a trip →</Link>
                  </div>
                )}
              </section>
              <section>
                <div className="page-head">
                  <h2>Recent invoices</h2>
                  <Link to="/invoices">View all →</Link>
                </div>
                {r.data.recentInvoices.map((i) => (
                  <Link
                    className="card record"
                    key={i._id}
                    to={"/invoices/" + i._id}
                  >
                    <span className="record-id">{i.invoiceNumber}</span>
                    <h3>{i.invoicedTo}</h3>
                    <div className="row">
                      <span>Due {date(i.dueDate)}</span>
                      <strong>{currency(i.totalAmount)}</strong>
                    </div>
                  </Link>
                ))}
                {!r.data.recentInvoices.length && (
                  <div className="card state">
                    Invoices will appear after you approve a trip.
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </State>
    </>
  );
}
