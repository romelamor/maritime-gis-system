// src/pages/Dashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import "../assets/css/dashboard.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faHome,
  faUser,
  faFileInvoice,
  faMapLocation,
  faRightFromBracket,
  faChartLine,
  faBell,
  faBoxArchive,
  faClockRotateLeft,
  faCircleCheck,
  faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";
import { Link, useNavigate } from "react-router-dom";

/* ===== Chart stack (kept for PIE only) ===== */
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { Doughnut } from "react-chartjs-2";
ChartJS.register(ArcElement, Tooltip, Legend);

/* ====== CONFIG ====== */
const API_BASE = (import.meta.env.VITE_API_BASE || "https://maritime-backend-0gib.onrender.com").replace(
  /\/$/,
  ""
);
const ENDPOINTS = {
  crimes: `${API_BASE}/api/crimes/`,
  officers: `${API_BASE}/api/personnel/`,
};

/* 🔐 AUTH HEADER (same pattern as AdminInfo) */
function authHeader() {
  const raw =
    localStorage.getItem("token") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("access") ||
    "";

  if (!raw) return {};
  if (/^(Bearer|Token)\s/i.test(raw)) return { Authorization: raw };
  if (/^[\w-]+\.[\w-]+\.[\w-]+$/.test(raw)) return { Authorization: `Bearer ${raw}` };
  return { Authorization: raw };
}

/* ===== Utils ===== */
function cssVar(name, fallback) {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return v || fallback;
}
const THEME = { primary: cssVar("--primary-color", "#1a237e") }; // currently not used but ok

const rowsFromPayload = (data) =>
  Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : [];

/* ======= API helpers ======= */
async function fetchAllPersonnelVisible() {
  let url = `${ENDPOINTS.officers}?page_size=1000`;
  const all = [];
  while (url) {
    const r = await fetch(url, { headers: authHeader() });
    if (!r.ok) {
      const err = new Error(`HTTP ${r.status}`);
      err.status = r.status;
      throw err;
    }
    const data = await r.json();
    const rows = Array.isArray(data)
      ? data
      : Array.isArray(data.results)
      ? data.results
      : [];
    all.push(...rows);
    if (Array.isArray(data)) break;
    url = data.next
      ? data.next.startsWith("http")
        ? data.next
        : `${API_BASE}${data.next}`
      : null;
  }
  return all.filter((p) => !(p.is_archived === true || p.archived === true));
}

async function fetchAllCrimesVisible() {
  let url = `${ENDPOINTS.crimes}?is_archived=false&page_size=1000`;
  const all = [];
  while (url) {
    const r = await fetch(url, { headers: authHeader() });
    if (!r.ok) {
      const err = new Error(`HTTP ${r.status}`);
      err.status = r.status;
      throw err;
    }
    const data = await r.json();
    all.push(...rowsFromPayload(data));
    if (Array.isArray(data)) break;
    url = data.next
      ? data.next.startsWith("http")
        ? data.next
        : `${API_BASE}${data.next}`
      : null;
  }
  return all;
}

/* ========= recent activity helpers ========= */
function pickDate(o) {
  return o.updated_at || o.created_at || o.happened_at || o.timestamp || o.date || null;
}
function relTime(d) {
  try {
    const date = typeof d === "string" ? new Date(d) : d;
    const diff = (date - new Date()) / 1000;
    const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
    const units = [
      ["year", 60 * 60 * 24 * 365],
      ["month", 60 * 60 * 24 * 30],
      ["week", 60 * 60 * 24 * 7],
      ["day", 60 * 60 * 24],
      ["hour", 60 * 60],
      ["minute", 60],
      ["second", 1],
    ];
    for (const [u, s] of units) {
      const v = Math.round(diff / s);
      if (Math.abs(v) >= 1) return rtf.format(v, u);
    }
    return "just now";
  } catch {
    return "";
  }
}
function iconForActivity(a) {
  if (a.severity === "success") return faCircleCheck;
  if (a.severity === "danger") return faTriangleExclamation;
  if (a.type === "crime") return faFileInvoice;
  if (a.type === "officer") return faUser;
  if (a.action === "archived") return faBoxArchive;
  return faClockRotateLeft;
}

function buildRecentActivityFromLocal(crimes = [], officers = [], limit = 20) {
  const items = [];

  // Crimes
  crimes.forEach((r, idx) => {
    const when = pickDate(r) || r.happened_at || new Date().toISOString();
    const status = (r.status || "Recorded").toLowerCase();
    const sev = status === "solved" ? "success" : status === "unsolved" ? "danger" : "info";
    const title = r.crime_type ? `${r.crime_type}` : "Crime Report";
    const loc =
      r.barangay ||
      r.municipality ||
      r.city ||
      r.province ||
      r.loc_municipality ||
      "";
    const caseNo = r.case_no || r.case_number || "";
    const parts = [];
    if (loc) parts.push(`Location: ${loc}`);
    if (caseNo) parts.push(`Case No: ${caseNo}`);
    items.push({
      id: `crime:${r.id ?? idx}`,
      type: "crime",
      action: r.status || "Recorded",
      severity: sev,
      title,
      desc: parts.join(" • ") || "New incident",
      when,
      case_no: caseNo || undefined,
    });
  });

  // Officers
  officers.slice(0, 50).forEach((o, i) => {
    const when = pickDate(o) || new Date().toISOString();
    const rankField = o.rank || o.section || o.officer_rank || "";
    items.push({
      id: `officer:${o.id ?? i}`,
      type: "officer",
      action: "updated",
      severity: "info",
      title: rankField
        ? `${rankField} ${o.last_name || ""}`.trim()
        : o.last_name || "Officer",
      desc: "Profile updated/visible",
      when,
      officer_id: o.id,
    });
  });

  return items
    .filter((a) => a.when)
    .sort((a, b) => new Date(b.when) - new Date(a.when))
    .slice(0, limit);
}

/* ===== Small date helpers (line controls) ===== */
const toYMD = (d) => d.toISOString().slice(0, 10);
function todayYMD() {
  const now = new Date();
  return toYMD(now);
}
function ymdDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toYMD(d);
}

/* ============= Component ============= */
const Dashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [submenuOpen, setSubmenuOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const navigate = useNavigate();

  // 🔒 auth flag
  const [authChecked, setAuthChecked] = useState(false);

  // KPIs
  const [kpis, setKpis] = useState({
    total_crimes: 0,
    total_officers: 0,
    total_solved: 0,
    unresolved: 0,
  });

  // Data (for activity only)
  const [rows, setRows] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [err, setErr] = useState("");

  // Recent activity (local-only)
  const [activity, setActivity] = useState([]);

  // Dismissed activities (persist)
  const [dismissedIds, setDismissedIds] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem("activity:dismissed") || "[]"));
    } catch {
      return new Set();
    }
  });
  useEffect(() => {
    localStorage.setItem("activity:dismissed", JSON.stringify([...dismissedIds]));
  }, [dismissedIds]);

  // Line controls → backend date params (ONLY FOR LINE)
  const [dateFrom, setDateFrom] = useState(""); // YYYY-MM-DD
  const [dateTo, setDateTo] = useState(""); // YYYY-MM-DD

  /* 🔒 logout helper */
  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("access_token");
    localStorage.removeItem("access");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("refresh");
    navigate("/login", { replace: true });
  };

  /* 🔒 Route guard: redirect to /login if walang token */
  useEffect(() => {
    const hasToken =
      localStorage.getItem("token") ||
      localStorage.getItem("access_token") ||
      localStorage.getItem("access");
    if (!hasToken) {
      navigate("/login", { replace: true });
    } else {
      setAuthChecked(true);
    }
  }, [navigate]);

  /* ---------- KPIs ---------- */
  async function fetchKPIs() {
    try {
      const crimes = await fetchAllCrimesVisible();

      let visibleOfficers = [];
      try {
        visibleOfficers = await fetchAllPersonnelVisible();
      } catch (e) {
        console.warn("Officers fetch failed:", e);
        if (e.status === 401) throw e;
      }

      const totalCrimes = crimes.length;
      const totalSolved = crimes.filter((r) => (r.status || "") === "Solved").length;
      const totalUnresolved = crimes.filter((r) => (r.status || "") === "Unsolved").length;

      setKpis({
        total_crimes: totalCrimes,
        total_officers: visibleOfficers.length,
        total_solved: totalSolved,
        unresolved: totalUnresolved,
      });

      setRows(crimes);
      setOfficers(visibleOfficers);
    } catch (e) {
      console.error("fetchKPIs error", e);
      if (e.status === 401) {
        logout();
        return;
      }
      setErr("Unable to load dashboard data.");
    }
  }

  useEffect(() => {
    if (!authChecked) return;
    fetchKPIs();
  }, [authChecked]);

  // Build local recent activity whenever crimes/officers change
  useEffect(() => {
    const list = buildRecentActivityFromLocal(rows, officers, 20);
    setActivity(list);
  }, [rows, officers]);

  /* ======== PIE ======== */
  const pie = useMemo(() => {
    const solved = kpis.total_solved || 0;
    const unresolved = kpis.unresolved || 0;
    const ongoing = Math.max((kpis.total_crimes || 0) - solved - unresolved, 0);

    const labels = ["Solved", "Unresolved"];
    const values = [solved, unresolved];
    const colors = ["rgba(34, 197, 94, 0.7)", "rgba(239, 68, 68, 0.7)"];
    const borders = ["rgba(34, 197, 94, 1)", "rgba(239, 68, 68, 1)"];

    if (ongoing > 0) {
      labels.push("Ongoing");
      values.push(ongoing);
      colors.push("rgba(107, 114, 128, 0.6)");
      borders.push("rgba(107, 114, 128, 1)");
    }

    return {
      labels,
      values,
      data: {
        labels,
        datasets: [
          {
            label: "Cases",
            data: values,
            backgroundColor: colors,
            borderColor: borders,
            borderWidth: 1,
            hoverOffset: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "60%",
        plugins: {
          legend: { position: "bottom" },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const v = ctx.parsed;
                const total = values.reduce((a, b) => a + b, 0) || 1;
                const pct = ((v / total) * 100).toFixed(1);
                return `${ctx.label}: ${v} (${pct}%)`;
              },
            },
          },
        },
      },
    };
  }, [kpis]);

  // Center TOTAL in doughnut
  const centerTotalPlugin = useMemo(
    () => ({
      id: "centerTotalPlugin",
      afterDatasetsDraw(chart) {
        const meta = chart.getDatasetMeta(0);
        if (!meta?.data?.length) return;
        const vals = chart.data.datasets?.[0]?.data || [];
        const total = vals.reduce((a, b) => a + (Number(b) || 0), 0);
        const { x, y } = meta.data[0].getProps(["x", "y"], true);
        const { ctx } = chart;
        ctx.save();
        ctx.textAlign = "center";
        ctx.fillStyle = "#6b7280";
        ctx.font = "bold 12px sans-serif";
        ctx.fillText("TOTAL", x, y - 8);
        ctx.fillStyle = "#111827";
        ctx.font = "bold 22px sans-serif";
        ctx.fillText(String(total), x, y + 18);
        ctx.restore();
      },
    }),
    []
  );

  // Percent labels INSIDE slices
  const arcLabelsPlugin = useMemo(
    () => ({
      id: "arcLabelsPlugin",
      afterDatasetDraw(chart, args) {
        if (!chart || args.meta.type !== "doughnut") return;
        const { ctx } = chart;
        const data = chart.data.datasets[args.index]?.data || [];
        const total = data.reduce((a, b) => a + (Number(b) || 0), 0) || 1;

        ctx.save();
        ctx.textAlign = "center";
        ctx.fillStyle = "#111827";
        ctx.font = "bold 11px sans-serif";

        args.meta.data.forEach((arc, i) => {
          const val = Number(data[i]) || 0;
          if (!val) return;
          const pct = ((val / total) * 100).toFixed(0) + "%";
          const pos = arc.tooltipPosition();
          ctx.fillText(pct, pos.x, pos.y);
        });

        ctx.restore();
      },
    }),
    []
  );

  // Legend breakdown (counts + % below the pie)
  const pieStats = useMemo(() => {
    const s = kpis.total_solved || 0;
    const u = kpis.unresolved || 0;
    const o = Math.max((kpis.total_crimes || 0) - s - u, 0);
    const total = Math.max(s + u + o, 1);
    const pct = (n) => ((n / total) * 100).toFixed(1) + "%";
    const items = [
      { key: "Solved", value: s, pct: pct(s), className: "solved" },
      { key: "Unresolved", value: u, pct: pct(u), className: "unresolved" },
    ];
    if (o > 0) items.push({ key: "Ongoing", value: o, pct: pct(o), className: "others" });
    return items;
  }, [kpis]);

  /* ------- quick nav ------- */
  const goCrimes = () => navigate("/VictimeSupectTable");
  const goOfficers = () => navigate("/adminInfo");
  const goSolved = () => navigate("/VictimeSupectTable?status=Solved");
  const goUnresolved = () => navigate("/VictimeSupectTable?status=Unsolved");

  /* ------- URLs ------- */
  // Heatmap should NOT react to the line toolbar → no date params here
  const heatmapURL = `${API_BASE}/api/analytics/heatmap/`;

  // Line PNG uses the toolbar’s date range
  const lineQuery = useMemo(() => {
    const p = new URLSearchParams();
    if (dateFrom) p.set("date_from", dateFrom);
    if (dateTo) p.set("date_to", dateTo);
    return p.toString();
  }, [dateFrom, dateTo]);
  const linePngURL = `${API_BASE}/api/analytics/line.png${
    lineQuery ? `?${lineQuery}` : ""
  }`;

  /* ------- line toolbar handlers (affects LINE only) ------- */
  function setRange(days) {
    if (days === -1) {
      setDateFrom("");
      setDateTo("");
    } else {
      setDateTo(todayYMD());
      setDateFrom(ymdDaysAgo(days - 1));
    }
  }

  /* ------- activity actions ------- */
  function handleOpenActivity(a) {
    if (a.type === "crime") {
      const qs = new URLSearchParams();
      if (a.case_no) qs.set("case_no", a.case_no);
      if (a.action) qs.set("status", a.action);
      const q = qs.toString();
      navigate(`/VictimeSupectTable${q ? `?${q}` : ""}`);
    } else if (a.type === "officer") {
      const qs = new URLSearchParams();
      if (a.officer_id) qs.set("id", a.officer_id);
      const q = qs.toString();
      navigate(`/adminInfo${q ? `?${q}` : ""}`);
    } else if (a.action === "archived") {
      navigate("/AdminArchivedReports");
    } else {
      navigate("/dashboard");
    }
  }

  function handleDismissActivity(id) {
    setDismissedIds((prev) => new Set(prev).add(id));
  }

  function handleClearActivities(list) {
    const ids = list.map((a) => a.id);
    setDismissedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  }

  const visibleActivity = useMemo(
    () => activity.filter((a) => !dismissedIds.has(a.id)),
    [activity, dismissedIds]
  );

  /* 🔒 Don’t render until auth is checked */
  if (!authChecked) {
    return null;
  }

  return (
    <div>
      {/* Top Navigation */}
      <div className="topnav">
        <div className="menu-icon" onClick={() => setSidebarOpen((s) => !s)}>
          ☰
        </div>
           <div className="nav-title">
             <FontAwesomeIcon icon={faBell} style={{ fontSize: 18 }} />
            </div>
      </div>

      {/* Overlay (mobile) */}
      {!sidebarOpen && (
        <div className="overlay" onClick={() => setSidebarOpen(true)}></div>
      )}

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
              <div
                className="submenu-toggle"
                onClick={() => setSubmenuOpen((s) => !s)}
              >
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
              <div
                className="submenu-toggle"
                onClick={() => setArchiveOpen((s) => !s)}
              >
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
              <button className="logout" onClick={logout}>
                <FontAwesomeIcon icon={faRightFromBracket} /> Logout
              </button>
            </li>
          </ul>
        </aside>

        {/* ==================== Main Content ==================== */}
        <main className="main-content">
          <h1 className="page-title">PNP MARITIME ADMIN DASHBOARD</h1>

          {/* KPI CARDS */}
          <div className="kpi-row">
            <button
              className="kpi-card kpi-blue kpi-click"
              onClick={goCrimes}
              title="Go to View Reports"
            >
              <div className="kpi-value">{kpis.total_crimes}</div>
              <div className="kpi-label">Total Crimes Reported</div>
            </button>

            <button
              className="kpi-card kpi-cyan kpi-click"
              onClick={goOfficers}
              title="Go to Profile Information"
            >
              <div className="kpi-value">{kpis.total_officers}</div>
              <div className="kpi-label">Total Police Officers</div>
            </button>

            <button
              className="kpi-card kpi-yellow kpi-click"
              onClick={goSolved}
              title="View Solved Cases"
            >
              <div className="kpi-value">{kpis.total_solved}</div>
              <div className="kpi-label">Total Crimes Solved</div>
            </button>

            <button
              className="kpi-card kpi-red kpi-click"
              onClick={goUnresolved}
              title="View Unresolved (Unsolved) Cases"
            >
              <div className="kpi-value">{kpis.unresolved}</div>
              <div className="kpi-label">Crime Unresolved</div>
            </button>
          </div>

          {/* ====== TOP VISUALS (HEATMAP + PIE) ====== */}
          <div className="card visual-card">
            <div className="visual-row">
              {/* Heatmap (Backend Folium HTML) */}
              <div className="card-pane">
                <h3 className="card-title">Heatmap of Crime</h3>
                <div className="map-wrap">
                  <iframe
                    title="Heatmap"
                    src={heatmapURL}
                    className="map-full"
                    frameBorder="0"
                    loading="lazy"
                  />
                </div>
              </div>

              {/* Pie */}
              <div className="card-pane">
                <h3 className="card-title">Case Status (Solved vs Unresolved)</h3>
                <div className="pie-wrap">
                  <Doughnut
                    data={pie.data}
                    options={pie.options}
                    plugins={[centerTotalPlugin, arcLabelsPlugin]}
                  />
                </div>

                {/* Informative legend with counts & % */}
                <ul className="pie-legend">
                  {pieStats.map((it) => (
                    <li key={it.key} className={`legend-item ${it.className}`}>
                      <span className="legend-key">{it.key}</span>
                      <span className="legend-val">
                        {it.value}{" "}
                        <span className="legend-pct">({it.pct})</span>
                      </span>
                    </li>
                  ))}
                </ul>

                {err && <div className="alert">{err}</div>}
              </div>
            </div>
          </div>

          {/* ====== BOTTOM: LINE (Matplotlib PNG) + RECENT ACTIVITY ====== */}
          <div className="card line-section">
            <div className="bottom-row">
              {/* LEFT: controls + line image */}
              <div className="bottom-left">
                <div className="chart-toolbar">
                  <div className="btn-group">
                    <button
                      className={`btn ${
                        dateFrom &&
                        dateTo &&
                        dateFrom === ymdDaysAgo(6)
                          ? "active"
                          : ""
                      }`}
                      type="button"
                      onClick={() => setRange(7)}
                    >
                      7d
                    </button>
                    <button
                      className={`btn ${
                        dateFrom &&
                        dateTo &&
                        dateFrom === ymdDaysAgo(29)
                          ? "active"
                          : ""
                      }`}
                      type="button"
                      onClick={() => setRange(30)}
                    >
                      30d
                    </button>
                    <button
                      className={`btn ${
                        dateFrom &&
                        dateTo &&
                        dateFrom === ymdDaysAgo(89)
                          ? "active"
                          : ""
                      }`}
                      type="button"
                      onClick={() => setRange(90)}
                    >
                      90d
                    </button>
                    <button
                      className={`btn ${
                        dateFrom &&
                        dateTo &&
                        dateFrom === ymdDaysAgo(179)
                          ? "active"
                          : ""
                      }`}
                      type="button"
                      onClick={() => setRange(180)}
                    >
                      180d
                    </button>
                    <button
                      className={`btn ${
                        !dateFrom && !dateTo ? "active" : ""
                      }`}
                      type="button"
                      onClick={() => setRange(-1)}
                    >
                      All
                    </button>
                  </div>
                </div>

                <h3 className="card-title">Incidents Per Day</h3>
                <div className="img-wrap">
                  <img
                    src={linePngURL}
                    alt="Incidents per Day"
                    style={{
                      width: "100%",
                      height: "auto",
                      borderRadius: 12,
                      boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
                    }}
                  />
                </div>
                <small
                  style={{
                    color: "#6b7280",
                    display: "block",
                    marginTop: 8,
                  }}
                >
                  Rendered server-side (Matplotlib). The buttons above only
                  change this line chart.
                </small>
                {err && <div className="alert">{err}</div>}
              </div>

              {/* RIGHT: recent activity (local) */}
              <div className="bottom-right">
                <div className="activity-card">
                  <div className="activity-header">
                    <FontAwesomeIcon icon={faClockRotateLeft} />
                    <span>Recent Activity</span>
                    <div style={{ marginLeft: "auto" }}>
                      {visibleActivity.length > 0 && (
                        <button
                          className="btn-ghost"
                          title="Clear list"
                          type="button"
                          onClick={() => handleClearActivities(visibleActivity)}
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

                  <ul className="activity-list">
                    {visibleActivity.length === 0 && (
                      <li className="activity-empty">
                        No recent activity yet.
                      </li>
                    )}

                    {visibleActivity.map((a) => (
                      <li
                        key={a.id}
                        className="activity-item is-link"
                        role="button"
                        tabIndex={0}
                        onClick={() => handleOpenActivity(a)}
                        onKeyDown={(e) =>
                          e.key === "Enter" && handleOpenActivity(a)
                        }
                        title="Open this activity"
                      >
                        <button
                          className="activity-del"
                          aria-label="Dismiss activity"
                          title="Dismiss"
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDismissActivity(a.id);
                          }}
                        >
                          &times;
                        </button>

                        <div
                          className={`activity-icon ${a.severity || "info"}`}
                        >
                          <FontAwesomeIcon icon={iconForActivity(a)} />
                        </div>
                        <div className="activity-body">
                          <div className="activity-title">
                            <span className="activity-what">
                              {a.title || "Activity"}
                            </span>
                            {a.action && (
                              <span className="activity-badge">
                                {a.action}
                              </span>
                            )}
                          </div>
                          {a.desc && (
                            <div className="activity-desc">{a.desc}</div>
                          )}
                          <div className="activity-meta">
                            {relTime(a.when)}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
