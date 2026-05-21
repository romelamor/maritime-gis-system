// src/pages/RegisterSuccess.jsx
import React from "react";
import { Link, useLocation } from "react-router-dom";
import "../assets/css/register.css";

export default function RegisterSuccess() {
  const { state } = useLocation();
  const viaState = state?.email || "";
  const viaQuery = new URLSearchParams(window.location.search).get("email") || "";
  const email = viaState || viaQuery;

  return (
    <div className="reg-wrap">
      <div className="reg-card">
        <h2 className="t-center">Registration Submitted 🎉</h2>
        <p className="muted t-center">
          Salamat! Nakapag-submit ka na ng registration.
          <br />Hintayin ang email update — may <strong>up to 7 days</strong> approval window.
        </p>

        <div className="success-box">
          <ul>
            <li>I-check ang inbox/spam folder {email ? <>ng <strong>{email}</strong></> : "ng iyong email"}.</li>
            <li>Kung may kulang na info, makakatanggap ka ng request via email.</li>
            <li>Kapag na-approve, may instructions ka ring matatanggap para mag-set ng password at makapag-login.</li>
          </ul>
        </div>

        <div className="actions-center">
          <Link className="btn btn--primary" to="/login">Go to Login</Link>
          <Link className="btn btn--ghost" to="/">Back to Home</Link>
        </div>
      </div>
    </div>
  );
}
