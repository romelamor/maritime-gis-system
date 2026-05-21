// src/pages/UserRegistration.jsx
import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../lib/api";
import "../assets/css/register.css";

const REGISTER_ENDPOINT = "/api/registrations/"; // make sure backend accepts these fields

const ranks = [
  "PO1","PO2","PO3","SPO1","SPO2","SPO3","SPO4","P/C Insp","P/S Insp","P/Cpt","P/Maj","P/LtCol","P/Col"
];

export default function UserRegistration() {
  const nav = useNavigate();
  const [form, setForm] = useState({
    // login/account fields
    username: "",
    password: "",
    password2: "",
    // registration fields
    first_name: "",
    middle_name: "",
    last_name: "",
    email: "",
    badge_no: "",
    rank: "",
    station: "",
    id_image: null,
  });

  const [preview, setPreview] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [serverErrors, setServerErrors] = useState({});

  const update = (key, val) => setForm((s) => ({ ...s, [key]: val }));

  const onPickFile = (file) => {
    if (!file) return;
    update("id_image", file);
    const url = URL.createObjectURL(file);
    setPreview(url);
  };

  const pwIssues = useMemo(() => {
    const issues = [];
    if (form.password.length < 8) issues.push("At least 8 characters");
    if (!/[A-Za-z]/.test(form.password)) issues.push("Include a letter");
    if (!/[0-9]/.test(form.password)) issues.push("Include a number");
    if (form.password !== form.password2) issues.push("Passwords do not match");
    return issues;
  }, [form.password, form.password2]);

  const canSubmit = useMemo(() => {
    const required = [
      "username", "password", "password2",
      "first_name", "last_name", "email", "badge_no", "rank", "station"
    ];
    const allFilled = required.every((k) => String(form[k]).trim().length > 0);
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
    return allFilled && emailOk && !!form.id_image && pwIssues.length === 0 && !submitting;
  }, [form, submitting, pwIssues]);

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setServerErrors({});

    try {
      const fd = new FormData();
      // account creds
      fd.append("username", form.username);
      fd.append("password", form.password);
      // you can append password2 if your backend validates both
      // fd.append("password2", form.password2);

      // profile/registration data
      fd.append("first_name", form.first_name);
      fd.append("middle_name", form.middle_name);
      fd.append("last_name", form.last_name);
      fd.append("email", form.email);
      fd.append("badge_no", form.badge_no);
      fd.append("rank", form.rank);
      fd.append("station", form.station);
      if (form.id_image) fd.append("valid_id", form.id_image); // NOTE: if backend expects `valid_id`, rename key here.

      await api.post(REGISTER_ENDPOINT, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      // success → go to success screen; user cannot login yet until approved
      nav("/register/success", { state: { email: form.email } });
    } catch (err) {
      const data = err?.response?.data || {};
      setServerErrors(data);
    } finally {
      setSubmitting(false);
    }
  };

  const err = (k) => serverErrors?.[k];

  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);

  return (
    <div className="reg-wrap">
      <form className="reg-card" onSubmit={submit}>
        <h2 className="t-center">Officer Registration</h2>
        <p className="muted t-center">
          Create your account and submit for verification. You’ll only be able to log in after admin approval (≤ 7 days).
        </p>

        {/* === Account section === */}
        <h3 className="section-title">Account</h3>
        <div className="grid">
          <div className="field">
            <label>Username<span className="req">*</span></label>
            <input
              value={form.username}
              onChange={(e) => update("username", e.target.value)}
              placeholder="e.g. juan.dc"
            />
            {err("username") && <div className="err">{String(err("username"))}</div>}
          </div>
          <div className="field">
            <label>Password<span className="req">*</span></label>
            <div className="pw-row">
              <input
                type={showPw ? "text" : "password"}
                value={form.password}
                onChange={(e) => update("password", e.target.value)}
                placeholder="Create a strong password"
              />
              <button
                className="btn btn--ghost"
                type="button"
                onClick={() => setShowPw((s) => !s)}
                style={{ whiteSpace: "nowrap" }}
              >
                {showPw ? "Hide" : "Show"}
              </button>
            </div>
            {err("password") && <div className="err">{String(err("password"))}</div>}
          </div>
        </div>

        <div className="grid">
          <div className="field">
            <label>Confirm Password<span className="req">*</span></label>
            <div className="pw-row">
              <input
                type={showPw2 ? "text" : "password"}
                value={form.password2}
                onChange={(e) => update("password2", e.target.value)}
                placeholder="Re-type password"
              />
              <button
                className="btn btn--ghost"
                type="button"
                onClick={() => setShowPw2((s) => !s)}
                style={{ whiteSpace: "nowrap" }}
              >
                {showPw2 ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          <div className="field">
            <label>Password Tips</label>
            <div className="tiny muted">
              {pwIssues.length === 0 ? "Looks good ✅" : (
                <ul style={{ marginLeft: 16 }}>
                  {pwIssues.map((i) => <li key={i}>{i}</li>)}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* === Identity section === */}
        <h3 className="section-title">Identity</h3>
        <div className="grid">
          <div className="field">
            <label>First Name<span className="req">*</span></label>
            <input
              value={form.first_name}
              onChange={(e) => update("first_name", e.target.value)}
              placeholder="Juan"
            />
            {err("first_name") && <div className="err">{String(err("first_name"))}</div>}
          </div>
          <div className="field">
            <label>Middle Name</label>
            <input
              value={form.middle_name}
              onChange={(e) => update("middle_name", e.target.value)}
              placeholder="Santos"
            />
            {err("middle_name") && <div className="err">{String(err("middle_name"))}</div>}
          </div>
          <div className="field">
            <label>Last Name<span className="req">*</span></label>
            <input
              value={form.last_name}
              onChange={(e) => update("last_name", e.target.value)}
              placeholder="Dela Cruz"
            />
            {err("last_name") && <div className="err">{String(err("last_name"))}</div>}
          </div>
        </div>

        <div className="grid">
          <div className="field">
            <label>Email<span className="req">*</span></label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="juandelacruz@pnp.gov.ph"
            />
            {err("email") && <div className="err">{String(err("email"))}</div>}
          </div>
          <div className="field">
            <label>Badge No.<span className="req">*</span></label>
            <input
              value={form.badge_no}
              onChange={(e) => update("badge_no", e.target.value)}
              placeholder="e.g. 123456"
            />
            {err("badge_no") && <div className="err">{String(err("badge_no"))}</div>}
          </div>
        </div>

        <div className="grid">
          <div className="field">
            <label>Rank<span className="req">*</span></label>
            <select value={form.rank} onChange={(e) => update("rank", e.target.value)}>
              <option value="">— Select rank —</option>
              {ranks.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            {err("rank") && <div className="err">{String(err("rank"))}</div>}
          </div>
          <div className="field">
            <label>Station / Unit<span className="req">*</span></label>
            <input
              value={form.station}
              onChange={(e) => update("station", e.target.value)}
              placeholder="e.g. Maritime Group HQ"
            />
            {err("station") && <div className="err">{String(err("station"))}</div>}
          </div>
        </div>

        <div className="field">
          <label>Valid ID (image)<span className="req">*</span></label>
          <div className="file-row">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => onPickFile(e.target.files?.[0] || null)}
            />
            {preview && <img className="thumb" src={preview} alt="ID preview" />}
          </div>
          {err("id_image") && <div className="err">{String(err("id_image"))}</div>}
        </div>

        {"detail" in serverErrors && <div className="alert alert--error">{String(serverErrors.detail)}</div>}

        <div className="actions">
          <button className="btn btn--primary" disabled={!canSubmit}>
            {submitting ? "Submitting…" : "Submit for Verification"}
          </button>
          <Link className="btn btn--ghost" to="/login">I already have an account</Link>
        </div>

        <p className="tiny muted">
          By submitting, you agree that your details will be used for verification. Processing may take up to 7 days.
        </p>
      </form>
    </div>
  );
}
