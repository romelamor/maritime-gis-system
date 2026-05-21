// src/pages/Admin2FASetup.jsx
import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { useNavigate } from "react-router-dom";
import "../assets/css/login.css";

export default function Admin2FASetup() {
  const [qr, setQr] = useState("");
  const [secret, setSecret] = useState("");
  const [otp, setOtp] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  // ==========================
  // LOAD QR + SECRET FROM BACKEND
  // ==========================
  async function loadSetup() {
    try {
      const res = await api.get("/api/auth/2fa/setup/");
      setQr(res.data.qr);
      setSecret(res.data.secret);
    } catch (err) {
      setMessage("Failed to load 2FA setup.");
    }
  }

  // ==========================
  // ACTIVATE 2FA
  // ==========================
  async function activate2FA(e) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const res = await api.post("/api/auth/2fa/activate/", { otp });

      setMessage("🎉 Two-Factor Authentication activated!");

      // Clear session to force secure login
      setTimeout(() => {
        localStorage.removeItem("access");
        localStorage.removeItem("refresh");
        localStorage.removeItem("is_staff");
        localStorage.removeItem("me");
        navigate("/login");
      }, 1500);

    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.detail ||
        "Invalid OTP. Try again.";
      setMessage(msg);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadSetup();
  }, []);

  return (
    <div className="login">
      <form onSubmit={activate2FA}>
        <h2>Set Up Google Authenticator</h2>

        <p>
          Scan the QR code below using the **Google Authenticator App**.
          After scanning, enter the 6-digit verification code.
        </p>

        {message && <p className="error">{message}</p>}

        {/* QR CODE DISPLAY */}
        {qr ? (
          <img
            src={`data:image/png;base64,${qr}`}
            alt="QR Code"
            style={{ width: 220, height: 220, margin: "10px auto" }}
          />
        ) : (
          <p>Loading QR code…</p>
        )}

        {/* SECRET KEY */}
        <p><b>Secret Key:</b> {secret}</p>

        {/* OTP INPUT */}
        <input
          type="text"
          maxLength="6"
          placeholder="Enter 6-digit code"
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          required
        />

        <button type="submit" disabled={loading}>
          {loading ? "Activating…" : "Activate 2FA"}
        </button>
      </form>
    </div>
  );
}
