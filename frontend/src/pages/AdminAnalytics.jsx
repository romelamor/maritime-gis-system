import React, { useEffect, useMemo, useRef, useState } from "react";
import "../assets/css/admin-maps.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faHome,
  faUser,
  faFileInvoice,
  faMapLocation,
  faChartLine,
  faBell,
  faRightFromBracket,
  faBoxArchive,
} from "@fortawesome/free-solid-svg-icons";
import { Link, useNavigate } from "react-router-dom";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";

/* ================= CONFIG ================= */
const API_BASE = (import.meta.env.VITE_API_BASE || "https://maritime-backend-0gib.onrender.com").replace(/\/$/, "");

/* ================= AUTH ================= */
function getStoredToken() {
  return (
    localStorage.getItem("access") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    ""
  );
}

function authHeader() {
  const raw = getStoredToken();
  if (!raw) return {};
  if (/^(Bearer|Token)\s/i.test(raw)) return { Authorization: raw };
  if (/^[\w-]+\.[\w-]+\.[\w-]+$/.test(raw)) return { Authorization: `Bearer ${raw}` };
  return { Authorization: raw };
}

async function safeFetchJson(url, headers = {}) {
  const res = await fetch(url, { headers: { ...headers } });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { ok: res.ok, status: res.status, json, text };
}

function clearAuth() {
  localStorage.removeItem("token");
  localStorage.removeItem("access_token");
  localStorage.removeItem("access");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("refresh");
}

/* ================= CONSTS ================= */
const CRIME_TYPES = [
  "Theft",
  "Robbery",
  "Assault",
  "Homicide",
  "Illegal Fishing",
  "Smuggling",
  "Drugs",
  "Vandalism",
  "Fraud",
  "Others",
];

const PIE_COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#7c3aed", "#0ea5e9"];
const safeNum = (v) => (Number.isFinite(+v) ? +v : 0);
const norm = (s) => (s || "").toString().replace(/\s+/g, " ").trim().toLowerCase();

/** ✅ Region IV-A only */
const REGION_LABEL = "Region IV-A (CALABARZON)";
const REGION_PARAM_VALUE = "IV-A";
const REGION_IVA_PROVINCES = new Set(["Cavite", "Laguna", "Batangas", "Rizal", "Quezon"]);

/* ================= PIE LABEL (NUMBER INSIDE) ================= */
// Draw number inside pie slice. Hides label if slice too small.
const RADIAN = Math.PI / 180;
function renderValueInsidePie({ cx, cy, midAngle, innerRadius, outerRadius, value, percent }) {
  if (!value || percent < 0.04) return null;

  const r = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="#fff"
      textAnchor="middle"
      dominantBaseline="central"
      style={{ fontSize: 11, fontWeight: 600, pointerEvents: "none" }}
    >
      {`${value} (${(percent * 100).toFixed(0)}%)`}
    </text>
  );
}

const AdminAnalytics = () => {
  const navigate = useNavigate();

  /* Sidebar */
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [submenuOpen, setSubmenuOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  /* Auth */
  const [authChecked, setAuthChecked] = useState(false);

  /* Filters */
  const [province, setProvince] = useState(""); // blank = "All (Region IV-A)"
  const [crimeType, setCrimeType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  /* PSGC provinces */
  const [psgcProvinces, setPsgcProvinces] = useState([]);

  /* Series */
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [dailyLabels, setDailyLabels] = useState([]);
  const [dailyValues, setDailyValues] = useState([]);
  const [provLabels, setProvLabels] = useState([]);
  const [provValues, setProvValues] = useState([]);
  const [metaCount, setMetaCount] = useState(0);

  /* Breakdown */
  const [bLoading, setBLoading] = useState(false);
  /* ================= OFFICER ANALYTICS ================= */

  const [officerRankLabels, setOfficerRankLabels] = useState([]);
  const [officerRankValues, setOfficerRankValues] = useState([]);

  const [officerStationLabels, setOfficerStationLabels] = useState([]);
  const [officerStationValues, setOfficerStationValues] = useState([]);

  const [officerGenderLabels, setOfficerGenderLabels] = useState([]);
  const [officerGenderValues, setOfficerGenderValues] = useState([]);

  const [oLoading, setOLoading] = useState(false);
  const [oError, setOError] = useState("");
  const [bError, setBError] = useState("");
  const [byCrimeLabels, setByCrimeLabels] = useState([]);
  const [byCrimeValues, setByCrimeValues] = useState([]);
  const [byStatusLabels, setByStatusLabels] = useState([]);
  const [byStatusValues, setByStatusValues] = useState([]);
  const [byCityLabels, setByCityLabels] = useState([]);
  const [byCityValues, setByCityValues] = useState([]);

  /* Heatmap legend overlay */
  const [showOverlay, setShowOverlay] = useState(true);
  const heatmapCardRef = useRef(null);

  // ✅ centralized: handle 401
  const handleUnauthorized = () => {
    clearAuth();
    navigate("/login", { replace: true, state: { reason: "expired" } });
  };

  /* Guard */
  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }
    setAuthChecked(true);
  }, [navigate]);

  /* PSGC provinces (filter to Region IV-A only) */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { ok, json } = await safeFetchJson("https://psgc.cloud/api/provinces");
        if (!alive) return;
        if (!ok || !Array.isArray(json)) return;

        const list = json
          .map((p) => ({ code: p.code, name: p.name }))
          .filter((p) => REGION_IVA_PROVINCES.has(p.name))
          .sort((a, b) => a.name.localeCompare(b.name));

        setPsgcProvinces(list);
      } catch {
        // ignore
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  /* Query (always Region IV-A) */
  const qs = useMemo(() => {
    const p = new URLSearchParams();

    // ✅ always force Region IV-A scope
    p.set("region", REGION_PARAM_VALUE);

    // optional filters
    if (province) p.set("province", province);
    if (crimeType) p.set("crime_type", crimeType);
    if (dateFrom) p.set("date_from", dateFrom);
    if (dateTo) p.set("date_to", dateTo);

    return p.toString();
  }, [province, crimeType, dateFrom, dateTo]);

  /* URLs */
  const seriesURL = `${API_BASE}/api/analytics/series/${qs ? `?${qs}` : ""}`;
  const breakdownURL = `${API_BASE}/api/analytics/breakdown/${qs ? `?${qs}` : ""}`;
  const heatmapURL = `${API_BASE}/api/analytics/heatmap/${qs ? `?${qs}` : ""}`;

  /* Fetch series */
  const fetchSeries = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await fetch(seriesURL, {
        headers: { "Content-Type": "application/json", ...authHeader() },
      });

      if (res.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!res.ok) {
        const body = await res.text();
        console.error("SERIES ERROR", res.status, seriesURL, body);
        throw new Error(`Series HTTP ${res.status}`);
      }

      const json = await res.json();
      const d = json?.dailyIncidents || { labels: [], values: [] };
      const v = json?.victimsByProvince || { labels: [], values: [] };

      setDailyLabels(Array.isArray(d.labels) ? d.labels : []);
      setDailyValues(Array.isArray(d.values) ? d.values : []);
      setProvLabels(Array.isArray(v.labels) ? v.labels : []);
      setProvValues(Array.isArray(v.values) ? v.values : []);
      setMetaCount(Number.isFinite(+json?.meta?.count) ? +json.meta.count : 0);
    } catch (e) {
      console.error("fetch series error", e);
      setError("Di makuha ang analytics series. (Check backend /api/analytics/series/).");
      setDailyLabels([]);
      setDailyValues([]);
      setProvLabels([]);
      setProvValues([]);
      setMetaCount(0);
    } finally {
      setLoading(false);
    }
  };

  /* Fetch breakdown */
  const fetchBreakdown = async () => {
    try {
      setBLoading(true);
      setBError("");

      const { ok, status, json, text } = await safeFetchJson(breakdownURL, {
        "Content-Type": "application/json",
        ...authHeader(),
      });

      if (status === 401) {
        handleUnauthorized();
        return;
      }

      if (!ok) {
        console.error("BREAKDOWN ERROR", status, breakdownURL, text);
        setBError(
          status === 404
            ? "Missing endpoint: /api/analytics/breakdown/ (needed for pie + insights)."
            : `Breakdown failed (HTTP ${status}).`
        );
        setByCrimeLabels([]);
        setByCrimeValues([]);
        setByStatusLabels([]);
        setByStatusValues([]);
        setByCityLabels([]);
        setByCityValues([]);
        return;
      }

      const bc = json?.byCrimeType || { labels: [], values: [] };
      const bs = json?.byStatus || { labels: [], values: [] };
      const bcity = json?.byCity || { labels: [], values: [] };

      setByCrimeLabels(Array.isArray(bc.labels) ? bc.labels : []);
      setByCrimeValues(Array.isArray(bc.values) ? bc.values : []);
      setByStatusLabels(Array.isArray(bs.labels) ? bs.labels : []);
      setByStatusValues(Array.isArray(bs.values) ? bs.values : []);
      setByCityLabels(Array.isArray(bcity.labels) ? bcity.labels : []);
      setByCityValues(Array.isArray(bcity.values) ? bcity.values : []);
    } catch (e) {
      console.error("fetch breakdown error", e);
      setBError("Breakdown analytics failed to load.");
    } finally {
      setBLoading(false);
    }
  };
  /* ================= FETCH POLICE OFFICERS ================= */

  const fetchOfficerAnalytics = async () => {
    try {

      setOLoading(true);

      const res = await fetch(`${API_BASE}/api/personnel/`, {
        headers: authHeader(),
      });

      if (res.status === 401) {
        handleUnauthorized();
        return;
      }

      const json = await res.json();
      const data = json.results || [];

      const rankMap = {};
      const stationMap = {};
      const genderMap = {};

      data.forEach((p) => {

        const rank = p.section || "Unknown";
        const station = p.officer_type || "Unknown";
        const gender = p.sex || "Unknown";

        rankMap[rank] = (rankMap[rank] || 0) + 1;
        stationMap[station] = (stationMap[station] || 0) + 1;
        genderMap[gender] = (genderMap[gender] || 0) + 1;

      });

      setOfficerRankLabels(Object.keys(rankMap));
      setOfficerRankValues(Object.values(rankMap));

      setOfficerStationLabels(Object.keys(stationMap));
      setOfficerStationValues(Object.values(stationMap));

      setOfficerGenderLabels(Object.keys(genderMap));
      setOfficerGenderValues(Object.values(genderMap));

    } catch (err) {

      console.error(err);

    } finally {

      setOLoading(false);

    }
  };

  useEffect(() => {
    if (!authChecked) return;
    fetchSeries();
    fetchBreakdown();
    fetchOfficerAnalytics();
  }, [qs, authChecked]);

  /* Derived */
  const dateRange = useMemo(() => {
    if (dateFrom || dateTo) return `${dateFrom || "—"} → ${dateTo || "—"}`;
    if (!dailyLabels.length) return "—";
    return `${dailyLabels[0]} → ${dailyLabels[dailyLabels.length - 1]}`;
  }, [dailyLabels, dateFrom, dateTo]);

  const dailySeries = useMemo(
    () => (dailyLabels || []).map((d, i) => ({ date: d, incidents: safeNum(dailyValues[i]) })),
    [dailyLabels, dailyValues]
  );

  const provSeries = useMemo(
    () => (provLabels || []).map((p, i) => ({ province: p, incidents: safeNum(provValues[i]) })),
    [provLabels, provValues]
    
  );
  /* ================= OFFICER SERIES ================= */

  const officerRankSeries = useMemo(
    () =>
      officerRankLabels.map((r, i) => ({
        name: r,
        value: safeNum(officerRankValues[i]),
      })),
    [officerRankLabels, officerRankValues]
  );

  const officerStationSeries = useMemo(
    () =>
      officerStationLabels.map((s, i) => ({
        name: s,
        value: safeNum(officerStationValues[i]),
      })),
    [officerStationLabels, officerStationValues]
  );

  const officerGenderSeries = useMemo(
    () =>
      officerGenderLabels.map((g, i) => ({
        name: g,
        value: safeNum(officerGenderValues[i]),
      })),
    [officerGenderLabels, officerGenderValues]
  );

  const crimePieData = useMemo(
    () =>
      (byCrimeLabels || [])
        .map((name, i) => ({ name, value: safeNum(byCrimeValues[i]) }))
        .filter((x) => x.value > 0),
    [byCrimeLabels, byCrimeValues]
  );

  const statusPieData = useMemo(
    () =>
      (byStatusLabels || [])
        .map((name, i) => ({ name, value: safeNum(byStatusValues[i]) }))
        .filter((x) => x.value > 0),
    [byStatusLabels, byStatusValues]
  );

  // ✅ labels for Generated Result (aligned to dropdowns)
  const scopeProvinceLabel = useMemo(() => (province ? province : REGION_LABEL), [province]);
  const scopeCrimeLabel = useMemo(
    () => (crimeType ? crimeType : "All Crime/Incidents"),
    [crimeType]
  );

  const top2Cities = useMemo(() => {
    const rows = (byCityLabels || []).map((name, i) => ({ name, count: safeNum(byCityValues[i]) }));
    return rows.sort((a, b) => b.count - a.count).slice(0, 2);
  }, [byCityLabels, byCityValues]);

  // ✅ UPDATED: Generated Result now respects Province + Crime dropdown selection
  const generatedResult = useMemo(() => {
    // if backend returns no city breakdown
    if (!top2Cities.length) {
      return `Walang available na city/municipality result para sa "${scopeCrimeLabel}" sa ${scopeProvinceLabel}.`;
    }

    // Top 1 only
    if (top2Cities.length === 1) {
      const [a] = top2Cities;
      return `Para sa "${scopeCrimeLabel}" sa ${scopeProvinceLabel}, ang may pinakamataas na reports ay ${a.name} na may total na ${a.count}.`;
    }

    // Top 2
    const [a, b] = top2Cities;
    return `Para sa "${scopeCrimeLabel}" sa ${scopeProvinceLabel}, sa ${a.name} ang total reports ay ${a.count} habang sa ${b.name} ay ${b.count}.`;
  }, [top2Cities, scopeCrimeLabel, scopeProvinceLabel]);

  const unresolvedRate = useMemo(() => {
    const total = statusPieData.reduce((s, r) => s + r.value, 0);
    if (!total) return null;
    const unsolved = statusPieData.find((x) => norm(x.name) === "unsolved")?.value || 0;
    return (unsolved / total) * 100;
  }, [statusPieData]);

  const nowStamp = new Date().toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  if (!authChecked) return null;

  return (
    <div className="admin-analytics-page">
      {/* Top Navigation */}
      <div className="topnav">
        <div className="menu-icon" onClick={() => setSidebarOpen((s) => !s)}>
          ☰
        </div>
        <div className="nav-title">
          <FontAwesomeIcon icon={faBell} style={{ fontSize: 18 }} />
        </div>
      </div>

      
      <div className="container">
        {/* Sidebar */}
        <aside className={`sidebar ${!sidebarOpen ? "collapsed" : ""}`}>
          <div className="logo-section">
            <img src="/assets/logo.png" alt="Logo" />
            <p>
              <strong>Admin</strong>
              <br />
              Dashboard
            </p>
          </div>

          <ul className="nav-links">
            <li>
              <Link to="/dashboard">
                <FontAwesomeIcon icon={faHome} /> Home
              </Link>
            </li>

            <li>
              <div
                className="submenu-toggle"
                onClick={() => setUserMenuOpen((s) => !s)}
              >
                <FontAwesomeIcon icon={faUser} /> User Management
              </div>

              {userMenuOpen && (
                <ul className="submenu">
                  <li>
                    <Link to="/adminInfo">Police Officers</Link>
                  </li>
                  <li>
                    <Link to="/AdminVerifications">Account Manager</Link>
                  </li>
                </ul>
              )}
            </li>


            <li>
              <div className="submenu-toggle" onClick={() => setSubmenuOpen((s) => !s)}>
                <FontAwesomeIcon icon={faFileInvoice} /> Crime Reports
              </div>
              {submenuOpen && (
                <ul className="submenu">
                  <li>
                    <Link to="/VictimeSupectTable">View Reports</Link>
                  </li>
                  <li>
                    <Link to="/AdminCrime">Add Reports</Link>
                  </li>

                </ul>
              )}
            </li>

            <li>
              <Link to="/AdminMaps">
                <FontAwesomeIcon icon={faMapLocation} /> Maps
              </Link>
            </li>
            <li>
              <Link to="/AdminAnalytics">
                <FontAwesomeIcon icon={faChartLine} /> Analytics
              </Link>
            </li>

            <li>
              <div className="submenu-toggle" onClick={() => setArchiveOpen((s) => !s)}>
                <FontAwesomeIcon icon={faBoxArchive} /> Archive
              </div>
              {archiveOpen && (
                <ul className="submenu">
                  <li>
                    <Link to="/AdminArchivedReports">Archived Reports</Link>
                  </li>
                  <li>
                    <Link to="/AdminArchivedInfo">Archived User</Link>
                  </li>
                </ul>
              )}
            </li>

        
            <li>
              <Link to="/logout" className="logout">
                <FontAwesomeIcon icon={faRightFromBracket} /> Logout
              </Link>
            </li>
          </ul>
        </aside>

        {/* Main */}
        <main className="main-content">
          <h1 style={{ marginBottom: 10 }}>Analytics {REGION_LABEL}</h1>

          {/* Filters */}
          <div className="card analytics-filter-card">
            <div className="grid" style={{ alignItems: "end" }}>
              <div className="input-group">
                <label>Region</label>
                <input value={REGION_LABEL} disabled readOnly />
              </div>

              <div className="input-group">
                <label>Province (IV-A only)</label>
                <select value={province} onChange={(e) => setProvince(e.target.value)}>
                  <option value="">All (Region IV-A)</option>
                  {psgcProvinces.map((p) => (
                    <option key={p.code} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="input-group">
                <label>Crime/Incident Type</label>
                <select value={crimeType} onChange={(e) => setCrimeType(e.target.value)}>
                  <option value="">All</option>
                  {CRIME_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="input-group">
                <label>Date From</label>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>

              <div className="input-group">
                <label>Date To</label>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
            </div>

            {error ? <div className="alert" style={{ marginTop: 10 }}>{error}</div> : null}
            {bError ? <div className="alert" style={{ marginTop: 10 }}>{bError}</div> : null}

            <small style={{ color: "#6b7280" }}>
              Scope: <b>{REGION_LABEL}</b> · Range: <b>{dateRange}</b> · Total Reports:{" "}
              <b>{loading ? "…" : metaCount}</b>
            </small>
          </div>

          <section className="analytics-cluster">
            <div className="analytics-section-head">
              <h2>Incident Analytics</h2>
              <p>Crime reports, density, trend, and status insights for {REGION_LABEL}.</p>
            </div>

            <div className="analytics-dashboard-grid analytics-dashboard-grid-incidents">
              <div className="card dash-map dash-hero" ref={heatmapCardRef}>
                <div className="dash-card-head">
                  <div>
                    <div className="dash-title">Crime Density Heatmap</div>
                    <div className="dash-sub">Scope: {REGION_LABEL} · Range: {dateRange}</div>
                  </div>

                  <button type="button" className="btn-toggle" onClick={() => setShowOverlay((s) => !s)}>
                    {showOverlay ? "Hide Legend" : "Show Legend"}
                  </button>
                </div>

                <div className="dash-map-wrap">
                  <iframe title="Heatmap" src={heatmapURL} className="dash-iframe" />
                  {showOverlay && (
                    <div className="dash-map-legend">
                      <div className="legend-title">Legend</div>
                      <div className="legend-row"><span className="dot low" /> Low Density</div>
                      <div className="legend-row"><span className="dot mid" /> Medium Density</div>
                      <div className="legend-row"><span className="dot high" /> High Density</div>
                      <div className="legend-note">
                        Updated: {nowStamp}
                        <br />
                        Base Reports: <b>{loading ? "…" : metaCount}</b>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="card dash-kpis dash-side">
                <div className="dash-title">Summary</div>
                <div className="kpi-grid">
                  <div className="kpi-box">
                    <div className="kpi-label">Total Reports</div>
                    <div className="kpi-val">{loading ? "…" : metaCount}</div>
                  </div>

                  <div className="kpi-box">
                    <div className="kpi-label">Unsolved Rate</div>
                    <div className="kpi-val">
                      {bLoading ? "…" : unresolvedRate == null ? "—" : `${unresolvedRate.toFixed(1)}%`}
                    </div>
                  </div>

                  <div className="kpi-box" style={{ gridColumn: "span 2" }}>
                    <div className="kpi-label">Generated Result</div>
                    <div className="kpi-val small">{bLoading ? "Loading…" : generatedResult}</div>
                  </div>
                </div>
              </div>

              <div className="card dash-pie dash-compact dash-crime-types">
                <div className="dash-title">Crime Type Distribution</div>
                <div className="pie-wrap">
                  {crimePieData.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={crimePieData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={55}
                          outerRadius={95}
                          labelLine={false}
                          label={renderValueInsidePie}
                        >
                          {crimePieData.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend
                          iconSize={8}
                          wrapperStyle={{ fontSize: 10, lineHeight: "1.2" }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="empty-note">No data (check breakdown endpoint / filters).</div>
                  )}
                </div>
              </div>

              <div className="card dash-pie dash-compact">
                <div className="dash-title">Case Status Breakdown</div>
                <div className="pie-wrap">
                  {statusPieData.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusPieData}
                          dataKey="value"
                          nameKey="name"
                          outerRadius={100}
                          labelLine={false}
                          label={renderValueInsidePie}
                        >
                          {statusPieData.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="empty-note">No data (check breakdown endpoint / filters).</div>
                  )}
                </div>
              </div>

              <div className="card dash-mini dash-wide">
                <div className="dash-title">Daily Trend (Crime/Incidents per Date)</div>
                <div className="chart-wrap">
                  {dailySeries.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={dailySeries} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="incidents" name="Crime/Incidents" strokeWidth={3} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="empty-note">No daily trend data.</div>
                  )}
                </div>
              </div>

              <div className="card dash-mini dash-feature dash-province-wide">
                <div className="dash-title">Top Provinces (Incidents)</div>
                <div className="chart-wrap">
                  {provSeries.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={provSeries} margin={{ top: 10, right: 20, left: 0, bottom: 42 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="province" tick={{ fontSize: 11 }} interval={0} angle={-18} textAnchor="end" height={60} />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="incidents" name="Crime/Incidents" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="empty-note">No province data.</div>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="analytics-cluster">
            <div className="analytics-section-head">
              <h2>Officer Analytics</h2>
              <p>Personnel distribution by station, rank, and gender.</p>
            </div>

            <div className="analytics-dashboard-grid analytics-dashboard-grid-officers">
              <div className="card dash-mini dash-half">
                <div className="dash-title">Officers per Station</div>
                <div className="chart-wrap">
                  {officerStationSeries.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={officerStationSeries} margin={{ top: 10, right: 12, left: 0, bottom: 34 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" interval={0} />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="value" name="Officers" fill="#16a34a" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="empty-note">No station data.</div>
                  )}
                </div>
              </div>

              <div className="card dash-mini dash-half">
                <div className="dash-title">Police Officers per Rank</div>
                <div className="chart-wrap">
                  {officerRankSeries.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={officerRankSeries} margin={{ top: 10, right: 12, left: 0, bottom: 34 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" interval={0} />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="value" name="Officers" fill="#2563eb" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="empty-note">No officer rank data.</div>
                  )}
                </div>
              </div>

              <div className="card dash-pie dash-feature">
                <div className="dash-title">Officer Gender Distribution</div>
                <div className="pie-wrap">
                  {officerGenderSeries.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={officerGenderSeries}
                          dataKey="value"
                          nameKey="name"
                          outerRadius={100}
                          label={renderValueInsidePie}
                        >
                          {officerGenderSeries.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="empty-note">No gender data.</div>
                  )}
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};

export default AdminAnalytics;
