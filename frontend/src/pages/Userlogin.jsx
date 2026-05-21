// src/pages/Userlogin.jsx
import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../lib/api"; // ✅ shared Axios client

// Helper: check if profile is considered "complete"
const isProfileComplete = (p) =>
  !!(p && p.officer_id && p.first_name && p.last_name);

function Userlogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [phase, setPhase] = useState("login"); // "login" | "verify_otp"
  const [otp, setOtp] = useState("");
  const [pendingUserId, setPendingUserId] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  // ===== Helpers for tokens =====
  const saveTokens = (access, refresh, is_admin) => {
    localStorage.setItem("access_token", access);
    localStorage.setItem("refresh_token", refresh);
    localStorage.setItem("token", `Bearer ${access}`);
    localStorage.setItem("access", access);
    localStorage.setItem("refresh", refresh);
    localStorage.setItem("is_admin", String(!!is_admin));

    api.defaults.headers.common.Authorization = `Bearer ${access}`;
  };

  const clearTokens = () => {
    [
      "access_token",
      "refresh_token",
      "token",
      "access",
      "refresh",
      "is_admin",
    ].forEach((k) => localStorage.removeItem(k));
    delete api.defaults.headers.common.Authorization;
  };

  const resetState = () => {
    setPhase("login");
    setOtp("");
    setPendingUserId(null);
    setError("");
  };

  // ========== STEP 1: username + password ==========
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    setError("");
    setLoading(true);

    try {
      const res = await api.post(
        "/api/user/login-otp/",
        { username: username.trim(), password },
        { validateStatus: () => true }
      );

      if (res.status !== 200) {
        // direct messages from backend
        if (res.status === 401) {
          setError(res.data?.detail || "Wrong username or password.");
          return;
        }
        if (res.status === 403) {
          setError(res.data?.detail || "Hindi pinapayagan ang login.");
          return;
        }
        setError(res.data?.detail || "Hindi ma-proseso ang login ngayon.");
        return;
      }

      // expected: { requires_otp: true, user_id: ..., detail: ... }
      const { requires_otp, user_id } = res.data || {};

      if (!requires_otp || !user_id) {
        setError("Walang natanggap na OTP session. Pakisubukan muli.");
        return;
      }

      setPendingUserId(user_id);
      setPhase("verify_otp");
      setOtp("");
    } catch (err) {
      console.error(err);
      setError("May problema sa network o server. Pakisubukan muli.");
    } finally {
      setLoading(false);
    }
  };

  // ========== STEP 2: OTP ==========
  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    setError("");
    setLoading(true);

    try {
      const res = await api.post(
        "/api/user/login-otp/verify/",
        { user_id: pendingUserId, code: otp.trim() },
        { validateStatus: () => true }
      );

      if (res.status !== 200) {
        if (res.status === 400) {
          setError(res.data?.detail || "Invalid or expired code.");
          return;
        }
        if (res.status === 404) {
          setError("User not found. Please try logging in again.");
          return;
        }
        setError(res.data?.detail || "Hindi ma-verify ang OTP.");
        return;
      }

      const { access, refresh, is_admin } = res.data || {};

      if (is_admin) {
        setError("Admin accounts are not allowed to login here.");
        return;
      }

      if (!access || !refresh) {
        setError("Walang natanggap na access/refresh token. Pakisubukan muli.");
        return;
      }

      // Save tokens
      saveTokens(access, refresh, is_admin);

      // ===== Validate profile via /api/personnel/me/ =====
      let profile = null;
      try {
        const profRes = await api.get("/api/personnel/me/", {
          headers: { Authorization: `Bearer ${access}` },
          validateStatus: () => true,
        });

        if (profRes.status === 403) {
          const code = (profRes.data?.code || "").toUpperCase();
          if (
            code === "ARCHIVED" ||
            /archived/i.test(profRes.data?.detail || "")
          ) {
            clearTokens();
            setError(
              "Na-archive ang account na ito. Makipag-ugnayan sa admin para maibalik."
            );
            return;
          }
          clearTokens();
          setError(profRes.data?.detail || "Hindi pinapayagan ang login.");
          return;
        }

        if (profRes.status === 200) {
          profile = profRes.data || null;
          if (profile && profile.is_archived === true) {
            clearTokens();
            setError(
              "Na-archive ang account na ito. Makipag-ugnayan sa admin para maibalik."
            );
            return;
          }
        } else if (profRes.status === 401 || profRes.status === 404) {
          console.warn(
            "Profile endpoint returned",
            profRes.status,
            profRes.data
          );
        } else if (profRes.status >= 500) {
          console.warn(
            "Profile endpoint error:",
            profRes.status,
            profRes.data
          );
        }
      } catch (profErr) {
        console.warn("Profile check failed; continuing login...", profErr);
      }

      // ===== Redirect =====
      if (!isProfileComplete(profile)) {
        navigate("/UserProfile");
      } else {
        navigate("/UserDashboard");
      }
    } catch (err) {
      console.error(err);
      setError("May problema sa network o server. Pakisubukan muli.");
    } finally {
      setLoading(false);
    }
  };

  // ========== RENDER ==========
  return (
    <div className="login">
      {phase === "login" && (
        <form onSubmit={handleLoginSubmit} noValidate>
          <h2>Welcome Back</h2>
          <p className="subtitle">Login to your account</p>

          {error ? (
            <div
              role="alert"
              style={{
                marginBottom: 12,
                padding: "10px 12px",
                borderRadius: 8,
                background: "#fef2f2",
                color: "#991b1b",
                border: "1px solid #fecaca",
                fontSize: 14,
              }}
            >
              {error}
            </div>
          ) : null}

          <input
            type="text"
            placeholder="Enter your username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />

          <input
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />

          <div className="form-links">
            <Link to="/UserForgotPassword">Forgot Password?</Link>
          </div>

          <button type="submit" disabled={loading} aria-busy={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>

          <div className="form-links">
          </div>

        </form>
      )}

      {phase === "verify_otp" && (
        <form onSubmit={handleOtpSubmit} noValidate>
          <h2>Email Verification</h2>
          <p className="subtitle">
            Enter the 6-digit code sent to your registered email.
          </p>

          {error ? (
            <div
              role="alert"
              style={{
                marginBottom: 12,
                padding: "10px 12px",
                borderRadius: 8,
                background: "#fef2f2",
                color: "#991b1b",
                border: "1px solid #fecaca",
                fontSize: 14,
              }}
            >
              {error}
            </div>
          ) : null}

          <input
            type="text"
            maxLength={6}
            placeholder="123456"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            required
          />

          <button
            type="submit"
            disabled={loading || otp.length < 6}
            aria-busy={loading}
          >
            {loading ? "Verifying..." : "Verify Code"}
          </button>

          <button
            type="button"
            style={{
              marginTop: 12,
              background: "transparent",
              border: "none",
              color: "#2563eb",
              cursor: "pointer",
              textDecoration: "underline",
            }}
            onClick={resetState}
            disabled={loading}
          >
            ← Back to login
          </button>
        </form>
      )}
    </div>
  );
}

export default Userlogin;
