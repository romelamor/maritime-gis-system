// src/pages/UserViewReport.jsx
import React, {
  useMemo,
  useRef,
  useState,
  useEffect,
  useCallback,
} from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faHome,
  faUser,
  faFileInvoice,
  faMapLocation,
  faChartLine,
  faBoxArchive,
  faBell,
  faRightFromBracket,
} from "@fortawesome/free-solid-svg-icons";

/* Leaflet (read-only maps in view modal) */
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import { width } from "@fortawesome/free-solid-svg-icons/fa0";

/* ================== CONFIG ================== */
const RAW_API_BASE =
  import.meta.env.VITE_API_BASE || "https://maritime-backend-0gib.onrender.com/api";

const API_BASE = RAW_API_BASE.replace(/\/$/, "");

// MEDIA_BASE = backend root (para sa /media/ images)
const MEDIA_BASE = API_BASE.replace(/\/api$/, "");

const PROVINCES_R4A = ["All", "Cavite", "Laguna", "Batangas", "Rizal", "Quezon"];
const iso = (d) => new Date(d).toISOString().slice(0, 10);

/* Leaflet default icon fix (use CDN images) */
const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

/* Philippines bounding box & center (used for map view bounds/initial) */
const PH_BOUNDS = L.latLngBounds(
  L.latLng(4.5, 116.0),
  L.latLng(21.5, 127.0)
);
const PH_CENTER = L.latLng(14.5995, 120.9842);

/* ========== HELPERS ========== */
function buildAuthHeader() {
  const raw =
    localStorage.getItem("token") ||
    localStorage.getItem("access_token") ||
    "";
  if (!raw) return {};
  if (/^(Bearer|Token)\s/i.test(raw)) return { Authorization: raw };
  if (/^[\w-]+\.[\w-]+\.[\w-]+\.[\w-]+$/.test(raw)) return { Authorization: `Bearer ${raw}` };
  if (/^[\w-]+\.[\w-]+\.[\w-]+$/.test(raw)) return { Authorization: `Bearer ${raw}` };
  return { Authorization: `Bearer ${raw}` };
}

const imageUrl = (p) => {
  const any = p?.profile_image || p?.avatar || p?.photo || "";
  if (!any) return "";
  try {
    return new URL(any).href;
  } catch {
    return any;
  }
};

const fullNameFromUser = (u) =>
  [u?.first_name, u?.middle_name, u?.last_name].filter(Boolean).join(" ") ||
  "Unnamed";

const fullName = (a, b, c) => [a, b, c].filter(Boolean).join(" ");
const addrBlock = (prefix, o) =>
  [
    o?.[`${prefix}_address`],
    [
      o?.[`${prefix}_region`],
      o?.[`${prefix}_province`],
      o?.[`${prefix}_city_municipality`],
      o?.[`${prefix}_barangay`],
    ]
      .filter(Boolean)
      .join(", "),
  ]
    .filter(Boolean)
    .join("\n");

const normalizeVictimStatus = (row) => {
  const s = String(row?.status ?? "").trim();
  return ["Ongoing", "Solved", "Unsolved"].includes(s) ? s : "Ongoing";
};
const getSuspectCrimeId = (s) =>
  s?.crime_report ??
  s?.crime_report_id ??
  s?.crime ??
  s?.crime_id ??
  s?.report ??
  null;

// build full URL for media (/media/...) paths
const buildMediaUrl = (path) => {
  if (!path) return null;
  const s = String(path);
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  const withSlash = s.startsWith("/") ? s : `/${s}`;
  return `${MEDIA_BASE}${withSlash}`;
};

/* Small UI util: copy text */
const CopyBtn = ({ value, title = "Copy" }) => (
  <button
    onClick={() => navigator.clipboard.writeText(String(value ?? ""))}
    title={title}
    style={{
      marginLeft: 6,
      padding: "2px 6px",
      borderRadius: 6,
      border: "1px solid #ddd",
      fontSize: 12,
      cursor: "pointer",
      background: "#f9fafb",
    }}
  >
    Copy
  </button>
);

/* ================== SMALL ACTIONS ================== */
function RowActions({ row, status, onView, onSetStatus, busy, onPrintIRFCSS }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  useEffect(() => {
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);
  const btn = {
    background: "#2563eb",
    color: "#fff",
    border: "1px solid #1e40af",
    borderRadius: 999,
    padding: "8px 14px",
    cursor: "pointer",
    fontWeight: 600,
    boxShadow: "0 2px 8px rgba(0,0,0,.12)",
    fontSize: 13,
  };
  const menu = {
    position: "absolute",
    top: "110%",
    right: 0,
    minWidth: 200,
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    boxShadow: "0 10px 24px rgba(0,0,0,.12)",
    overflow: "hidden",
    zIndex: 10,
  };
  const item = {
    width: "100%",
    padding: "10px 12px",
    textAlign: "left",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontWeight: 500,
    fontSize: 13,
  };
  return (
    <div ref={wrapRef} style={{ position: "relative", display: "inline-block" }}>
      <button type="button" onClick={() => setOpen((v) => !v)} style={btn}>
        Actions ▾
      </button>
      {open && (
        <div style={menu}>
          <button
            style={item}
            onClick={() => {
              setOpen(false);
              onView(row);
            }}
          >
             View
          </button>
          <button
            style={item}
            onClick={() => {
              setOpen(false);
              onPrintIRFCSS(row);
            }}
          >
             Print IRF (CSS)
          </button>
          {status !== "Solved" ? (
            <button
              style={item}
              disabled={busy}
              onClick={() => {
                setOpen(false);
                onSetStatus(row, "Solved");
              }}
            >
              ✅ Mark as Solved
            </button>
          ) : (
            <button
              style={item}
              disabled={busy}
              onClick={() => {
                setOpen(false);
                onSetStatus(row, "Unsolved");
              }}
            >
              ↩️ Mark as Unsolved
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ========== Map view component (read-only) ========== */
function ReadOnlyMap({ latitude, longitude, height = 240 }) {
  const hasCoords =
    latitude != null &&
    longitude != null &&
    latitude !== "" &&
    longitude !== "";
  const center = hasCoords
    ? [Number(latitude), Number(longitude)]
    : [PH_CENTER.lat, PH_CENTER.lng];

  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 10,
        overflow: "hidden",
        height,
      }}
    >
      <MapContainer
        center={center}
        zoom={hasCoords ? 12 : 6}
        style={{ width: "100%", height: "100%" }}
        scrollWheelZoom={false}
        dragging={false}
        doubleClickZoom={false}
        attributionControl={false}
        zoomControl={true}
        maxBounds={PH_BOUNDS}
        maxBoundsViscosity={1.0}
      >
        <TileLayer
          noWrap
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {hasCoords && (
          <Marker position={[Number(latitude), Number(longitude)]} />
        )}
        <FitMapToBounds latitude={latitude} longitude={longitude} />
      </MapContainer>
    </div>
  );
}

/* Utility to fit map to marker when coords present */
function FitMapToBounds({ latitude, longitude }) {
  const map = useMap();
  useEffect(() => {
    if (
      latitude == null ||
      longitude == null ||
      latitude === "" ||
      longitude === ""
    ) {
      map.setView(PH_CENTER, 6);
      return;
    }
    const ll = L.latLng(Number(latitude), Number(longitude));
    if (PH_BOUNDS.contains(ll)) {
      try {
        map.setView(ll, 12);
      } catch (e) {
        /* ignore */
      }
    } else {
      map.setView(PH_CENTER, 6);
    }
  }, [map, latitude, longitude]);
  return null;
}

/* ================== PAGE ================== */
export default function UserViewReport() {
  const navigate = useNavigate();

  // para sa route guard
  const [authChecked, setAuthChecked] = useState(false);

  /* Sidebar/topnav */
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [submenuOpen, setSubmenuOpen] = useState(true);

  /* Filters */
  const today = useMemo(() => iso(new Date()), []);
  const sevenAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return iso(d);
  }, []);
  const [from, setFrom] = useState(sevenAgo);
  const [to, setTo] = useState(today);
  const [province, setProvince] = useState("All");
  const valid = from && to && from <= to;

  /* Data */
  const [rows, setRows] = useState([]);
  const [suspects, setSuspects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [hasGenerated, setHasGenerated] = useState(false);

  /* Tabs & modal */
  const [currentTab, setCurrentTab] = useState("all");
  const [viewOpen, setViewOpen] = useState(false);
  const [viewRow, setViewRow] = useState(null);
  const [saveStates, setSaveStates] = useState({});
  const setRowSave = (id, s) =>
    setSaveStates((p) => ({ ...p, [id]: s || "idle" }));

  /* NEW: search + list filters */
  const [q, setQ] = useState("");
  const [crimeFilter, setCrimeFilter] = useState("All");
  const [cityFilter, setCityFilter] = useState("All");

  const abortRef = useRef(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  /* ========== SIMPLE ROUTE GUARD ========== */
  useEffect(() => {
    const headers = buildAuthHeader();
    if (!headers.Authorization) {
      navigate("/Userlogin", { replace: true });
    } else {
      setAuthChecked(true);
    }
  }, [navigate]);

  const inRange = (dStr, a, b) => {
    const d = String(dStr || "").slice(0, 10);
    return d && d >= a && d <= b;
  };

  async function handleGenerate(e) {
    e.preventDefault();
    setErr("");
    if (!valid) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setHasGenerated(true);
    setCurrentTab("all");

    try {
      const params = {
        happened_at__gte: from,
        happened_at__lte: to,
        is_archived: false,
        ordering: "-happened_at",
        limit: 1000,
      };
      if (province !== "All") params.loc_province = province;

      const headers = buildAuthHeader();

      const crimesRes = await axios.get(`${API_BASE}/crimes/`, {
        params,
        signal: controller.signal,
        headers,
      });
      let crimeList = Array.isArray(crimesRes.data)
        ? crimesRes.data
        : crimesRes.data?.results || [];
      crimeList = crimeList.filter((r) => {
        const okDate = inRange(r?.happened_at, from, to);
        const okProv =
          province === "All"
            ? true
            : String(r?.loc_province || "")
                .trim()
                .toLowerCase() === province.toLowerCase();
        return okDate && okProv;
      });

      const suspectsRes = await axios.get(`${API_BASE}/suspects/`, {
        params: { ordering: "-created_at", limit: 5000 },
        signal: controller.signal,
        headers,
      });
      const suspectList = Array.isArray(suspectsRes.data)
        ? suspectsRes.data
        : suspectsRes.data?.results || [];

      setRows(crimeList);
      setSuspects(suspectList);
      setCrimeFilter("All");
      setCityFilter("All");
      setQ("");
    } catch (error) {
      if (axios.isCancel(error)) return;
      setErr(error?.message || "Network error");
      setRows([]);
      setSuspects([]);
    } finally {
      setLoading(false);
    }
  }

  /* Status update */
  const sendVictimStatus = async (id, newStatus, signal) => {
    const form = new FormData();
    form.append("status", newStatus);
    return axios.patch(`${API_BASE}/crimes/${id}/`, form, {
      signal,
      headers: buildAuthHeader(),
    });
  };

  const updateStatus = useCallback(async (row, newStatus) => {
    if (!row?.id) return;
    const id = row.id,
      prev = normalizeVictimStatus(row);
    setRowSave(id, "saving");
    setRows((p) =>
      p.map((r) =>
        r.id === id ? { ...r, status: newStatus, _status: newStatus } : r
      )
    );
    const controller = new AbortController();
    try {
      await sendVictimStatus(id, newStatus, controller.signal);
      setRowSave(id, "saved");
      setTimeout(() => setRowSave(id, "idle"), 800);
    } catch {
      setRowSave(id, "error");
      setRows((p) =>
        p.map((r) =>
          r.id === id ? { ...r, status: prev, _status: prev } : r
        )
      );
      alert("Failed to update status.");
    }
  }, []);

  const openView = (row) => {
    console.log("VIEW ROW DATA:", row); // 🔥 ADD THIS
    setViewRow(row);
    setViewOpen(true);
  };
  const closeView = () => {
    setViewOpen(false);
    setViewRow(null);
  };

  /* ========== derive lists for dropdowns ========== */
  const crimeTypeOptions = useMemo(() => {
    const set = new Set(
      rows
        .map((r) => (r.crime_type || "").trim())
        .filter(Boolean)
    );
    return ["All", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [rows]);

  const cityOptions = useMemo(() => {
    const set = new Set(
      rows
        .map((r) => (r.loc_city_municipality || "").trim())
        .filter(Boolean)
    );
    return ["All", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [rows]);

  /* ========== filtering pipeline ========== */
  const tabFiltered = useMemo(() => {
    if (currentTab === "solved")
      return rows.filter((r) => normalizeVictimStatus(r) === "Solved");
    if (currentTab === "unsolved")
      return rows.filter((r) =>
        ["Ongoing", "Unsolved"].includes(normalizeVictimStatus(r))
      );
    return rows;
  }, [rows, currentTab]);

  const listFiltered = useMemo(() => {
    return tabFiltered.filter((r) => {
      const okCrime =
        crimeFilter === "All"
          ? true
          : String(r?.crime_type || "") === crimeFilter;
      const okCity =
        cityFilter === "All"
          ? true
          : String(r?.loc_city_municipality || "") === cityFilter;
      return okCrime && okCity;
    });
  }, [tabFiltered, crimeFilter, cityFilter]);

  const filteredRows = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return listFiltered;
    const hit = (s) => String(s || "").toLowerCase().includes(term);
    return listFiltered.filter((v) => {
      return (
        hit(v.blotter_number) ||
        hit(v.crime_type) ||
        hit(fullName(v.v_first_name, v.v_middle_name, v.v_last_name)) ||
        hit(addrBlock("v", v)) ||
        hit(addrBlock("loc", v)) ||
        hit(v.description)
      );
    });
  }, [listFiltered, q]);

  const suspectsForViewRow = useMemo(() => {
    if (!viewRow) return [];
    const idStr = String(viewRow.id);
    return suspects.filter(
      (s) => String(getSuspectCrimeId(s)) === idStr
    );
  }, [viewRow, suspects]);

  function exportCSV() {
    if (!filteredRows.length) return;
    const headers = [
      "Blotter #",
      "Type of Crime",
      "Victim Name",
      "Age",
      "Victim Address",
      "Crime Location",
      "Date",
      "Status",
    ];
    const lines = filteredRows.map((v) => {
      const fields = [
        v.blotter_number || "",
        v.crime_type || "",
        fullName(v.v_first_name, v.v_middle_name, v.v_last_name) || "",
        v.v_age || "",
        addrBlock("v", v) || "",
        addrBlock("loc", v) || "",
        String(v.happened_at || "").slice(0, 10),
        normalizeVictimStatus(v),
      ];
      return fields
        .map((x) => `"${String(x).replace(/"/g, '""')}"`)
        .join(",");
    });
    const csv = [headers.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `user_reports_${currentTab}_${from}_to_${to}_${province}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ---------- PRINT (CSS form) ---------- */
  const printHTMLViaIframe = useCallback((html) => {
    const frame = document.createElement("iframe");
    frame.style.position = "fixed";
    frame.style.right = "0";
    frame.style.bottom = "0";
    frame.style.width = "0";
    frame.style.height = "0";
    frame.style.border = "0";
    document.body.appendChild(frame);
    const doc = frame.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();
    const cleanup = () =>
      setTimeout(
        () => frame.parentNode && frame.parentNode.removeChild(frame),
        800
      );
    frame.onload = () => {
      try {
        frame.contentWindow.focus();
        frame.contentWindow.print();
      } finally {
        cleanup();
      }
    };
  }, []);

  const printIRF_CSS = useCallback(
    (rowArg) => {
      const row = rowArg ?? viewRow;
      if (!row) return;

      const V = (x) => (x == null || x === "" ? "—" : String(x));
      const U = (x) => (x == null || x === "" ? "—" : String(x).toUpperCase());
      const fmtDT = (x) => (x ? new Date(x).toLocaleString() : "—");
      const fmtD = (x) => (x ? new Date(x).toLocaleDateString() : "—");
      const esc = (s) =>
        String(s == null ? "" : s)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");

      const place = [
        row.loc_address,
        row.loc_barangay,
        row.loc_city_municipality,
        row.loc_province,
      ]
        .filter(Boolean)
        .join(", ");

      const coords =
        row.latitude && row.longitude
          ? `${row.latitude}, ${row.longitude}`
          : "";

      const incident = {
        date_reported: fmtDT(row.created_at),
        date_incident: fmtD(row.happened_at),
        place: place || "—",
        nature: V(row.crime_type),
        narrative: V(row.description),
        coords: coords || "—",
        status: U(row.status || "ONGOING"),
        waterbody: V(row.loc_waterbody),
        kind: row.loc_kind ? String(row.loc_kind).toUpperCase() : "—",
      };

      const locKindWater =
        incident.kind && incident.waterbody && incident.waterbody !== "—"
          ? `${incident.kind} / ${incident.waterbody}`
          : incident.kind || incident.waterbody || "—";

      const reporting = {
        last: V(row.rp_last_name),
        first: V(row.rp_first_name),
        middle: V(row.rp_middle_name),
        sex: V(row.rp_sex),
        age: V(row.rp_age),
        citizenship: V(row.rp_citizenship),
        pob: V(row.rp_place_of_birth),
        occupation: V(row.rp_occupation),
        email: V(row.rp_email),
        contact: V(row.rp_contact_number),
        address: V(row.rp_address),
      };

      const victim = {
        last: V(row.v_last_name),
        first: V(row.v_first_name),
        middle: V(row.v_middle_name),
        age: V(row.v_age),
        sex: V(row.v_sex),
        citizenship: V(row.v_citizenship),
        birthdate: fmtD(row.v_birthdate),
        pob: V(row.v_place_of_birth),
        occupation: V(row.v_occupation),
        barangay: V(row.v_barangay),
        city: V(row.v_city_municipality),
        province: V(row.v_province),
        address: V(row.v_address),
      };

      const su =
        suspects.find(
          (s) => String(getSuspectCrimeId(s)) === String(row.id)
        ) || {};

      const suspect = {
        last: V(su.s_last_name),
        first: V(su.s_first_name),
        middle: V(su.s_middle_name),
        age: V(su.s_age),
        barangay: V(su.s_barangay),
        city: V(su.s_city_municipality),
        province: V(su.s_province),
        region: V(su.s_region),
        address: V(su.s_address),
        desc: V(su.s_description || su.loc_address || ""),
      };

      const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Incident Record Form</title>
  <style>
    @page {
      size: A4;
      margin: 10mm;
    }
    * {
      box-sizing: border-box;
    }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11px;
      color: #000;
      margin: 0;
      padding: 0;
    }
    .irf-wrapper {
      width: 100%;
      max-width: 800px;
      margin: 0 auto;
    }
    .irf-header-top {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      margin-top: 4px;
      text-align: left;
    }
    .irf-header-logo {
      width: 52px;
      height: 52px;
      object-fit: contain;
      flex-shrink: 0;
    }
    .irf-header-text {
      display: flex;
      flex-direction: column;
      line-height: 1.2;
    }
    .irf-header-text span {
      font-size: 11px;
      display: block;
    }
    .irf-title {
      text-align: center;
      font-weight: bold;
      font-size: 16px;
      margin-top: 4px;
    }
    .irf-subtitle {
      text-align: center;
      font-size: 10px;
      margin-bottom: 6px;
    }
    .irf-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 4px;
    }
    .irf-table th,
    .irf-table td {
      border: 1px solid #000;
      padding: 3px 4px;
      vertical-align: top;
    }
    .irf-label {
      font-weight: bold;
      font-size: 10px;
      width: 110px;
    }
    .section-title-row th {
      text-align: center;
      font-weight: bold;
      font-size: 11px;
      background: #f5f5f5;
      padding: 4px 0;
    }
    .multi-line {
      min-height: 60px;
      white-space: pre-wrap;
    }
    .small {
      font-size: 10px;
    }
    .footer-note {
      font-size: 9px;
      margin-top: 4px;
    }
    .footer-sig {
      display: flex;
      justify-content: space-between;
      margin-top: 12px;
      font-size: 10px;
    }
    .footer-sig div {
      text-align: center;
      width: 45%;
      border-top: 1px solid #000;
      padding-top: 2px;
    }
  </style>
</head>
<body>
  <div class="irf-wrapper">
    <div class="irf-header-top">
      <img src="/assets/logo.png" alt="PNP Maritime Logo" class="irf-header-logo" />
      <div class="irf-header-text">
        <span>Republic of the Philippines</span>
        <span>Philippine National Police</span>
        <span>Maritime Group</span>
      </div>
    </div>
    <div class="irf-title">INCIDENT RECORD FORM</div>
    <div class="irf-subtitle">For Police Blotter Encoder Use Only</div>

    <table class="irf-table">
      <tr>
        <td class="irf-label">DATE AND TIME REPORTED</td>
        <td>${esc(incident.date_reported)}</td>
        <td class="irf-label">DATE AND TIME OF INCIDENT</td>
        <td>${esc(incident.date_incident)}</td>
      </tr>
      <tr>
        <td class="irf-label">NATURE OF CASE</td>
        <td>${esc(incident.nature)}</td>
        <td class="irf-label">CASE STATUS</td>
        <td>${esc(incident.status)}</td>
      </tr>
      <tr>
        <td class="irf-label">COORDINATES</td>
        <td>${esc(incident.coords)}</td>
        <td class="irf-label">LOCATION KIND / WATERBODY</td>
        <td>${esc(locKindWater)}</td>
      </tr>
      <tr>
        <td class="irf-label">PLACE OF INCIDENT</td>
        <td colspan="3">${esc(incident.place)}</td>
      </tr>
      <tr>
        <td class="irf-label">BRIEF NARRATIVE</td>
        <td colspan="3" class="multi-line">${esc(incident.narrative)}</td>
      </tr>
    </table>

    <table class="irf-table">
      <tr class="section-title-row">
        <th colspan="8">ITEM "A" — REPORTING PERSON</th>
      </tr>
      <tr>
        <td class="irf-label">FAMILY NAME</td>
        <td>${esc(reporting.last)}</td>
        <td class="irf-label">FIRST NAME</td>
        <td>${esc(reporting.first)}</td>
        <td class="irf-label">MIDDLE NAME</td>
        <td>${esc(reporting.middle)}</td>
        <td class="irf-label small">AGE</td>
        <td class="small">${esc(reporting.age)}</td>
      </tr>
      <tr>
        <td class="irf-label">SEX</td>
        <td>${esc(reporting.sex)}</td>
        <td class="irf-label">CITIZENSHIP</td>
        <td>${esc(reporting.citizenship)}</td>
        <td class="irf-label">PLACE OF BIRTH</td>
        <td colspan="3">${esc(reporting.pob)}</td>
      </tr>
      <tr>
        <td class="irf-label">OCCUPATION</td>
        <td colspan="3">${esc(reporting.occupation)}</td>
        <td class="irf-label">EMAIL</td>
        <td colspan="3">${esc(reporting.email)}</td>
      </tr>
      <tr>
        <td class="irf-label">CONTACT NO.</td>
        <td colspan="3">${esc(reporting.contact)}</td>
        <td class="irf-label">ADDRESS</td>
        <td colspan="3">${esc(reporting.address)}</td>
      </tr>
    </table>

    <table class="irf-table">
      <tr class="section-title-row">
        <th colspan="8">ITEM "B" — SUSPECT DATA</th>
      </tr>
      <tr>
        <td class="irf-label">FAMILY NAME</td>
        <td>${esc(suspect.last)}</td>
        <td class="irf-label">FIRST NAME</td>
        <td>${esc(suspect.first)}</td>
        <td class="irf-label">MIDDLE NAME</td>
        <td>${esc(suspect.middle)}</td>
        <td class="irf-label small">AGE</td>
        <td class="small">${esc(suspect.age)}</td>
      </tr>
      <tr>
        <td class="irf-label">BARANGAY</td>
        <td>${esc(suspect.barangay)}</td>
        <td class="irf-label">CITY / MUNICIPALITY</td>
        <td>${esc(suspect.city)}</td>
        <td class="irf-label">PROVINCE</td>
        <td>${esc(suspect.province)}</td>
        <td class="irf-label">REGION</td>
        <td>${esc(suspect.region)}</td>
      </tr>
      <tr>
        <td class="irf-label">ADDRESS</td>
        <td colspan="7">${esc(suspect.address)}</td>
      </tr>
      <tr>
        <td class="irf-label">OTHER DESCRIPTION / NARRATIVE</td>
        <td colspan="7" class="multi-line">${esc(suspect.desc)}</td>
      </tr>
    </table>

    <table class="irf-table">
      <tr class="section-title-row">
        <th colspan="8">ITEM "C" — VICTIM'S DATA</th>
      </tr>
      <tr>
        <td class="irf-label">FAMILY NAME</td>
        <td>${esc(victim.last)}</td>
        <td class="irf-label">FIRST NAME</td>
        <td>${esc(victim.first)}</td>
        <td class="irf-label">MIDDLE NAME</td>
        <td>${esc(victim.middle)}</td>
        <td class="irf-label small">AGE</td>
        <td class="small">${esc(victim.age)}</td>
      </tr>
      <tr>
        <td class="irf-label">SEX</td>
        <td>${esc(victim.sex)}</td>
        <td class="irf-label">CITIZENSHIP</td>
        <td>${esc(victim.citizenship)}</td>
        <td class="irf-label">BIRTHDATE</td>
        <td>${esc(victim.birthdate)}</td>
        <td class="irf-label">PLACE OF BIRTH</td>
        <td>${esc(victim.pob)}</td>
      </tr>
      <tr>
        <td class="irf-label">OCCUPATION</td>
        <td colspan="3">${esc(victim.occupation)}</td>
        <td class="irf-label">BARANGAY</td>
        <td>${esc(victim.barangay)}</td>
        <td class="irf-label">CITY / MUNICIPALITY</td>
        <td>${esc(victim.city)}</td>
      </tr>
      <tr>
        <td class="irf-label">PROVINCE</td>
        <td>${esc(victim.province)}</td>
        <td class="irf-label">ADDRESS</td>
        <td colspan="5">${esc(victim.address)}</td>
      </tr>
    </table>

    <table class="irf-table">
      <tr class="section-title-row">
        <th colspan="2">INCIDENT DETAILS</th>
      </tr>
      <tr>
        <td class="irf-label">NATURE OF CASE</td>
        <td>${esc(incident.nature)}</td>
      </tr>
      <tr>
        <td class="irf-label">BRIEF NARRATIVE</td>
        <td class="multi-line">${esc(incident.narrative)}</td>
      </tr>
      <tr>
        <td class="irf-label">COORDINATES</td>
        <td>${esc(incident.coords)}</td>
      </tr>
      <tr>
        <td class="irf-label">CASE STATUS</td>
        <td>${esc(incident.status)}</td>
      </tr>
    </table>

    <div class="footer-sig">
      <div>Prepared by / Reporting Person</div>
      <div>Desk Officer / Encoder</div>
    </div>

    <div class="footer-note">
      Note: CSS-SWJ IRF. Print on A4, scale 100%.
    </div>
  </div>
</body>
</html>`;

      printHTMLViaIframe(html);
    },
    [viewRow, suspects, printHTMLViaIframe]
  );

  /* ========== NAVBAR: fetch profile for topnav display ========== */
  const [user, setUser] = useState(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const headers = buildAuthHeader();
        if (!headers.Authorization) return;

        const res = await axios.get(`${API_BASE}/personnel/me/`, {
          headers,
          validateStatus: () => true,
        });
        if (!cancelled && res.status >= 200 && res.status < 300) {
          setUser(res.data || {});
        } else if (!cancelled && res.status === 401) {
          localStorage.clear();
          navigate("/Userlogin", { replace: true });
        }
      } catch (err) {
        if (!cancelled) {
          console.warn("Failed to load /personnel/me/ in UserViewReport:", err);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    window.location.href = "/Userlogin";
  };

  if (!authChecked) {
    return null;
  }

  const visibleImage = imageUrl(user || {});
  const rankLabel = user?.section || "—";

  // ========= Victim photo (from crimes API) =========
  // palitan ang field names depende sa API mo kung iba
  const victimPhotoPath =
    viewRow?.v_photo_url ||
    viewRow?.v_photo ||
    viewRow?.v_image ||
    viewRow?.v_profile_image ||
    null;

  const victimPhotoUrl = victimPhotoPath ? buildMediaUrl(victimPhotoPath) : null;

  /* === shared card styles for modal === */
  const modalCardBase = {
    background: "#ffffff",
    borderRadius: 14,
    border: "1px solid #e5e7eb",
    padding: 8,
  };
  const modalSectionTitle = {
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#9ca3af",
    marginBottom: 6,
  };

  return (
    <div>
      {/* Topnav */}
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
          >
            ☰
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ textAlign: "right", lineHeight: 1 }}>
            <div style={{ fontWeight: 600 }}>{rankLabel}</div>
          </div>

          <div style={{ textAlign: "right", lineHeight: 1 }}>
            <div style={{ fontWeight: 600 }}>{fullNameFromUser(user)}</div>
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
        {/* Sidebar */}
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
            <li>
              <Link to="/UserProfile">
                <FontAwesomeIcon icon={faUser} /> Profile Information
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
                    <Link to="/UserVictimReport">Add Reports</Link>
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

        {/* Main content */}
        <main
          className={`main-content ${
            !sidebarOpen ? "sidebar-collapsed" : ""
          }`}
        >
            <form className="up-form" onSubmit={handleGenerate} style={{ maxWidth: 560, margin: "0 auto 16px" }}>
              <h2 style={{ marginBottom: 12, textAlign: "center"}}>View Reports</h2>
              <div className="up-input">
                <label>Date Committed From</label>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  max={to || undefined}
                  required
                />
              </div>
              <div className="up-input">
                <label>Date Committed To</label>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  min={from || undefined}
                  required
                />
              </div>
              <div className="up-input">
                <label>Select Province (crime location)</label>
                <select
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                >
                  {PROVINCES_R4A.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="up-btn"
                disabled={!valid || loading}
                style={{ width: "100%", marginTop: 6 }}
              >
                {loading ? "Generating…" : "GENERATE TABLE"}
              </button>
              {!valid && (
                <small
                  className="up-alert error"
                  style={{ marginTop: 8 }}
                >
                  “From” date must be earlier than or equal to “To”.
                </small>
              )}
            </form>
        

          {/* RESULTS */}
          {hasGenerated && (
            <div className="card" style={{ overflow: "hidden" }}>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 10,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ fontSize: 14, color: "#6b7280" }}>
                  Period: <strong>{from}</strong> to <strong>{to}</strong> •
                  Province: <strong>{province}</strong>
                </div>
                <button
                  className="up-btn ghost"
                  type="button"
                  onClick={exportCSV}
                  disabled={!rows.length}
                >
                  Export CSV
                </button>
              </div>

              {/* Tabs */}
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  marginBottom: 10,
                }}
              >
                <button
                  type="button"
                  onClick={() => setCurrentTab("all")}
                  className="up-btn ghost"
                  style={{
                    border:
                      currentTab === "all"
                        ? "2px solid #1a237e"
                        : "1px solid #c7d2fe",
                  }}
                >
                  View (All)
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentTab("solved")}
                  className="up-btn ghost"
                  style={{
                    border:
                      currentTab === "solved"
                        ? "2px solid #16a34a"
                        : "1px solid #c7d2fe",
                  }}
                >
                  Solved
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentTab("unsolved")}
                  className="up-btn ghost"
                  style={{
                    border:
                      currentTab === "unsolved"
                        ? "2px solid #dc2626"
                        : "1px solid #c7d2fe",
                  }}
                >
                  Unsolved
                </button>
              </div>

              {/* Search + List filters */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "1fr repeat(2, minmax(160px, 220px))",
                  gap: 10,
                  marginBottom: 12,
                }}
              >
                <input
                  type="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search: blotter #, name, crime type, address, description…"
                  style={{
                    padding: "10px 12px",
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    background: "#f9fafb",
                  }}
                />
                <select
                  value={crimeFilter}
                  onChange={(e) => setCrimeFilter(e.target.value)}
                  style={{
                    padding: "10px 12px",
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    background: "#f9fafb",
                    color: crimeFilter === "All" ? "#6b7280" : "#000",
                  }}
                >
                  {crimeTypeOptions.map((c) => (
                    <option key={c} value={c}>
                      {c === "All" ? "All Crime Types" : c}
                    </option>
                  ))}
                </select>
                <select
                  value={cityFilter}
                  onChange={(e) => setCityFilter(e.target.value)}
                  style={{
                    padding: "10px 12px",
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    background: "#f9fafb",
                    color: cityFilter === "All" ? "#6b7280" : "#000",
                  }}
                >
                  {cityOptions.map((c) => (
                    <option key={c} value={c}>
                      {c === "All"
                        ? "All Cities/Municipalities"
                        : c}
                    </option>
                  ))}
                </select>
              </div>

              {err && (
                <div
                  className="up-alert error"
                  style={{ marginBottom: 10 }}
                >
                  {err}
                </div>
              )}
              {loading && <div className="up-skel">Loading…</div>}

              {!loading && filteredRows.length === 0 && !err && (
                <div
                  className="up-alert"
                  style={{ background: "#f3f4f6" }}
                >
                  No reports found for the selected filters/tab.
                </div>
              )}

              {!loading && filteredRows.length > 0 && (
                <div
                  style={{
                    overflowX: "auto",
                    border: "1px solid var(--border-color)",
                    borderRadius: 12,
                  }}
                >
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                    }}
                    cellPadding="8"
                  >
                    <thead style={{ background: "#f7f7f7", justifyContent: "center", }}>
                      <tr>
                        <th align="center">Blotter #</th>
                        <th align="center">Type of Crime</th>
                        <th align="center">Victim Name</th>
                        <th align="center">Age</th>
                        <th align="center">Victim Address</th>
                        <th align="center">Crime Location</th>
                        <th align="center">Date</th>
                        <th align="center">Status</th>
                        <th
                          align="center "
                          style={{ minWidth: 100 }}
                        >
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.map((v) => {
                        const id =
                          v.id ?? `${v.happened_at}_${Math.random()}`;
                        const status = normalizeVictimStatus(v);
                        const state = saveStates[v.id] || "idle";
                        return (
                          <tr key={id}>
                            <td>
                              {v.blotter_number || "—"}
                              {v.blotter_number && (
                                <CopyBtn value={v.blotter_number} />
                              )}
                            </td>
                            <td>
                              {v.crime_type || "—"}{" "}
                              {status === "Solved" && (
                                <span
                                  style={{
                                    color: "#16a34a",
                                    fontWeight: 700,
                                  }}
                                >
                                  [Solved]
                                </span>
                              )}
                            </td>
                            <td>
                              {fullName(
                                v.v_first_name,
                                v.v_middle_name,
                                v.v_last_name
                              ) || "—"}
                            </td>
                            <td>{v.v_age || "—"}</td>
                            <td
                              style={{
                                whiteSpace: "pre-line",
                              }}
                            >
                              {addrBlock("v", v) || "—"}
                            </td>
                            <td
                              style={{
                                whiteSpace: "pre-line",
                              }}
                            >
                              {addrBlock("loc", v) || "—"}
                            </td>
                            <td>
                              {String(v.happened_at || "").slice(
                                0,
                                10
                              )}
                            </td>
                            <td>{status}</td>
                            <td>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 10,
                                  flexWrap: "wrap",
                                }}
                              >
                                <RowActions
                                  row={v}
                                  status={status}
                                  onView={openView}
                                  onSetStatus={updateStatus}
                                  onPrintIRFCSS={printIRF_CSS}
                                  busy={state === "saving"}
                                />
                                <small
                                  style={{
                                    minWidth: 64,
                                    color:
                                      state === "saving"
                                        ? "#6b7280"
                                        : state === "saved"
                                        ? "#16a34a"
                                        : state === "error"
                                        ? "#dc2626"
                                        : "#9ca3af",
                                  }}
                                >
                                  {state === "saving"
                                    ? "Saving…"
                                    : state === "saved"
                                    ? "Saved"
                                    : state === "error"
                                    ? "Error"
                                    : ""}
                                </small>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* VIEW MODAL – naka-card design gaya ng screenshot */}
          {viewOpen && viewRow && (
            <div
              onClick={closeView}
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,.35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 16,
                zIndex: 9999,
              }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: "min(980px,96vw)",
                  maxHeight: "92vh",
                  background: "#f3f4f6",
                  borderRadius: 16,
                  boxShadow: "0 10px 30px rgba(0,0,0,.2)",
                  overflow: "auto",
                  padding: 14,
                }}
              >
                {/* Header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    marginBottom: 10,
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <div
                      style={{
                        fontSize: 18,
                        fontWeight: 700,
                        color: "#111827",
                      }}
                    >
                      Victim Details
                    </div>
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        marginTop: 4,
                        fontSize: 12,
                      }}
                    >
                      <span
                        style={{
                          padding: "4px 8px",
                          borderRadius: 999,
                          background: "#e5e7eb",
                          fontWeight: 600,
                          color: "#374151",
                        }}
                      >
                        BLOTTER #{" "}
                        {viewRow?.blotter_number || "—"}
                      </span>
                      {viewRow?.blotter_number && (
                        <CopyBtn value={viewRow.blotter_number} />
                      )}
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      onClick={() => printIRF_CSS()}
                      type="button"
                      style={{
                        padding: "8px 16px",
                        borderRadius: 999,
                        border: "none",
                        background: "#16a34a",
                        color: "#fff",
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: "pointer",
                      }}
                    >
                      🖨️ Print IRF
                    </button>
                    <button
                      onClick={closeView}
                      type="button"
                      style={{
                        padding: "8px 14px",
                        borderRadius: 999,
                        border: "1px solid #d1d5db",
                        background: "#fff",
                        fontSize: 13,
                        cursor: "pointer",
                      }}
                    >
                      Close
                    </button>
                  </div>
                </div>

                {/* BODY GRID – top row: victim card + incident overview */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1.1fr)",
                    gap: 12,
                    marginBottom: 12,
                  }}
                >
                  {/* Victim card */}
                  <div style={modalCardBase}>
                    <div style={modalSectionTitle}>Victim</div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "100px minmax(0,1fr)",
                        gap: 10,
                        alignItems: "center",
                      }}
                    >
                      {/* Victim photo */}
                      <div
                        style={{
                          width: 92,
                          height: 92,
                          borderRadius: 12,
                          overflow: "hidden",
                          background: "#e5e7eb",
                          display: "grid",
                          placeItems: "center",
                        }}
                      >
                        {victimPhotoUrl ? (
                          <img
                            src={victimPhotoUrl}
                            alt="Victim"
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                            }}
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                              const parent = e.currentTarget.parentElement;
                              if (parent) {
                                parent.textContent = "No Photo";
                                parent.style.fontSize = "11px";
                                parent.style.color = "#9ca3af";
                                parent.style.fontWeight = "500";
                              }
                            }}
                          />
                        ) : (
                          <span
                            style={{
                              fontSize: 11,
                              color: "#9ca3af",
                              fontWeight: 500,
                            }}
                          >
                            No Photo
                          </span>
                        )}
                      </div>

                      <div>
                        <div
                          style={{
                            fontSize: 16,
                            fontWeight: 700,
                            marginBottom: 4,
                          }}
                        >
                          {fullName(
                            viewRow?.v_first_name,
                            viewRow?.v_middle_name,
                            viewRow?.v_last_name
                          ) || "—"}
                        </div>
                        <div
                          style={{
                            fontSize: 13,
                            color: "#4b5563",
                            marginBottom: 4,
                          }}
                        >
                          Age:{" "}
                          {viewRow?.v_age || "—"}{" "}
                          • Sex: {viewRow?.v_sex || "—"}
                        </div>
                        <div
                          style={{
                            fontSize: 13,
                            color: "#4b5563",
                            marginBottom: 4,
                          }}
                        >
                          <span style={{ fontWeight: 600 }}>
                            Type of Crime / Incident:
                          </span>{" "}
                          {viewRow?.crime_type || "—"}
                        </div>

                        {/* Status pill */}
                        {(() => {
                          const status = normalizeVictimStatus(viewRow);
                          let bg = "#fef3c7";
                          let text = "#92400e";
                          if (status === "Solved") {
                            bg = "#dcfce7";
                            text = "#166534";
                          } else if (status === "Unsolved") {
                            bg = "#fee2e2";
                            text = "#b91c1c";
                          }
                          return (
                            <div style={{ marginTop: 4 }}>
                              <span
                                style={{
                                  fontSize: 11,
                                  textTransform: "uppercase",
                                  letterSpacing: "0.08em",
                                  color: "#6b7280",
                                  marginRight: 6,
                                  fontWeight: 600,
                                }}
                              >
                                Case Status
                              </span>
                              <span
                                style={{
                                  padding: "4px 10px",
                                  borderRadius: 999,
                                  fontSize: 11,
                                  fontWeight: 700,
                                  background: bg,
                                  color: text,
                                }}
                              >
                                {status}
                              </span>
                            </div>
                          );
                        })()}

                      </div>
                    </div>
                     {/* 🔥 RECORD META (FULL WIDTH) */}
                        <div
                          style={{
                            gridColumn: "1 / -1", // 💥 eto ang magic (full width)
                            marginTop: 8,
                            background: "#ffffff",
                            borderRadius: 14,
                            border: "1px solid #e5e7eb",
                            padding: 8,
                            
                          }}
                        >
                          Record Meta

                          <div>
                            {/* Prepared by */}
                            <div
                              
                            >
                              <div
                                style={{
                                  fontSize: 11,
                                  textTransform: "uppercase",
                                  color: "#9ca3af",
                                  marginBottom: 4,
                                }}
                              >
                                Prepared by (User)
                              </div>
                              <div style={{ fontWeight: 600 }}>
                                {viewRow?.prepared_by_name || "—"}
                              </div>
                            </div>

                            {/* Desk Officer */}
                         
                              <div
                                style={{
                                  fontSize: 11,
                                  textTransform: "uppercase",
                                  color: "#9ca3af",
                                  marginBottom: 4,
                                }}
                              >
                                Desk Officer / Encoder
                              </div>
                              <div style={{ fontWeight: 600 }}>
                                {viewRow?.desk_officer_name || "—"}
                              </div>
                           

                            {/* Reported by */}
                           
                              <div
                                style={{
                                  fontSize: 11,
                                  textTransform: "uppercase",
                                  color: "#9ca3af",
                                  marginBottom: 4,
                                }}
                              >
                                Reported by
                              </div>
                              <div style={{ fontWeight: 600 }}>
                                {viewRow?.reported_by || "—"}
                              </div>
                          </div>
                        </div>

                  </div>

                  {/* Incident Overview card */}
                  <div style={modalCardBase}>
                    <div style={modalSectionTitle}>Incident Overview</div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(2, minmax(0,1fr))",
                        gap: 8,
                        fontSize: 12,
                        marginBottom: 8,
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: 11,
                            textTransform: "uppercase",
                            letterSpacing: "0.08em",
                            color: "#9ca3af",
                            marginBottom: 2,
                          }}
                        >
                          Date & Time Reported
                        </div>
                        <div style={{ fontWeight: 500, color: "#111827" }}>
                          {viewRow?.created_at
                            ? new Date(
                                viewRow.created_at
                              ).toLocaleString()
                            : "—"}
                        </div>
                      </div>
                      <div>
                        <div
                          style={{
                            fontSize: 11,
                            textTransform: "uppercase",
                            letterSpacing: "0.08em",
                            color: "#9ca3af",
                            marginBottom: 2,
                          }}
                        >
                          Date of Incident
                        </div>
                        <div style={{ fontWeight: 500, color: "#111827" }}>
                          {viewRow?.happened_at
                            ? new Date(
                                viewRow.happened_at
                              ).toLocaleDateString()
                            : "—"}
                        </div>
                      </div>
                    </div>

                    {/* Current status highlight bar */}
                    {(() => {
                      const status = normalizeVictimStatus(viewRow);
                      return (
                        <div
                          style={{
                            padding: "6px 10px",
                            borderRadius: 999,
                            background: "#fef3c7",
                            fontSize: 12,
                            fontWeight: 600,
                            color: "#92400e",
                            marginBottom: 10,
                          }}
                        >
                          Current Status: {status}
                        </div>
                      );
                    })()}

                    {/* Brief narrative */}
                    <div style={{ marginBottom: 10 }}>
                      <div
                        style={{
                          fontSize: 11,
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                          color: "#9ca3af",
                          marginBottom: 4,
                        }}
                      >
                        Brief Narrative
                      </div>
                      <div
                        style={{
                          borderRadius: 10,
                          border: "1px solid #e5e7eb",
                          background: "#f9fafb",
                          padding: 8,
                          fontSize: 13,
                          color: "#111827",
                          minHeight: 40,
                        }}
                      >
                        {viewRow?.description || "—"}
                      </div>
                    </div>

                    {/* Map preview */}
                    <div>
                      <div
                        style={{
                          fontSize: 11,
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                          color: "#9ca3af",
                          marginBottom: 4,
                        }}
                      >
                        Map Preview
                      </div>
                      <ReadOnlyMap
                        latitude={viewRow?.latitude}
                        longitude={viewRow?.longitude}
                        height={210}
                      />
                    </div>
                  </div>
                </div>

                {/* Second row: Address info + Linked suspects */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1.1fr)",
                    gap: 12,
                  }}
                >
                  {/* Address Information card */}
                  <div style={modalCardBase}>
                    <div style={modalSectionTitle}>Address Information</div>

                    <div style={{ marginBottom: 8 }}>
                      <div
                        style={{
                          fontSize: 11,
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                          color: "#9ca3af",
                          marginBottom: 4,
                        }}
                      >
                        Registered Address
                      </div>
                      <pre
                        style={{
                          margin: 0,
                          padding: 8,
                          borderRadius: 10,
                          border: "1px solid #e5e7eb",
                          background: "#f9fafb",
                          whiteSpace: "pre-wrap",
                          fontSize: 13,
                          color: "#111827",
                        }}
                      >
                        {addrBlock("v", viewRow) || "—"}
                      </pre>
                    </div>

                    <div>
                      <div
                        style={{
                          fontSize: 11,
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                          color: "#9ca3af",
                          marginBottom: 4,
                        }}
                      >
                        Crime Location
                      </div>
                      <pre
                        style={{
                          margin: 0,
                          padding: 8,
                          borderRadius: 10,
                          border: "1px solid #e5e7eb",
                          background: "#f9fafb",
                          whiteSpace: "pre-wrap",
                          fontSize: 13,
                          color: "#111827",
                        }}
                      >
                        {addrBlock("loc", viewRow) || "—"}
                        {viewRow?.latitude && viewRow?.longitude
                          ? `\n(${viewRow.latitude}, ${viewRow.longitude})`
                          : ""}
                        {viewRow?.loc_kind
                          ? `\n${String(
                              viewRow.loc_kind
                            ).toUpperCase()}${
                              viewRow?.loc_waterbody
                                ? ` (${viewRow.loc_waterbody})`
                                : ""
                            }`
                          : ""}
                      </pre>
                    </div>
                  </div>

                  {/* Linked Suspects card – card list (no table) */}
                  <div style={modalCardBase}>
                    <div style={modalSectionTitle}>
                      Linked Suspects in this Case
                    </div>
                    <SuspectsTable suspects={suspectsForViewRow} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

/* ---- Suspects list (card-style, NO TABLE, pure inline CSS) ---- */
function SuspectsTable({ suspects }) {
  if (!suspects || suspects.length === 0) {
    return (
      <div style={{ color: "#6b7280", fontSize: 13 }}>
        No suspects linked to this case.
      </div>
    );
  }

  const listStyle = {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  };

  const cardStyle = {
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: "#f9fafb",
    padding: 8,
    display: "grid",
    gridTemplateColumns: "70px minmax(0,1fr)",
    gap: 8,
    alignItems: "center",
  };

  const avatarWrapper = {
    width: 70,
    height: 70,
    borderRadius: 999,
    overflow: "hidden",
    background: "#e5e7eb",
    display: "grid",
    placeItems: "center",
  };

  const avatarImg = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  };

  const avatarPlaceholder = {
    fontSize: 11,
    color: "#9ca3af",
  };

  const nameStyle = {
    fontSize: 14,
    fontWeight: 700,
    color: "#111827",
    marginBottom: 2,
  };

  const metaStyle = {
    fontSize: 12,
    color: "#4b5563",
    marginBottom: 2,
  };

  const addrStyle = {
    fontSize: 12,
    color: "#4b5563",
    whiteSpace: "pre-wrap",
  };

  const badgeStyle = {
    fontSize: 11,
    padding: "2px 8px",
    borderRadius: 999,
    background: "#e0f2fe",
    color: "#1d4ed8",
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    marginBottom: 4,
    display: "inline-block",
  };

  return (
    <div style={listStyle}>
      {suspects.map((s, index) => {
        const name =
          [s.s_first_name, s.s_middle_name, s.s_last_name]
            .filter(Boolean)
            .join(" ") || "—";

        const barangayCity =
          [s.s_barangay, s.s_city_municipality].filter(Boolean).join(", ") ||
          "—";

        const provinceRegion =
          [s.s_province, s.s_region].filter(Boolean).join(", ") || "—";

        const desc = s.s_description || s.s_address || "—";

        const suspectPhotoPath =
          s.s_photo_url || s.s_photo || s.s_image || s.s_profile_image || "";
        const photoSrc = buildMediaUrl(suspectPhotoPath);

        return (
          <div style={cardStyle} key={s.id || index}>
            <div style={avatarWrapper}>
              {photoSrc ? (
                <img
                  src={photoSrc}
                  alt="Suspect"
                  style={avatarImg}
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                    const parent = e.currentTarget.parentElement;
                    if (parent) {
                      parent.textContent = "No Image";
                      parent.style.fontSize = "11px";
                      parent.style.color = "#9ca3af";
                    }
                  }}
                />
              ) : (
                <span style={avatarPlaceholder}>No Image</span>
              )}
            </div>

            <div>
              <div style={badgeStyle}>Suspect #{index + 1}</div>
              <div style={nameStyle}>{name}</div>
              <div style={metaStyle}>
                Age: {s.s_age || "—"}
              </div>
              <div style={metaStyle}>
                {barangayCity}
              </div>
              <div style={metaStyle}>{provinceRegion}</div>
              <div style={addrStyle}>{desc}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
