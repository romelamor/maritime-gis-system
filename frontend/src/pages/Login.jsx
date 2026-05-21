// src/pages/Login.jsx
import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../lib/api";
import "../assets/css/login.css";

export default function Login() {
  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // ====== Email OTP States ======
  // phase: "login" | "otp"
  const [phase, setPhase] = useState("login");
  const [otpCode, setOtpCode] = useState("");
  const [otpId, setOtpId] = useState(null); // galing sa backend (EmailOTP id)

  const navigate = useNavigate();

  // ====== ENDPOINTS (palitan kung iba path mo sa backend) ======
  const LOGIN_URL = "/api/auth/login-2fa/";          // STEP 1: username + password -> send OTP
  const VERIFY_OTP_URL = "/api/auth/2fa/verify/";    // STEP 2: otp_id + code -> issue tokens
  const ME_URL = "/api/auth/me/";                    // get current user info

  async function fetchMe(accessToken) {
    const { data } = await api.get(ME_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return data;
  }

  // ====== HANDLE LOGIN (Step 1: username + password → send OTP to email) ======
  const handleLogin = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    setOtpCode("");
    setOtpId(null);

    try {
      const payload = {
        username: usernameOrEmail, // backend uses username
        password,
      };

      const res = await api.post(LOGIN_URL, payload);
      const data = res.data || {};

      console.log("login-2fa (email OTP) response:", data);

      // expected response: { otp_id, detail: "OTP sent to your email." }
      if (!data.otp_id) {
        throw new Error(
          data.detail || "No OTP session ID returned. Please check the backend response."
        );
      }

      setOtpId(data.otp_id);
      setPhase("otp");
    } catch (e) {
      console.error("Login error:", e);
      const msg =
        e?.response?.data?.detail ||
        e?.response?.data?.error ||
        e?.message ||
        "Invalid credentials.";
      setErr(msg);
    } finally {
      setLoading(false);
    }
  };

  // ====== HANDLE OTP (Step 2: enter email OTP) ======
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);

    if (!otpId) {
      setErr("Session expired. Please login again.");
      setLoading(false);
      return;
    }

    try {
      console.log("Sending to /api/auth/2fa/verify/:", {
        otp_id: otpId,
        code: otpCode,
      });

      const res = await api.post(VERIFY_OTP_URL, {
        otp_id: otpId,
        code: otpCode,
      });

      const { access, refresh } = res.data || {};

      console.log("2fa-verify (email OTP) response:", res.data);

      if (!access) {
        throw new Error("No access token returned by server.");
      }

      // Save tokens
      // 🔥 CLEAR OLD TOKENS FIRST
      localStorage.clear();

      // 🔥 SAVE IN ALL FORMATS (IMPORTANT)
      localStorage.setItem("access", access);
      localStorage.setItem("access_token", access);
      localStorage.setItem("token", `Bearer ${access}`);

if (refresh) {
  localStorage.setItem("refresh", refresh);
  localStorage.setItem("refresh_token", refresh);
}

// set axios header
api.defaults.headers.common.Authorization = `Bearer ${access}`;

      api.defaults.headers.common.Authorization = `Bearer ${access}`;

      // Fetch /auth/me para makasigurong admin talaga
      const me = await fetchMe(access);

      if (!me.is_staff) {
        setErr("This portal is for administrators only.");
        localStorage.removeItem("access");
        localStorage.removeItem("refresh");
        localStorage.removeItem("is_staff");
        localStorage.removeItem("me");
        return;
      }

      localStorage.setItem("is_staff", "true");
      localStorage.setItem("me", JSON.stringify(me));

      navigate("/dashboard");
    } catch (e) {
      console.error("OTP verify error:", e);
      const msg =
        e?.response?.data?.detail ||
        e?.response?.data?.error ||
        "Invalid or expired code. Please try again.";
      setErr(msg);
    } finally {
      setLoading(false);
    }
  };

  const resetToLogin = () => {
    setPhase("login");
    setOtpCode("");
    setOtpId(null);
    setErr("");
  };

  // ====== UI RENDER ======
  return (
    <div className="login">
      {/* =============== STEP 1: LOGIN FORM (USERNAME + PASSWORD) =============== */}
      {phase === "login" && (
        <form onSubmit={handleLogin}>
          <h2>Admin Login</h2>

          {err && <p className="error">{err}</p>}

          <input
            type="text"
            placeholder="Username"
            value={usernameOrEmail}
            onChange={(e) => setUsernameOrEmail(e.target.value)}
            required
            autoComplete="username"
          />

          <div style={{ position: "relative" }}>
            <input
              type={showPw ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPw((s) => !s)}
              style={{
                position: "absolute",
                right: 8,
                top: 8,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "#666",
                fontSize: "0.85rem",
              }}
            >
            </button>
          </div>

          <div
            className="auth-links"
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginBottom: 8,
            }}
          >
            <Link to="/admin/forgot">Forgot password?</Link>
          </div>

          <button type="submit" disabled={loading}>
            {loading ? "Sending code…" : "Login"}
          </button>
        </form>
      )}

      {/* =============== STEP 2: EMAIL OTP VERIFICATION =============== */}
      {phase === "otp" && (
        <div className="otp-box">
         
          {err && <p className="error">{err}</p>}

          <form onSubmit={handleVerifyOtp}>
          <h2>Email Verification</h2>

          <p>
            We sent a <strong>6-digit verification code</strong> to your
            registered email address. Please enter it below to continue.
          </p>

            <input
              type="text"
              maxLength={6}
              placeholder="Enter 6-digit code"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
              required
            />

            <button type="submit" disabled={loading || otpCode.length < 6}>
              {loading ? "Verifying..." : "Verify & Login"}
            </button>
            
          </form>

         
        </div>
      )}
    </div>
  );
}
