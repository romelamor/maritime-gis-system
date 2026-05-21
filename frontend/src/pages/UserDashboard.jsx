// src/pages/UserDashboard.jsx
import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { Link, useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faHome,
  faFileInvoice,
  faMapLocation,
  faRightFromBracket,
  faUser,
} from "@fortawesome/free-solid-svg-icons";

/* external, scoped CSS (non-global for other parts) */
import "../assets/css/userdashboard.css";

/* ========= CONFIG ========= */
/**
 * Optional: backend-computed stats endpoint.
 * Example: VITE_CRIME_STATS_PATH="/api/user/crime-stats/"
 * Kung empty, gagamitin lang yung computed stats from /api/crimes/.
 */
const CRIME_STATS_PATH = (import.meta.env.VITE_CRIME_STATS_PATH || "").trim();

/* ========= UTIL helpers used in navbar/user display ========= */
const imageUrl = (p) => {
  const any = p?.profile_image || p?.avatar || p?.photo || "";
  if (!any) return "";
  try {
    return new URL(any).href;
  } catch {
    return any;
  }
};

const fullNameFrom = (u) =>
  [u?.first_name, u?.middle_name, u?.last_name].filter(Boolean).join(" ") ||
  "Unnamed";

const num = (n) => (Number.isFinite(n) ? n : 0);
const lower = (v) => (v == null ? "" : String(v).toLowerCase().trim());

const rowsFromPayload = (data) =>
  Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : [];

/* ========= Crime helpers ========= */
const isResolved = (r = {}) => {
  if (typeof r.is_resolved === "boolean") return r.is_resolved;
  if (typeof r.resolved === "boolean") return r.resolved;

  const br = lower(r.is_resolved);
  if (["true", "yes", "1"].includes(br)) return true;

  const rr = lower(r.resolved);
  if (["true", "yes", "1"].includes(rr)) return true;

  const v = lower(
    r.case_status || r.status || r.state || r.case_state || r.case_stage
  );
  if (
    [
      "resolved",
      "solved",
      "closed",
      "case closed",
      "done",
      "finished",
      "complete",
      "completed",
    ].includes(v)
  )
    return true;

  const sCode = r.status_code ?? r.code ?? r.state_code;
  if (sCode === 2 || sCode === "2") return true;

  if (r.closed_at || r.resolved_at || r.date_closed) return true;

  return false;
};

const join = (arr) => arr.filter(Boolean).join(", ");

function buildCrimeLocationDisplay(r = {}) {
  const loc_barangay =
    r.loc_barangay ||
    r.loc_brgy ||
    r.brgy ||
    r.barangay ||
    r.barangay_name ||
    r.brgy_name;

  const loc_city_municipality =
    r.loc_city_municipality ||
    r.municipality ||
    r.city ||
    r.city_municipality ||
    r.town ||
    r.city_name;

  const loc_province = r.loc_province || r.province || r.province_name;
  const loc_region = r.loc_region || r.region || r.region_name;

  const loc_address = r.loc_address;
  const addressFallback =
    r.address ||
    r.address_line ||
    r.location_address ||
    r.crime_address ||
    r.full_address ||
    r.location;

  const loc =
    r.location_obj || r.location_details || r.place || r.area || r.loc;

  const n_addr = loc?.address || loc?.address_line || loc?.full_address;
  const n_brgy =
    loc?.loc_barangay ||
    loc?.barangay ||
    loc?.brgy ||
    loc?.barangay_name ||
    loc?.brgy_name;
  const n_city =
    loc?.loc_city_municipality ||
    loc?.municipality ||
    loc?.city ||
    loc?.city_municipality ||
    loc?.city_name ||
    loc?.town;
  const n_prov = loc?.loc_province || loc?.province || loc?.province_name;
  const n_reg = loc?.loc_region || loc?.region || loc?.region_name;

  const areaMain = join([
    loc_barangay || n_brgy,
    loc_city_municipality || n_city,
    loc_province || n_prov,
  ]);

  const line1 =
    loc_address ||
    n_addr ||
    areaMain ||
    loc_region ||
    n_reg ||
    addressFallback ||
    "—";

  let line2 = null;
  if (line1 && line1 !== "—") {
    const areaSecondary =
      areaMain ||
      join([loc_city_municipality || n_city, loc_province || n_prov]) ||
      loc_region ||
      n_reg ||
      null;

    if (loc_address || n_addr) {
      if (areaSecondary) line2 = areaSecondary;
    }
  }

  const hasLatLng = r.latitude != null && r.longitude != null;
  const coords = hasLatLng ? `(${r.latitude}, ${r.longitude})` : null;

  if (coords) {
    if (line2) line2 = `${line2} • ${coords}`;
    else if (line1 !== coords) line2 = coords;
  }

  return { line1, line2 };
}

const pickType = (r = {}) =>
  r.incident_type ||
  r.type ||
  r.category ||
  r.offense ||
  r.violation ||
  r.crime_type ||
  r.classification ||
  r?.incident?.type ||
  r?.incident?.category ||
  "—";

const pickDate = (r = {}) =>
  r.happened_at ||
  r.date ||
  r.incident_date ||
  r.reported_at ||
  r.created_at ||
  r.filed_at ||
  r.occurred_at ||
  r.datetime ||
  "—";

const pickStatusLabel = (r = {}) =>
  isResolved(r) ? "Solved" : r.case_status || r.status || "Unresolved";

const buildCrimeParams = () => ({
  ordering: "-created_at",
  page_size: 200,
  is_archived: false,
  archived: false,
  is_deleted: false,
  deleted: false,
});

/**
 * Fetch all crimes (paginated) using the shared api client.
 * api → automatic Authorization: Bearer <token> + auto-refresh on 401
 */
async function fetchAllCrimes() {
  const params = buildCrimeParams();
  let url = "/api/crimes/";
  let all = [];
  let totalCount = null;
  let guard = 0;

  while (url && guard < 50) {
    const { data } = await api.get(url, { params });
    const part = rowsFromPayload(data);
    all = all.concat(part);

    if (typeof data?.count === "number") totalCount = data.count;

    url = data?.next || null; // can be relative or absolute
    if (url) {
      // once paginated na via `next`, huwag na magpadala ng page_size param
      params.page_size = undefined;
    }
    guard += 1;
  }

  return { rows: all, count: totalCount };
}

/* ========= PAGE ========= */
export default function UserDashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [submenuOpen, setSubmenuOpen] = useState(false);

  const [crimes, setCrimes] = useState([]);
  const [loadingCrimes, setLoadingCrimes] = useState(true);
  const [crimeErr, setCrimeErr] = useState("");

  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);

  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  const logout = () => {
    // linisin yung common token keys (admin + user)
    [
      "token",
      "access_token",
      "access",
      "refresh",
      "refresh_token",
      "authTokens",
      "tokens",
    ].forEach((k) => localStorage.removeItem(k));
    navigate("/Userlogin");
  };

  // session guard
  useEffect(() => {
    const token =
      localStorage.getItem("access") ||
      localStorage.getItem("token") ||
      localStorage.getItem("access_token");
    if (!token) navigate("/Userlogin");
  }, [navigate]);

  // Fetch profile para sa navbar info (GET /api/personnel/me/)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get("/api/personnel/me/", {
          validateStatus: () => true,
        });

        if (cancelled) return;

        if (res.status >= 200 && res.status < 300) {
          setUser(res.data || {});
        } else if (res.status === 401) {
          // token invalid / expired
          logout();
        } else if (res.status === 403) {
          // forbidden (e.g. archived account) – you can customize message if needed
          console.warn("Forbidden /api/personnel/me/:", res.data);
        }
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to load /api/personnel/me/", err);
        const status = err?.response?.status;
        if (status === 401) logout();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch crimes + compute fallback stats
  useEffect(() => {
    let stop = false;
    (async () => {
      try {
        setLoadingCrimes(true);
        setCrimeErr("");
        const { rows, count } = await fetchAllCrimes();
        if (stop) return;
        setCrimes(rows);

        const computedTotal = num(count != null ? count : rows.length);
        const solved = num(rows.filter(isResolved).length);
        const unresolved = Math.max(computedTotal - solved, 0);
        const rate = computedTotal
          ? Math.round((solved / computedTotal) * 100)
          : 0;

        setStats({ total: computedTotal, solved, unresolved, rate });
      } catch (e) {
        if (stop) return;
        console.error(e);
        setCrimeErr("Could not load crime statistics.");
      } finally {
        if (!stop) setLoadingCrimes(false);
      }
    })();
    return () => {
      stop = true;
    };
  }, []);

  // Optional: override stats kung may backend-computed CRIME_STATS_PATH
  useEffect(() => {
    if (!CRIME_STATS_PATH) {
      setLoadingStats(false);
      return;
    }
    let stop = false;
    const controller = new AbortController();
    (async () => {
      try {
        const path = CRIME_STATS_PATH.startsWith("/")
          ? CRIME_STATS_PATH
          : `/${CRIME_STATS_PATH}`;
        const { data } = await api.get(path, { signal: controller.signal });
        if (stop) return;

        if (
          data &&
          typeof data.total === "number" &&
          typeof data.solved === "number"
        ) {
          const total = num(data.total);
          const solved = num(data.solved);
          const unresolved =
            typeof data.unresolved === "number"
              ? num(data.unresolved)
              : Math.max(total - solved, 0);
          const rate =
            typeof data.rate === "number"
              ? num(data.rate)
              : total
              ? Math.round((solved / total) * 100)
              : 0;
          setStats({ total, solved, unresolved, rate });
        }
      } catch (e) {
        // ignore — gagamitin na lang yung computed fallback stats
        console.warn("crime stats endpoint failed, using fallback", e);
      } finally {
        if (!stop) setLoadingStats(false);
      }
    })();
    return () => {
      stop = true;
      controller.abort();
    };
  }, []);

  const effectiveStats = stats || {
    total: 0,
    solved: 0,
    unresolved: 0,
    rate: 0,
  };
  const loadingAnyStats = loadingCrimes || loadingStats;

  const visibleImage = imageUrl(user || {});
  const rankLabel = user?.section || "—"; // galing sa PersonnelProfile.section

  return (
    <div>
      {/* --- TOPNAV --- */}
      <div
        className="topnav"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            className="menu-icon"
            onClick={() => setSidebarOpen((s) => !s)}
            style={{ cursor: "pointer" }}
          >
            ☰
          </div>

        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Optional user avatar */}
          {visibleImage && (
            <img
              src={visibleImage}
              alt="User"
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                objectFit: "cover",
              }}
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          )}

          <div style={{ textAlign: "right", lineHeight: 1 }}>
            <div style={{ fontWeight: 600 }}>{rankLabel}</div>
          </div>

          <div style={{ textAlign: "right", lineHeight: 1 }}>
            <div style={{ fontWeight: 600 }}>{fullNameFrom(user)}</div>
          </div>

          <button
            onClick={logout}
            title="Logout"
            style={{
              display: "inline-flex",
              gap: 8,
              alignItems: "center",
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #e6e9ef",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            <FontAwesomeIcon icon={faRightFromBracket} /> Logout
          </button>
        </div>
      </div>

      <div className="container">
        {/* ===== SIDEBAR ===== */}
        <aside className={`sidebar ${!sidebarOpen ? "collapsed" : ""}`}>
          <div className="logo-section">
            <img src="/assets/logo.png" alt="Logo" />
            <p>
              <strong>User</strong>
              <br />
              Dashboard
            </p>
          </div>

          <ul className="nav-links">
            <li className="active">
              <Link to="/UserDashboard">
                <FontAwesomeIcon icon={faHome} /> Home
              </Link>
            </li>

            <li className="active">
              <Link to="/UserProfile">
                <FontAwesomeIcon icon={faUser} /> My Profile
              </Link>
            </li>

            <li>
              <div
                className="submenu-toggle"
                onClick={() => setSubmenuOpen((s) => !s)}
              >
                <FontAwesomeIcon icon={faFileInvoice} /> Incident Reports
              </div>
              {submenuOpen && (
                <ul className="submenu">
                  <li>
                    <Link to="/UserViewReport">View Reports</Link>
                  </li>
                  <li>
                    <Link to="/UserVictimReport"> Add Report</Link>
                  </li>
                 
                </ul>
              )}
            </li>

            <li>
              <Link to="/UserMaps">
                <FontAwesomeIcon icon={faMapLocation} /> Maps
              </Link>
            </li>

            <li>
              <button className="logout" onClick={logout}>
                <FontAwesomeIcon icon={faRightFromBracket} /> Logout
              </button>
            </li>
          </ul>
        </aside>

        {/* ===== MAIN ===== */}
        <main
          className={`main-content ${!sidebarOpen ? "sidebar-collapsed" : ""}`}
        >
          <h2>Dashboard Overview</h2>

          {crimeErr && <div className="ud-alert-error">{crimeErr}</div>}

          {/* === STAT CARDS === */}
          <section style={{ marginTop: 16 }}>
            {loadingAnyStats ? (
              <div className="ud-card-loading">Loading crime statistics…</div>
            ) : (
              <div className="ud-card-grid">
                <Link
                  to="/UserViewReport"
                  className="ud-card ud-card--total"
                  title="View all crimes"
                >
                  <div className="ud-card-label">Total Crimes</div>
                  <div className="ud-card-value">
                    {effectiveStats.total.toLocaleString()}
                  </div>
                  <div className="ud-card-sub">All recorded incidents</div>
                </Link>

                <Link
                  to="/UserViewReport?status=solved"
                  className="ud-card ud-card--solved"
                  title="View solved cases"
                >
                  <div className="ud-card-label">Solved</div>
                  <div className="ud-card-value">
                    {effectiveStats.solved.toLocaleString()}
                  </div>
                  <div className="ud-card-sub">Marked resolved/closed</div>
                </Link>

                <Link
                  to="/UserViewReport?status=unresolved"
                  className="ud-card ud-card--unresolved"
                  title="View unresolved cases"
                >
                  <div className="ud-card-label">Unresolved</div>
                  <div className="ud-card-value">
                    {effectiveStats.unresolved.toLocaleString()}
                  </div>
                  <div className="ud-card-sub">Still open / in-progress</div>
                </Link>

                <Link
                  to="/UserViewReport"
                  className="ud-card ud-card--rate"
                  title="View solve rate details"
                >
                  <div className="ud-card-label">Solve Rate</div>
                  <div className="ud-card-value">{effectiveStats.rate}%</div>
                  <div className="ud-progress-outer">
                    <div
                      className="ud-progress-inner"
                      style={{ width: `${effectiveStats.rate}%` }}
                    />
                  </div>
                  <div className="ud-card-sub">
                    Percentage of solved cases
                  </div>
                </Link>
              </div>
            )}
          </section>

          {/* === RECENT INCIDENTS === */}
          {!loadingCrimes && crimes.length > 0 && (
            <section style={{ marginTop: 16 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <h3 style={{ margin: 0 }}>Recent Incidents</h3>
                <Link to="/UserViewReport" className="edit-btn">
                  View All
                </Link>
              </div>

              <div className="ud-table-card">
                <table className="ud-table">
                  <thead>
                    <tr>
                      <th>Blotter No.</th>
                      <th>Type</th>
                      <th>Location</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {crimes.slice(0, 5).map((r, i) => {
                      const loc = buildCrimeLocationDisplay(r);
                      const blotter =
                        r.blotter_number ||
                        r.blotter_no ||
                        r.case_number ||
                        r.case_no ||
                        r.id ||
                        "—";
                      return (
                        <tr
                          key={r.id || r.uuid || i}
                          className="ud-table-row"
                        >
                          <td>{blotter}</td>
                          <td>{pickType(r)}</td>
                          <td className="ud-location-cell">
                            <div>{loc.line1}</div>
                            {loc.line2 && (
                              <div className="ud-location-sub">
                                {loc.line2}
                              </div>
                            )}
                          </td>
                          <td
                            className={`ud-status-cell ${
                              isResolved(r)
                                ? "ud-status--solved"
                                : "ud-status--unresolved"
                            }`}
                          >
                            {pickStatusLabel(r)}
                          </td>
                          <td>{String(pickDate(r)).slice(0, 10)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
