import React from "react";
import { Link } from "react-router-dom";
import { useData } from "../hooks/useData";
import { State, date } from "../components/UI";
export default function ExpiryAlerts() {
  const records = useData("/reminders/alerts");
  return (
    <section className="card">
      <div className="page-head">
        <h2>Insurance & PUC alerts</h2>
        <button className="quiet" onClick={records.reload}>
          Refresh
        </button>
      </div>
      <State {...records}>
        {records.data?.length ? (
          <div className="card-grid">
            {records.data.map((a) => (
              <div className="card" key={a.vehicleId + ":" + a.kind}>
                <strong>
                  {a.vehicleNumber} · {a.label}
                </strong>
                <p>
                  {a.daysRemaining < 0
                    ? "Expired " + Math.abs(a.daysRemaining) + " days ago"
                    : a.daysRemaining === 0
                      ? "Expires today"
                      : "Expires in " + a.daysRemaining + " days"}{" "}
                  · {date(a.expiryDate)}
                </p>
                <Link to="/vehicles">Update vehicle expiry</Link>
              </div>
            ))}
          </div>
        ) : (
          <p>
            No insurance or PUC documents expire within the next seven days.
          </p>
        )}
      </State>
    </section>
  );
}
