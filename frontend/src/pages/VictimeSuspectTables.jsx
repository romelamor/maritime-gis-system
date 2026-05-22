// src/pages/VictimSuspectTables.jsx
import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import "../assets/css/victim-suspect.css";
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
import html2pdf from "html2pdf.js";
import * as XLSX from "xlsx";
import Swal from "sweetalert2";
/* ============ LEAFLET ============ */
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/* ===== Fix Leaflet marker asset paths ===== */
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

/* ================== CONFIG ================== */
const API_BASE = "https://maritime-backend-0gib.onrender.com/api";
const VICTIM_STATUSES = ["Ongoing", "Solved", "Unsolved"];

/* 🔐 AUTH HEADER (same pattern as Dashboard.jsx) */
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

/* ================== HELPERS ================== */
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

const addrLine = (prefix, o) =>
  [
    o?.[`${prefix}_address`],
    o?.[`${prefix}_barangay`],
    o?.[`${prefix}_city_municipality`],
    o?.[`${prefix}_province`],
  ]
    .filter(Boolean)
    .join(", ");

const toDate = (iso) => (iso ? String(iso).split("T")[0] : "");

const normalizeVictimStatus = (row) => {
  const s = String(
    row?.status ?? row?.case_status ?? row?.is_active ?? row?._status ?? ""
  ).trim();
  return VICTIM_STATUSES.includes(s) ? s : "Ongoing";
};

const getVictimPhotoUrl = (row) =>
  row?.v_photo_url ||
  row?.v_photo ||
  row?.v_image_url ||
  row?.victim_photo_url ||
  row?.victim_photo ||
  "";

const getSuspectPhotoUrl = (row) =>
  row?.s_photo_url ||
  row?.s_photo ||
  row?.s_image_url ||
  row?.suspect_photo_url ||
  row?.suspect_photo ||
  "";

const getSuspectCrimeId = (s) =>
  s?.crime_report ??
  s?.crime_report_id ??
  s?.crime ??
  s?.crime_id ??
  s?.report ??
  null;

const getLinkedVictimIds = (s) => {
  const ids = [];
  const cid = getSuspectCrimeId(s);
  if (cid != null) ids.push(cid);
  if (s?.victim != null) ids.push(s.victim);
  if (s?.victim_id != null) ids.push(s.victim_id);
  if (Array.isArray(s?.victims)) ids.push(...s.victims);
  return [...new Set(ids.flat().map((x) => String(x)))];
};

const norm = (v) => String(v ?? "").toLowerCase();

/* 🔍 SEARCH MATCHERS */
function matchVictimRow(row, query) {
  if (!query) return true;
  const q = query.toLowerCase();

  const fields = [
    row.blotter_number,
    fullName(row.v_first_name, row.v_middle_name, row.v_last_name),
    row.crime_type,
    row.v_address,
    row.v_barangay,
    row.v_city_municipality,
    row.v_province,
    row.loc_address,
    row.loc_barangay,
    row.loc_city_municipality,
    row.loc_province,
    row.loc_waterbody,
    normalizeVictimStatus(row),
    row.happened_at,
  ];

  return fields.some((f) => norm(f).includes(q));
}

function matchSuspectRow(row, query, getBlotterByCrimeIdFn) {
  if (!query) return true;
  const q = query.toLowerCase();

  const cid = getSuspectCrimeId(row);
  const blotter = row.blotter_number || getBlotterByCrimeIdFn(cid) || "";

  const fields = [
    blotter,
    fullName(row.s_first_name, row.s_middle_name, row.s_last_name),
    row.s_crime_type,
    row.s_address,
    row.s_barangay,
    row.s_city_municipality,
    row.s_province,
    row.s_region,
    row.loc_address,
    row.loc_barangay,
    row.loc_city_municipality,
    row.loc_province,
    row.loc_waterbody,
    row.created_at,
  ];

  return fields.some((f) => norm(f).includes(q));
}

/* Small UI util: copy text */
const CopyBtn = ({ value, title = "Copy" }) => (
  <button
    className="vs-copy-btn"
    onClick={() => navigator.clipboard.writeText(String(value ?? ""))}
    title={title}
    style={{ marginLeft: 6 }}
  >
    Copy
  </button>
);

/* ================== ACTION DROPDOWN COMPONENT (portal) ================== */
function ActionDropdown({ items = [], label = "Actions" }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const [coords, setCoords] = useState(null);

  useEffect(() => {
    function onDocClick(e) {
      if (btnRef.current && btnRef.current.contains(e.target)) return;
      if (menuRef.current && menuRef.current.contains(e.target)) return;
      setOpen(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  const toggle = (e) => {
    e?.preventDefault();
    setOpen((s) => !s);
  };

  const updateCoords = () => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setCoords({
      top: r.bottom + window.scrollY + 6,
      left: r.left + window.scrollX,
      btnRight: r.right + window.scrollX,
    });
  };

  useEffect(() => {
    if (open) updateCoords();
    const onRS = () => {
      if (open) updateCoords();
    };
    window.addEventListener("resize", onRS);
    window.addEventListener("scroll", onRS, true);
    return () => {
      window.removeEventListener("resize", onRS);
      window.removeEventListener("scroll", onRS, true);
    };
  }, [open]);

  const menu = open ? (
    <div
      ref={menuRef}
      className="vs-dropdown-menu"
      role="menu"
      style={{
        position: "absolute",
        top: coords?.top || 0,
        left: coords?.left || 0,
        zIndex: 240000,
        minWidth: 140,
      }}
    >
      {items.map((it, idx) => (
        <div key={idx} role="menuitem">
          <button
            className="vs-dropdown-item"
            onClick={() => {
              setOpen(false);
              it.onClick?.();
            }}
            style={{
              width: "100%",
              textAlign: "left",
              padding: "8px 12px",
              background: "transparent",
              border: "none",
              cursor: "pointer",
            }}
          >
            {it.label}
          </button>
        </div>
      ))}
    </div>
  ) : null;

  const printable = (
    <div
      className="vs-print-actions"
      aria-hidden="true"
      style={{ display: "none" }}
    >
      {items.map((it, idx) => (
        <span
          key={idx}
          className="vs-print-action-item"
          style={{ marginRight: 8 }}
        >
          {it.label}
        </span>
      ))}
    </div>
  );

  return (
    <>
      <div className="vs-dropdown" style={{ display: "inline-block" }}>
        <button
          ref={btnRef}
          className="vs-dropdown-btn"
          aria-haspopup="true"
          aria-expanded={open}
          onClick={(e) => {
            toggle(e);
          }}
          title={label}
          type="button"
        >
          {label} <span className="vs-caret">▾</span>
        </button>
      </div>

      {menu && createPortal(menu, document.body)}

      {/* Print-only simplified actions */}
      {printable}
    </>
  );
}

/* ================== PAGE ================== */
function VictimSuspectTables() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [submenuOpen, setSubmenuOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const [victimsActive, setVictimsActive] = useState([]);
  const [victimsSolved, setVictimsSolved] = useState([]);
  const [suspects, setSuspects] = useState([]);

  const [loadingVictims, setLoadingVictims] = useState(true);
  const [loadingSuspects, setLoadingSuspects] = useState(true);
  const [error, setError] = useState("");

  const [currentTab, setCurrentTab] = useState("victims");

  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;
  const [saveStates, setSaveStates] = useState({});
  const setRowSaveState = (key, state) =>
    setSaveStates((prev) => ({ ...prev, [key]: state }));

  const timersRef = useRef({});
  const controllersRef = useRef({});

  const [viewOpen, setViewOpen] = useState(false);
  const [viewKind, setViewKind] = useState(null); // "victim" | "suspect"
  const [viewData, setViewData] = useState(null);
  const [viewReadOnly, setViewReadOnly] = useState(false);

  // 🔐 route guard flag
  const [authChecked, setAuthChecked] = useState(false);

  // 🔍 search
  const [searchQuery, setSearchQuery] = useState("");

  const navigate = useNavigate();

  /* 🔐 logout helper */
  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("access_token");
    localStorage.removeItem("access");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("refresh");
    navigate("/login", { replace: true });
  }, [navigate]);

  /* 🔐 Route guard: redirect to /login if walang token */
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

  /* ========= LOAD DATA ========= */
  // 🔹 fetch data
  useEffect(() => {
    if (!authChecked) return;
    fetchVictimsSplit();
    fetchSuspects();
  }, [authChecked]);

  // 🔹 reset page (STEP 2)
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, currentTab]);

  // const fetchVictimsSplit = async () => {
  //   setLoadingVictims(true);
  //   try {
  //     const res = await axios.get(`${API_BASE}/crimes/`, {
  //       params: { is_archived: false, ordering: "-created_at" },
  //       headers: authHeader(),
  //     });
  //     const rows = Array.isArray(res.data) ? res.data : res.data.results || [];
  //     const normalized = rows.map((r) => ({
  //       ...r,
  //       _status: normalizeVictimStatus(r),
  //     }));
  //     setVictimsActive(normalized.filter((r) => r._status !== "Solved"));
  //     setVictimsSolved(normalized.filter((r) => r._status === "Solved"));
  //   } catch (err) {
  //     if (err?.response?.status === 401) {
  //       logout();
  //       return;
  //     }
  //     console.error("Error loading victims:", err?.response?.data || err.message);
  //     setError("Failed to load victim data.");
  //   } finally {
  //     setLoadingVictims(false);
  //   }
  // };

  const fetchVictimsSplit = async () => {
    setLoadingVictims(true);
    try {
      let url = `${API_BASE}/crimes/?is_archived=false&ordering=-created_at`;
      let allRows = [];

      while (url) {
        const res = await axios.get(url, { headers: authHeader() });

        const data = Array.isArray(res.data)
          ? res.data
          : res.data.results || [];

        allRows = [...allRows, ...data];

        url = res.data.next; // 🔥 kuha next page
      }

      const normalized = allRows.map((r) => ({
        ...r,
        _status: normalizeVictimStatus(r),
      }));

      setVictimsActive(normalized.filter((r) => r._status !== "Solved"));
      setVictimsSolved(normalized.filter((r) => r._status === "Solved"));
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingVictims(false);
    }
  };

  const fetchSuspects = async () => {
    setLoadingSuspects(true);
    try {
      const res = await axios.get(`${API_BASE}/suspects/`, {
        params: { ordering: "-created_at" },
        headers: authHeader(),
      });
      setSuspects(Array.isArray(res.data) ? res.data : res.data.results || []);
    } catch (err) {
      if (err?.response?.status === 401) {
        logout();
        return;
      }
      console.error(
        "Error loading suspects:",
        err?.response?.data || err.message
      );
      setError("Failed to load suspect data.");
    } finally {
      setLoadingSuspects(false);
    }
  };

  /* ========= OPEN / CLOSE VIEW ========= */
  const openView = (kind, row, readonly = false) => {
    if (!row) return;
    setViewKind(kind);
    setViewData(
      kind === "victim" ? { ...row, _status: normalizeVictimStatus(row) } : row
    );
    setViewReadOnly(!!readonly);
    setViewOpen(true);
  };

  const closeView = () => {
    setViewOpen(false);
    setViewKind(null);
    setViewData(null);
    setViewReadOnly(false);
  };

  const editFromView = () => {
    if (!viewData || !viewKind) return;
    const id = viewData.id;
    closeView();
    setTimeout(() => {
      navigate(viewKind === "victim" ? `/AdminCrime?id=${id}` : `/AdminSuspect?id=${id}`);
    }, 0);
  };

  /* ========= VIEW META (Prepared By / Desk Officer) ========= */
  const viewMeta = useMemo(() => {
    if (!viewData) {
      return {
        reporterName: "—",
        encoderName: "—",
        inferredRole: "User",
        preparedByLabel: "Prepared by (User)",
        preparedByName: "—",
      };
    }

    const safe = (v, d = "—") =>
      v === null || v === undefined || String(v).trim() === "" ? d : String(v);

    const reporterName =
      fullName(
        viewData.rp_first_name || viewData.reported_by_first_name,
        viewData.rp_middle_name || viewData.reported_by_middle_name,
        viewData.rp_last_name || viewData.reported_by_last_name
      ) ||
      safe(viewData.reported_by_name, "") ||
      safe(viewData.prepared_by_name, "") ||
      safe(viewData.created_by_name, "") ||
      safe(viewData.created_by, "") ||
      "—";

    const encoderName =
      safe(viewData.encoded_by_name, "") ||
      safe(viewData.encoder_name, "") ||
      safe(viewData.desk_officer_name, "") ||
      safe(viewData.encoded_by, "") ||
      safe(viewData.prepared_by_name, "") ||
      safe(viewData.created_by_name, "") ||
      safe(viewData.created_by, "") ||
      "—";

    const reporterRoleRaw =
      viewData.reported_by_role ||
      viewData.report_source ||
      viewData.source ||
      viewData.created_by_role ||
      "";

    const inferredRole =
      String(reporterRoleRaw).toLowerCase().includes("admin") ||
      viewData.is_admin_report === true ||
      viewData.by_admin === true
        ? "Admin"
        : "User";

    const preparedByLabel =
      inferredRole === "Admin" ? "Prepared by (Admin)" : "Prepared by (User)";
    const preparedByName = inferredRole === "Admin" ? encoderName : reporterName;

    return { reporterName, encoderName, inferredRole, preparedByLabel, preparedByName };
  }, [viewData, viewKind]);


  const allVictims = useMemo(
    () => [...victimsActive, ...victimsSolved],
    [victimsActive, victimsSolved]
  );

  /* helper: blotter by crime id */
  const getBlotterByCrimeId = useCallback(
    (crimeId) => {
      if (!crimeId) return "";
      const v = allVictims.find((x) => String(x.id) === String(crimeId));
      return v?.blotter_number || "";
    },
    [allVictims]
  );

  /* ========= SEARCHED / FILTERED ROWS ========= */
  const filteredVictimsActive = useMemo(
    () => victimsActive.filter((r) => matchVictimRow(r, searchQuery)),
    [victimsActive, searchQuery]
  );
  

  const filteredVictimsSolved = useMemo(
    () => victimsSolved.filter((r) => matchVictimRow(r, searchQuery)),
    [victimsSolved, searchQuery]
  );

  const filteredSuspects = useMemo(
    () => suspects.filter((r) => matchSuspectRow(r, searchQuery, getBlotterByCrimeId)),
    [suspects, searchQuery, getBlotterByCrimeId]
  );



  const paginatedVictimsActive = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredVictimsActive.slice(start, start + rowsPerPage);
  }, [filteredVictimsActive, currentPage]);

  const paginatedVictimsSolved = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredVictimsSolved.slice(start, start + rowsPerPage);
  }, [filteredVictimsSolved, currentPage]);

  const paginatedSuspects = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredSuspects.slice(start, start + rowsPerPage);
  }, [filteredSuspects, currentPage]);
  // 🔥 TOTAL PAGES (STEP 1)
  const totalPagesVictims = Math.ceil(filteredVictimsActive.length / rowsPerPage);
  const totalPagesSolved = Math.ceil(filteredVictimsSolved.length / rowsPerPage);
  const totalPagesSuspects = Math.ceil(filteredSuspects.length / rowsPerPage);

  /* ================== ARCHIVE ================== */
  const handleArchiveVictim = async (row) => {
    const { id } = row || {};
    if (!id) return;
    const confirm = await Swal.fire({
      title: "Archive Report?",
      text: "This victim report will be moved to archive.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, Archive",
      cancelButtonText: "Cancel",
    });

    if (!confirm.isConfirmed) return;
    const wasInActive = victimsActive.some((v) => v.id === id);
    const wasInSolved = victimsSolved.some((v) => v.id === id);

    if (wasInActive) setVictimsActive((p) => p.filter((v) => v.id !== id));
    if (wasInSolved) setVictimsSolved((p) => p.filter((v) => v.id !== id));

    try {
      await axios.patch(
        `${API_BASE}/crimes/${id}/`,
        { is_archived: true },
        {
          headers: {
            ...authHeader(),
            "Content-Type": "application/json",
          },
        }
      );
      Swal.fire({
        icon: "success",
        title: "Archived",
        text: "Victim report archived successfully.",
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (e1) {
      try {
        const fd = new FormData();
        fd.append("is_archived", "true");
        await axios.patch(`${API_BASE}/crimes/${id}/`, fd, {
          headers: authHeader(),
        });
      } catch (e2) {
        try {
          await axios.post(`${API_BASE}/crimes/${id}/archive/`, null, {
            headers: authHeader(),
          });
        } catch (e3) {
          if (e3?.response?.status === 401) {
            logout();
            return;
          }
          console.error("Archive victim error:", e3?.response?.data || e3.message);
          Swal.fire({
            icon: "error",
            title: "Archive Failed",
            text: "Failed to archive victim report.",
          });
          if (wasInActive) setVictimsActive((p) => [row, ...p]);
          if (wasInSolved) setVictimsSolved((p) => [row, ...p]);
        }
      }
    }
  };

  const handleArchiveSuspect = async (row) => {
    const { id } = row || {};
    if (!id) return;
        const confirm = await Swal.fire({
      title: "Archive Suspect?",
      text: "This suspect will be moved to archive.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, Archive",
      cancelButtonText: "Cancel",
    });

if (!confirm.isConfirmed) return;
    const prevList = suspects;
    setSuspects((p) => p.filter((s) => s.id !== id));
    try {
      try {
        await axios.patch(
          `${API_BASE}/suspects/${id}/`,
          { is_archived: true },
          {
            headers: {
              ...authHeader(),
              "Content-Type": "application/json",
            },
          }
        );
      } catch (e1) {
        if (e1?.response?.status === 415) {
          const fd = new FormData();
          fd.append("is_archived", "true");
          await axios.patch(`${API_BASE}/suspects/${id}/`, fd, {
            headers: authHeader(),
          });
        } else {
          throw e1;
        }
      }
    } catch (e2) {
      try {
        await axios.post(`${API_BASE}/suspects/${id}/archive/`, null, {
          headers: authHeader(),
        });
      } catch (e3) {
        if (e3?.response?.status === 401) {
          logout();
          return;
        }
        console.error("Archive suspect error:", e3?.response?.data || e3.message);
        alert("Failed to archive suspect. Reverting UI.");
        setSuspects(prevList);
      }
    }
  };

  /* ================== SAVE STATUS ================== */
  const sendVictimStatus = async (id, newStatus, signal) => {
    const form = new FormData();
    form.append("status", newStatus);
    return axios.patch(`${API_BASE}/crimes/${id}/`, form, {
      signal,
      headers: authHeader(),
    });
  };

  const moveRowByStatus = (id, newStatus) => {
    let movedRow = null;

    // ❌ remove from both lists FIRST
    setVictimsActive((prev) => {
      const row = prev.find((v) => v.id === id);
      if (row) movedRow = row;
      return prev.filter((v) => v.id !== id);
    });

    setVictimsSolved((prev) => {
      const row = prev.find((v) => v.id === id);
      if (row) movedRow = row;
      return prev.filter((v) => v.id !== id);
    });

    // ✅ add to correct list AFTER
    setTimeout(() => {
      if (!movedRow) return;

      const updated = {
        ...movedRow,
        _status: newStatus,
        status: newStatus,
      };

      if (newStatus === "Solved") {
        setVictimsSolved((prev) => [updated, ...prev]);
      } else {
        setVictimsActive((prev) => [updated, ...prev]);
      }
    }, 0);
  };

  const debouncedSaveVictim = useCallback((id, newStatus) => {
    const key = `victim-${id}`;
    if (timersRef.current[key]) {
      clearTimeout(timersRef.current[key]);
      delete timersRef.current[key];
    }
    if (controllersRef.current[key]) {
      controllersRef.current[key].abort();
      delete controllersRef.current[key];
    }
    setRowSaveState(key, "saving");
    moveRowByStatus(id, newStatus);
    timersRef.current[key] = setTimeout(async () => {
      delete timersRef.current[key];
      const controller = new AbortController();
      controllersRef.current[key] = controller;
      try {
        await sendVictimStatus(id, newStatus, controller.signal);
        setRowSaveState(key, "saved");
        setTimeout(() => setRowSaveState(key, "idle"), 800);
      } catch (e) {
        if (e.name === "CanceledError" || e.code === "ERR_CANCELED") return;
        if (e?.response?.status === 401) {
          logout();
          return;
        }
        await fetchVictimsSplit();
        setRowSaveState(key, "error");
        console.error("Save status failed:", e?.response?.data || e);
        alert("Save failed. See console.");
      } finally {
        delete controllersRef.current[key];
      }
    }, 300);
  }, [logout]);

  const handleVictimStatusChange = (id, newStatus) => {
    debouncedSaveVictim(id, newStatus);
    setViewData((d) =>
      d && d.id === id && viewKind === "victim"
        ? { ...d, _status: newStatus, status: newStatus }
        : d
    );
  };

  const renderVictimStatusCell = (row) => {
    // ✅ Table should be static. Status can only be updated inside the View modal.
    const status = row?._status || normalizeVictimStatus(row);
    return (
      <span
        className={`vs-badge vs-badge-status vs-badge-status-${String(status)
          .toLowerCase()
          .replace(/\s+/g, "-")}`}
        title="View the record to change status"
      >
        {status}
      </span>
    );
  };

  /* ========= EXPORT to EXCEL ========= */
  const toVictimExportRows = (rows) =>
    rows.map((v) => ({
      "Blotter #": v.blotter_number || "",
      ID: v.id,
      "Type of Crime": v.crime_type || "",
      "Full Name": fullName(v.v_first_name, v.v_middle_name, v.v_last_name),
      Age: v.v_age || "",
      Status: normalizeVictimStatus(v),
      Date: v.happened_at || "",
      "Victim Address": addrBlock("v", v),
      "Crime Location": addrBlock("loc", v),
      Latitude: v.latitude || "",
      Longitude: v.longitude || "",
      "Location Kind": v.loc_kind ? String(v.loc_kind).toUpperCase() : "",
      Waterbody: v.loc_waterbody || "",
    }));

  const toSuspectExportRows = (rows) =>
    rows.map((s) => {
      const cid = getSuspectCrimeId(s);
      return {
        "Blotter #": s.blotter_number || getBlotterByCrimeId(cid) || "",
        ID: s.id,
        "Type of Crime": s.s_crime_type || "",
        "Full Name": fullName(
          s.s_first_name,
          s.s_middle_name,
          s.s_last_name
        ),
        Age: s.s_age || "",
        Date: (s.created_at && String(s.created_at).split("T")[0]) || "",
        "Suspect Address": addrBlock("s", s),
        "Crime Location": addrBlock("loc", s),
        Latitude: s.latitude || "",
        Longitude: s.longitude || "",
        "Location Kind": s.loc_kind ? String(s.loc_kind).toUpperCase() : "",
        Waterbody: s.loc_waterbody || "",
      };
    });

  const handleExportExcel = () => {
    try {
      let rows = [],
        sheetName = "";
      if (currentTab === "victims") {
        rows = toVictimExportRows(filteredVictimsActive);
        sheetName = "Victims";
      } else if (currentTab === "solved") {
        rows = toVictimExportRows(filteredVictimsSolved);
        sheetName = "SolvedCases";
      } else {
        rows = toSuspectExportRows(filteredSuspects);
        sheetName = "Suspects";
      }
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      const stamp = new Date().toISOString().slice(0, 10);
      const fileName =
        currentTab === "victims"
          ? `victims_${stamp}.xlsx`
          : currentTab === "solved"
          ? `solved_cases_${stamp}.xlsx`
          : `suspects_${stamp}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (e) {
      console.error("Export failed:", e);
      alert("Export to Excel failed. Please check console.");
    }
  };

  /* ========= PRINT: CSS-ONLY PNP IRF (Victim) ========= */
  const printHTMLViaIframe = useCallback((html) => {
    if (!html) {
      console.warn("No HTML to print");
      return;
    }

    const frame = document.createElement("iframe");
    frame.style.position = "fixed";
    frame.style.right = "0";
    frame.style.bottom = "0";
    frame.style.width = "0";
    frame.style.height = "0";
    frame.style.border = "0";
    frame.style.visibility = "hidden";

    document.body.appendChild(frame);

    const cleanup = () => {
      try {
        frame.remove();
      } catch (e) {
        /* ignore */
      }
    };

    const tryPrint = () => {
      try {
        const win = frame.contentWindow;
        if (!win) {
          cleanup();
          return;
        }
        win.focus?.();
        try {
          win.print();
        } catch (e) {
          console.error("Print failed:", e);
        }
        setTimeout(cleanup, 700);
      } catch (e) {
        console.error("Error while printing iframe:", e);
        cleanup();
      }
    };

    frame.srcdoc = html;

    frame.onload = () => {
      try {
        const doc = frame.contentDocument || frame.contentWindow.document;
        const imgs = Array.from(doc.images || []);
        if (imgs.length === 0) {
          setTimeout(tryPrint, 60);
          return;
        }
        let loaded = 0;
        const onImgDone = () => {
          loaded += 1;
          if (loaded >= imgs.length) tryPrint();
        };
        setTimeout(() => {
          tryPrint();
        }, 2000);
        imgs.forEach((img) => {
          if (img.complete) {
            onImgDone();
          } else {
            img.addEventListener("load", onImgDone, { once: true });
            img.addEventListener("error", onImgDone, { once: true });
          }
        });
      } catch (e) {
        console.error("Error waiting for iframe assets:", e);
        tryPrint();
      }
    };

    setTimeout(() => {
      if (document.body.contains(frame)) tryPrint();
    }, 4000);
  }, []);

  const printIRF_CSS = useCallback(
    (rowArg) => {
      const row = rowArg ?? viewData;
      if (!row) return;

      const V = (x) => (x == null || x === "" ? "—" : String(x));
      const fmtDT = (x) => (x ? new Date(x).toLocaleString() : "—");
      const fmtD = (x) => (x ? new Date(x).toLocaleDateString() : "—");

      const esc = (s) =>
        String(s ?? "")
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
        place: V(place || "—"),
        nature: V(row.crime_type),
        narrative: V(row.description),
        coords: V(coords || "—"),
        status: V(row.status || "UNSOLVED"),
        waterbody: V(row.loc_waterbody),
        kind: V(row.loc_kind ? String(row.loc_kind).toUpperCase() : "—"),
      };

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
        address: V(row.rp_address),
        contact: V(row.rp_contact_number || ""),
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
        suspects.find((s) => String(getSuspectCrimeId(s)) === String(row.id)) ||
        {};
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


      // =============================
      // Prepared / Reported By (for print)
      // =============================
      const reporterName =
        row.reported_by_name ||
        row.reporting_person_name ||
        row.reporter_name ||
        fullName(row.rp_first_name, row.rp_middle_name, row.rp_last_name) ||
        "—";

      const encoderName =
        row.encoded_by_name ||
        row.encoder_name ||
        row.prepared_by_name ||
        row.created_by_name ||
        row.created_by ||
        "—";

      const reporterRoleRaw =
        row.reported_by_role ||
        row.report_source ||
        row.source ||
        row.created_role ||
        "";

      // If backend gives role info use it; otherwise infer from presence of reporting person fields.
      const inferredReporterRole =
        String(reporterRoleRaw).toLowerCase().includes("admin") ||
        row.is_admin_report === true ||
        row.by_admin === true
          ? "Admin"
          : "User";

      const preparedByLabel =
        inferredReporterRole === "Admin"
          ? `Prepared by (Admin)`
          : `Prepared by (User)`;

      const preparedByName = inferredReporterRole === "Admin" ? encoderName : reporterName;

      const locKindWater =
        [
          incident.kind !== "—" ? incident.kind : "",
          incident.waterbody !== "—" ? incident.waterbody : "",
        ]
          .filter(Boolean)
          .join(" / ") || "—";

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Incident Record Form</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 5mm;
    }
    * {
      box-sizing: border-box;
    }
    html, body {
      margin: 0;
      padding: 0;
      color: #111;
      background: #fff;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11.5px;
      line-height: 1.42;
    }
    body {
      padding: 0;
    }
    .irf-wrapper {
      width: 100%;
      max-width: 200mm;
      margin: 0 auto;
    }
    .irf-card {
      border: 1px solid #111;
    }
    .irf-header {
      display: grid;
      grid-template-columns: 60px 1fr 60px;
      align-items: center;
      justify-items: center;
      gap: 10px;
      padding: 10px 12px 8px;
      border-bottom: 1px solid #111;
    }
    .irf-header img {
      width: 54px;
      height: 54px;
      object-fit: contain;
      display: block;
      margin: 0 auto;
    }
    .irf-header-center {
      text-align: center;
      justify-self: stretch;
    }
    .irf-kicker {
      font-size: 9.8px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .irf-title {
      margin-top: 3px;
      font-size: 20px;
      font-weight: 700;
      letter-spacing: 0.06em;
    }
    .irf-subtitle {
      padding: 6px 12px;
      border-bottom: 1px solid #111;
      text-align: center;
      font-size: 9.8px;
      font-weight: 700;
      letter-spacing: 0.08em;
      background: #f3f4f6;
    }
    .irf-meta {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0;
      border-bottom: 1px solid #111;
    }
    .irf-meta-block {
      padding: 8px 12px;
      min-height: 42px;
    }
    .irf-meta-block + .irf-meta-block {
      border-left: 1px solid #111;
    }
    .irf-meta-label {
      display: block;
      margin-bottom: 3px;
      font-size: 8.9px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #374151;
    }
    .irf-meta-value {
      font-size: 12px;
      font-weight: 700;
      word-break: break-word;
    }
    .irf-section {
      margin-top: 10px;
      page-break-inside: avoid;
    }
    .irf-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      margin-top: 0;
    }
    .irf-table th,
    .irf-table td {
      border: 1px solid #111;
      padding: 7px 8px;
      vertical-align: top;
      word-break: break-word;
      overflow-wrap: anywhere;
      white-space: pre-wrap;
    }
    .irf-table th {
      font-weight: 700;
    }
    .irf-section-title {
      background: #eef2f7;
      text-align: left;
      font-size: 10.8px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      padding: 8px 10px !important;
    }
    .irf-label {
      width: 16%;
      background: #f8fafc;
      font-size: 9.4px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #374151;
    }
    .irf-value {
      font-size: 11.2px;
    }
    .irf-full-row {
      min-height: 68px;
    }
    .irf-narrative {
      min-height: 108px;
    }
    .irf-signatures {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 18px;
      margin-top: 22px;
      padding: 0 2px;
      page-break-inside: avoid;
    }
    .irf-signature {
      padding-top: 24px;
      text-align: center;
    }
    .irf-signature-line {
      border-top: 1px solid #111;
      padding-top: 6px;
      font-size: 11px;
      font-weight: 700;
      word-break: break-word;
    }
    .irf-signature-role {
      margin-top: 3px;
      font-size: 9.6px;
      color: #4b5563;
    }
    .irf-note {
      margin-top: 10px;
      font-size: 9px;
      text-align: right;
      color: #4b5563;
    }
  </style>
</head>
<body>
  <div class="irf-wrapper">
    <div class="irf-card">
      <div class="irf-header">
        <img src="/assets/logo.png" alt="PNP Logo" />
        <div class="irf-header-center">
          <div class="irf-kicker">Republic of the Philippines</div>
          <div class="irf-kicker">Philippine National Police</div>
          <div class="irf-title">INCIDENT RECORD FORM</div>
        </div>
        <img src="/assets/logo1.png" alt="PNP Seal" />
      </div>

      <div class="irf-subtitle">FOR POLICE BLOTTER ENCODER USE ONLY</div>

      <div class="irf-meta">
        <div class="irf-meta-block">
          <span class="irf-meta-label">Blotter Number</span>
          <div class="irf-meta-value">${esc(V(row.blotter_number || "—"))}</div>
        </div>
        <div class="irf-meta-block">
          <span class="irf-meta-label">Case Status</span>
          <div class="irf-meta-value">${esc(incident.status)}</div>
        </div>
      </div>

      <table class="irf-table">
        <colgroup>
          <col style="width:16%">
          <col style="width:34%">
          <col style="width:16%">
          <col style="width:34%">
        </colgroup>
        <tr>
          <th colspan="4" class="irf-section-title">Incident Overview</th>
        </tr>
        <tr>
          <td class="irf-label">Date and Time Reported</td>
          <td class="irf-value">${esc(incident.date_reported)}</td>
          <td class="irf-label">Date of Incident</td>
          <td class="irf-value">${esc(incident.date_incident)}</td>
        </tr>
        <tr>
          <td class="irf-label">Nature of Case</td>
          <td class="irf-value">${esc(incident.nature)}</td>
          <td class="irf-label">Coordinates</td>
          <td class="irf-value">${esc(incident.coords)}</td>
        </tr>
        <tr>
          <td class="irf-label">Location Type / Waterbody</td>
          <td class="irf-value">${esc(locKindWater)}</td>
          <td class="irf-label">Prepared By</td>
          <td class="irf-value">${esc(preparedByName)}</td>
        </tr>
        <tr>
          <td class="irf-label">Place of Incident</td>
          <td colspan="3" class="irf-value irf-full-row">${esc(incident.place)}</td>
        </tr>
        <tr>
          <td class="irf-label">Brief Narrative</td>
          <td colspan="3" class="irf-value irf-full-row irf-narrative">${esc(incident.narrative)}</td>
        </tr>
      </table>

      <table class="irf-table irf-section">
        <colgroup>
          <col style="width:12%">
          <col style="width:13%">
          <col style="width:12%">
          <col style="width:13%">
          <col style="width:12%">
          <col style="width:13%">
          <col style="width:12%">
          <col style="width:13%">
        </colgroup>
        <tr>
          <th colspan="8" class="irf-section-title">Item A - Reporting Person</th>
        </tr>
        <tr>
          <td class="irf-label">Family Name</td>
          <td class="irf-value">${esc(reporting.last)}</td>
          <td class="irf-label">First Name</td>
          <td class="irf-value">${esc(reporting.first)}</td>
          <td class="irf-label">Middle Name</td>
          <td class="irf-value">${esc(reporting.middle)}</td>
          <td class="irf-label">Age</td>
          <td class="irf-value">${esc(reporting.age)}</td>
        </tr>
        <tr>
          <td class="irf-label">Sex</td>
          <td class="irf-value">${esc(reporting.sex)}</td>
          <td class="irf-label">Citizenship</td>
          <td class="irf-value">${esc(reporting.citizenship)}</td>
          <td class="irf-label">Contact No.</td>
          <td class="irf-value">${esc(reporting.contact)}</td>
          <td class="irf-label">Email</td>
          <td class="irf-value">${esc(reporting.email)}</td>
        </tr>
        <tr>
          <td class="irf-label">Place of Birth</td>
          <td colspan="7" class="irf-value">${esc(reporting.pob)}</td>
        </tr>
        <tr>
          <td class="irf-label">Occupation</td>
          <td colspan="3" class="irf-value">${esc(reporting.occupation)}</td>
          <td class="irf-label">Address</td>
          <td colspan="3" class="irf-value">${esc(reporting.address)}</td>
        </tr>
      </table>

      <table class="irf-table irf-section">
        <colgroup>
          <col style="width:12%">
          <col style="width:13%">
          <col style="width:12%">
          <col style="width:13%">
          <col style="width:12%">
          <col style="width:13%">
          <col style="width:12%">
          <col style="width:13%">
        </colgroup>
        <tr>
          <th colspan="8" class="irf-section-title">Item B - Suspect Data</th>
        </tr>
        <tr>
          <td class="irf-label">Family Name</td>
          <td class="irf-value">${esc(suspect.last)}</td>
          <td class="irf-label">First Name</td>
          <td class="irf-value">${esc(suspect.first)}</td>
          <td class="irf-label">Middle Name</td>
          <td class="irf-value">${esc(suspect.middle)}</td>
          <td class="irf-label">Age</td>
          <td class="irf-value">${esc(suspect.age)}</td>
        </tr>
        <tr>
          <td class="irf-label">Barangay</td>
          <td class="irf-value">${esc(suspect.barangay)}</td>
          <td class="irf-label">City / Municipality</td>
          <td class="irf-value">${esc(suspect.city)}</td>
          <td class="irf-label">Province</td>
          <td class="irf-value">${esc(suspect.province)}</td>
          <td class="irf-label">Region</td>
          <td class="irf-value">${esc(suspect.region)}</td>
        </tr>
        <tr>
          <td class="irf-label">Address</td>
          <td colspan="7" class="irf-value">${esc(suspect.address)}</td>
        </tr>
        <tr>
          <td class="irf-label">Description / Narrative</td>
          <td colspan="7" class="irf-value irf-full-row">${esc(suspect.desc)}</td>
        </tr>
      </table>

      <table class="irf-table irf-section">
        <colgroup>
          <col style="width:12%">
          <col style="width:13%">
          <col style="width:12%">
          <col style="width:13%">
          <col style="width:12%">
          <col style="width:13%">
          <col style="width:12%">
          <col style="width:13%">
        </colgroup>
        <tr>
          <th colspan="8" class="irf-section-title">Item C - Victim Data</th>
        </tr>
        <tr>
          <td class="irf-label">Family Name</td>
          <td class="irf-value">${esc(victim.last)}</td>
          <td class="irf-label">First Name</td>
          <td class="irf-value">${esc(victim.first)}</td>
          <td class="irf-label">Middle Name</td>
          <td class="irf-value">${esc(victim.middle)}</td>
          <td class="irf-label">Age</td>
          <td class="irf-value">${esc(victim.age)}</td>
        </tr>
        <tr>
          <td class="irf-label">Sex</td>
          <td class="irf-value">${esc(victim.sex)}</td>
          <td class="irf-label">Citizenship</td>
          <td class="irf-value">${esc(victim.citizenship)}</td>
          <td class="irf-label">Birthdate</td>
          <td class="irf-value">${esc(victim.birthdate)}</td>
          <td class="irf-label">Place of Birth</td>
          <td class="irf-value">${esc(victim.pob)}</td>
        </tr>
        <tr>
          <td class="irf-label">Occupation</td>
          <td colspan="3" class="irf-value">${esc(victim.occupation)}</td>
          <td class="irf-label">Barangay</td>
          <td class="irf-value">${esc(victim.barangay)}</td>
          <td class="irf-label">City / Municipality</td>
          <td class="irf-value">${esc(victim.city)}</td>
        </tr>
        <tr>
          <td class="irf-label">Province</td>
          <td class="irf-value">${esc(victim.province)}</td>
          <td class="irf-label">Address</td>
          <td colspan="5" class="irf-value">${esc(victim.address)}</td>
        </tr>
      </table>
    </div>

    <div class="irf-signatures">
      <div class="irf-signature">
        <div class="irf-signature-line">${esc(preparedByName)}</div>
        <div class="irf-signature-role">${esc(preparedByLabel)}</div>
      </div>
      <div class="irf-signature">
        <div class="irf-signature-line">${esc(encoderName)}</div>
        <div class="irf-signature-role">Desk Officer / Encoder</div>
      </div>
    </div>

    <div class="irf-note">Formatted for A4 PDF export.</div>
  </div>
</body>
</html>`;


      const element = document.createElement("div");
      element.innerHTML = html;

      html2pdf()
        .from(element)
        .set({
          margin: 4,
          filename: `IRF_${row.id}.pdf`,
          html2canvas: { scale: 2.2 },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        })
        .save();
    },
    [viewData, suspects, printHTMLViaIframe]
  );

  /* ========= BASIC PAGE PRINT (tables) ========= */
  const handlePrint = () => window.print();

  /* 🔐 Huwag mag-render ng laman hangga’t di pa tapos i-check ang auth */
  if (!authChecked) {
    return null;
  }

  return (
    <div className="vs-scope">
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
              <button
                type="button"
                className="submenu-toggle"
                onClick={() => setSubmenuOpen((s) => !s)}
                style={{
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                }}
              >
                <FontAwesomeIcon icon={faFileInvoice} /> Crime Reports
              </button>
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
                    <Link to="/AdminArchivedInfo">Archived Profiles</Link>
                  </li>
                </ul>
              )}
            </li>

            
            <li>
              <button
                type="button"
                className="logout"
                onClick={logout}
              >
                <FontAwesomeIcon icon={faRightFromBracket} /> Logout
              </button>
            </li>
          </ul>
        </aside>

        {/* Main Content */}
        <main className="main-content">
          <div className="main-inner">
            <h1>Victim & Suspect Records</h1>
            {error && (
              <div style={{ color: "crimson", marginBottom: 12 }}>{error}</div>
            )}

            {/* Actions + Search */}
            <div className="action-bar" style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
              {/* TAB Buttons */}
            <div
              style={{
                width: "75%",
                justifyContent: "flex-start",
                marginBottom: 8,
                display: "flex",
                gap: 8,
              }}
            >
              <button
                onClick={() => setCurrentTab("victims")}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  border:
                    currentTab === "victims"
                      ? "2px solid #2563eb"
                      : "1px solid #ddd",
                  background:
                    currentTab === "victims" ? "#eff6ff" : "#ffffff",
                  fontWeight: 600,
                }}
              >
                Victims{" "}
                {loadingVictims ? "…" : `(${filteredVictimsActive.length})`}
              </button>
              <button
                onClick={() => setCurrentTab("solved")}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  border:
                    currentTab === "solved"
                      ? "2px solid #16a34a"
                      : "1px solid #ddd",
                  background:
                    currentTab === "solved" ? "#ecfdf5" : "#ffffff",
                  fontWeight: 600,
                }}
              >
                Solved Cases{" "}
                {loadingVictims ? "…" : `(${filteredVictimsSolved.length})`}
              </button>
              <button
                onClick={() => setCurrentTab("suspects")}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  border:
                    currentTab === "suspects"
                      ? "2px solid #8b5cf6"
                      : "1px solid #ddd",
                  background:
                    currentTab === "suspects" ? "#f5f3ff" : "#ffffff",
                  fontWeight: 600,
                }}
              >
                Suspects{" "}
                {loadingSuspects ? "…" : `(${filteredSuspects.length})`}
              </button>
            </div>
              <div style={{ flex: 1, maxWidth: 360 }}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search blotter #, name, crime type, address..."
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    fontSize: 14,
                    background: "#f9fafb",
                    color: "#111827",
                  }}
                />
              </div>

              <button
                onClick={handleExportExcel}
                className="add-btn"
                style={{ padding: "8px 14px", borderRadius: 8 }}
                disabled={
                  (currentTab === "victims" && loadingVictims) ||
                  (currentTab === "solved" && loadingVictims) ||
                  (currentTab === "suspects" && loadingSuspects)
                }
              >
                Export to Excel
              </button>
            </div>

            

            {/* TABLES */}
            {currentTab === "victims" && (
              <VictimTable
                rows={paginatedVictimsActive}
                loading={loadingVictims}
                currentPage={currentPage}
                totalPages={totalPagesVictims}
                setCurrentPage={setCurrentPage}
                onViewRow={(row) => openView("victim", row)}
                onPrintIRF={(row) => printIRF_CSS(row)}
                renderStatusCell={renderVictimStatusCell}
                onArchive={(row) => handleArchiveVictim(row)}
                variant="active"
              />
            )}
            {currentTab === "solved" && (
              <VictimTable
                rows={paginatedVictimsSolved}
                currentPage={currentPage}
                totalPages={totalPagesSolved}
                setCurrentPage={setCurrentPage}
                loading={loadingVictims}
                onViewRow={(row) => openView("victim", row)}
                onPrintIRF={(row) => printIRF_CSS(row)}
                renderStatusCell={renderVictimStatusCell}
                onArchive={(row) => handleArchiveVictim(row)}
                variant="solved"
              />
            )}
            {currentTab === "suspects" && (
              <SuspectTable
                rows={paginatedSuspects}
                currentPage={currentPage}
                totalPages={totalPagesSolved}
                setCurrentPage={setCurrentPage}
                loading={loadingSuspects}
                onViewRow={(row) => openView("suspect", row)}
                onArchive={(row) => handleArchiveSuspect(row)}
                getBlotterByCrimeId={getBlotterByCrimeId}
              />
            )}
          </div>
        </main>
      </div>

      {/* VIEW MODAL */}
      {viewOpen && viewData && (
        <div className="vs-modal-backdrop" onClick={closeView}>
          <div className="vs-modal" onClick={(e) => e.stopPropagation()}>
            <div className="vs-modal-header">
              <div className="vs-modal-header-left">
                <h3 style={{ margin: 0 }}>
                  {viewKind === "victim" ? "Victim Details" : "Suspect Details"}
                  {viewReadOnly ? " (Read-only)" : ""}
                </h3>
                <div className="vs-blotter-chip">
                  <span className="vs-blotter-label">Blotter #</span>
                  <span className="vs-blotter-value">
                    {viewKind === "victim"
                      ? viewData?.blotter_number || "—"
                      : viewData?.blotter_number ||
                        getBlotterByCrimeId(getSuspectCrimeId(viewData)) ||
                        "—"}
                  </span>
                  {((viewKind === "victim" && viewData?.blotter_number) ||
                    (viewKind === "suspect" &&
                      (viewData?.blotter_number ||
                        getBlotterByCrimeId(
                          getSuspectCrimeId(viewData)
                        )))) && (
                    <CopyBtn
                      value={
                        viewKind === "victim"
                          ? viewData?.blotter_number
                          : viewData?.blotter_number ||
                            getBlotterByCrimeId(getSuspectCrimeId(viewData))
                      }
                    />
                  )}
                </div>
              </div>

              <div className="vs-modal-header-right">
                {viewKind === "victim" && (
                  <button
                    className="add-btn vs-print-irf-btn"
                    onClick={() => printIRF_CSS(viewData)}
                  >
                    Print IRF
                  </button>
                )}
              </div>
            </div>

            {/* MODAL BODY LAYOUT */}
            <div className="vs-modal-body">
              <div className="vs-modal-layout">
                {/* LEFT COLUMN – PROFILE + ADDRESSES */}
                <div className="vs-modal-column">
                  {/* Profile Card */}
                  <div className="vs-card vs-card-profile">
                    <div className="vs-card-header">
                      <span
                        className={`vs-badge vs-badge-kind ${
                          viewKind === "victim"
                            ? "vs-badge-victim"
                            : "vs-badge-suspect"
                        }`}
                      >
                        {viewKind === "victim" ? "Victim" : "Suspect"}
                      </span>
                    </div>

                    <div className="vs-profile-main">
                      {/* Photo */}
                      <div className="vs-profile-photo">
                        {viewKind === "victim" ? (
                          getVictimPhotoUrl(viewData) ? (
                            <img
                              src={getVictimPhotoUrl(viewData)}
                              alt="Victim"
                              className="vs-profile-photo-img"
                            />
                          ) : (
                            <span className="vs-profile-photo-empty">
                              No Image
                            </span>
                          )
                        ) : getSuspectPhotoUrl(viewData) ? (
                          <img
                            src={getSuspectPhotoUrl(viewData)}
                            alt="Suspect"
                            className="vs-profile-photo-img"
                          />
                        ) : (
                          <span className="vs-profile-photo-empty">
                            No Image
                          </span>
                        )}
                      </div>

                      {/* Basic Info */}
                      <div className="vs-profile-info">
                        <div className="vs-profile-name">
                          {viewKind === "victim"
                            ? fullName(
                                viewData?.v_first_name,
                                viewData?.v_middle_name,
                                viewData?.v_last_name
                              ) || "—"
                            : fullName(
                                viewData?.s_first_name,
                                viewData?.s_middle_name,
                                viewData?.s_last_name
                              ) || "—"}
                        </div>
                        <div className="vs-profile-meta">
                          <span>
                            <strong>Age:</strong>{" "}
                            {viewKind === "victim"
                              ? viewData?.v_age || "—"
                              : viewData?.s_age || "—"}
                          </span>
                          <span>
                            <strong>Sex:</strong>{" "}
                            {viewKind === "victim"
                              ? viewData?.v_sex || "—"
                              : viewData?.s_sex || "—"}
                          </span>
                        </div>
                        <div className="vs-profile-crime">
                          <span className="vs-label">
                            Type of Crime / Incident
                          </span>
                          <div className="vs-profile-crime-value">
                            {viewKind === "victim"
                              ? viewData?.crime_type || "—"
                              : viewData?.s_crime_type || "—"}
                          </div>
                        </div>

                        {viewKind === "victim" && (
                          <div className="vs-profile-status-row">
                            <span className="vs-label">Case Status</span>
                            {!viewReadOnly ? (
                              <div className="vs-status-inline">
                                <select
                                  value={normalizeVictimStatus(viewData)}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setViewData((d) => ({
                                      ...d,
                                      _status: val,
                                      status: val,
                                    }));
                                    debouncedSaveVictim(viewData.id, val);
                                  }}
                                  className="vs-status-select"
                                >
                                  {VICTIM_STATUSES.map((s) => (
                                    <option key={s} value={s}>
                                      {s}
                                    </option>
                                  ))}
                                </select>
                                <span
                                  className={`vs-badge vs-badge-status vs-badge-status-${normalizeVictimStatus(
                                    viewData
                                  ).toLowerCase()}`}
                                >
                                  {normalizeVictimStatus(viewData)}
                                </span>
                              </div>
                            ) : (
                              <span className="vs-badge vs-badge-status">
                                {normalizeVictimStatus(viewData)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  
                  {/* Record Meta Card */}
                  <div className="vs-card">
                    <h4 className="vs-card-title">Record Meta</h4>
                    <div className="vs-card-body">
                      <div className="vs-field-block">
                        <span className="vs-label">{viewMeta.preparedByLabel}</span>
                        <div className="vs-field-value">{viewMeta.preparedByName}</div>
                      </div>

                      <div className="vs-field-block">
                        <span className="vs-label">Desk Officer / Encoder</span>
                        <div className="vs-field-value">{viewMeta.encoderName}</div>
                      </div>

                      <div className="vs-field-block">
                        <span className="vs-label">Reported By</span>
                        <div className="vs-field-value">{viewMeta.reporterName}</div>
                      </div>
                    </div>
                  </div>

{/* Address Card */}
                  <div className="vs-card">
                    <h4 className="vs-card-title">Address Information</h4>
                    <div className="vs-card-body">
                      <div className="vs-field-block">
                        <span className="vs-label">Registered Address</span>
                        <pre className="vs-pre vs-pre-box">
                          {viewKind === "victim"
                            ? addrBlock("v", viewData) || "—"
                            : addrBlock("s", viewData) || "—"}
                        </pre>
                      </div>

                      <div className="vs-field-block">
                        <span className="vs-label">Crime Location</span>
                        <pre className="vs-pre vs-pre-box">
                          {addrBlock("loc", viewData) || "—"}
                          {viewData?.latitude && viewData?.longitude
                            ? `\n(${viewData.latitude}, ${viewData.longitude})`
                            : ""}
                          {viewData?.loc_kind
                            ? `\n${String(viewData.loc_kind).toUpperCase()}${
                                viewData?.loc_waterbody
                                  ? ` (${viewData.loc_waterbody})`
                                  : ""
                              }`
                            : ""}
                        </pre>

                        <div className="vs-chip-row">
                          {viewData?.loc_kind && (
                            <span className="vs-chip">
                              {String(viewData.loc_kind).toUpperCase()}
                            </span>
                          )}
                          {viewData?.loc_waterbody && (
                            <span className="vs-chip vs-chip-water">
                              {viewData.loc_waterbody}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* RIGHT COLUMN – INCIDENT + MAP + RELATED */}
                <div className="vs-modal-column">
                  {/* Incident Card */}
                  <div className="vs-card">
                    <h4 className="vs-card-title">Incident Overview</h4>
                    <div className="vs-card-body">
                      <div className="vs-field-grid">
                        <div className="vs-field">
                          <span className="vs-label">
                            Date &amp; Time Reported
                          </span>
                          <span className="vs-value">
                            {viewData?.created_at
                              ? new Date(
                                  viewData.created_at
                                ).toLocaleString()
                              : "—"}
                          </span>
                        </div>
                        <div className="vs-field">
                          <span className="vs-label">Date of Incident</span>
                          <span className="vs-value">
                            {viewKind === "victim"
                              ? viewData?.happened_at || "—"
                              : toDate(viewData?.created_at) || "—"}
                          </span>
                        </div>
                      </div>

                      {viewKind === "victim" && (
                        <div className="vs-field">
                          <span className="vs-label">Current Status</span>
                          <span
                            className={`vs-badge vs-badge-status vs-badge-status-${normalizeVictimStatus(
                              viewData
                            ).toLowerCase()}`}
                          >
                            {normalizeVictimStatus(viewData)}
                          </span>
                        </div>
                      )}

                      <div className="vs-field-block">
                        <span className="vs-label">Brief Narrative</span>
                        <div className="vs-pre vs-pre-box vs-narrative-box">
                          {viewKind === "victim"
                            ? viewData?.description || "—"
                            : viewData?.s_description ||
                              viewData?.s_description_short ||
                              "—"}
                        </div>
                      </div>

                      <div className="vs-field-block vs-map-block">
                        <span className="vs-label">Map Preview</span>
                        <div className="vs-map-frame">
                          {viewData?.latitude && viewData?.longitude ? (
                            <MapContainer
                              key={`${viewKind}-${viewData.id}-${viewData.latitude}-${viewData.longitude}`}
                              center={[
                                Number(viewData.latitude),
                                Number(viewData.longitude),
                              ]}
                              zoom={14}
                              style={{ height: "100%", width: "100%" }}
                              scrollWheelZoom={false}
                            >
                              <TileLayer
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                              />
                              <Marker
                                position={[
                                  Number(viewData.latitude),
                                  Number(viewData.longitude),
                                ]}
                              >
                                <Popup>
                                  {viewKind === "victim"
                                    ? "Victim / Incident location"
                                    : "Suspect / Incident location"}
                                  <br />
                                  {addrLine("loc", viewData) || ""}
                                </Popup>
                              </Marker>
                            </MapContainer>
                          ) : (
                            <div className="vs-map-empty">
                              No coordinates available to show on map.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Related card: suspects or victims */}
                  <div className="vs-card">
                    <h4 className="vs-card-title">
                      {viewKind === "victim"
                        ? "Linked Suspects in this Case"
                        : "Linked Victim(s) in this Case"}
                    </h4>
                    <div className="vs-card-body">
                      {viewKind === "victim" ? (
                        <>
                          {loadingSuspects ? (
                            <div className="vs-muted-text">
                              Loading suspects…
                            </div>
                          ) : (() => {
                              const related = suspects.filter(
                                (s) =>
                                  String(getSuspectCrimeId(s)) ===
                                  String(viewData.id)
                              );
                              if (related.length === 0)
                                return (
                                  <div className="vs-muted-text">
                                    No suspects linked to this case.
                                  </div>
                                );
                              return (
                                <div className="vs-related-grid">
                                  {related.map((s) => (
                                    <div
                                      key={s.id}
                                      className="vs-related-card"
                                    >
                                      <div className="vs-related-photo">
                                        {getSuspectPhotoUrl(s) ? (
                                          <img
                                            src={getSuspectPhotoUrl(s)}
                                            alt="Suspect"
                                            className="vs-related-photo-img"
                                          />
                                        ) : (
                                          <span className="vs-related-photo-empty">
                                            No Image
                                          </span>
                                        )}
                                      </div>
                                      <div className="vs-related-info">
                                        <div className="vs-related-name">
                                          {fullName(
                                            s.s_first_name,
                                            s.s_middle_name,
                                            s.s_last_name
                                          ) || "—"}
                                        </div>
                                        <div className="vs-related-meta">
                                          Age: {s.s_age || "—"} • Date:{" "}
                                          {toDate(s.created_at) || "—"}
                                        </div>
                                        <div
                                          title={addrLine("s", s) || ""}
                                          className="vs-related-addr"
                                        >
                                          {addrLine("s", s) || "—"}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              );
                            })()}
                        </>
                      ) : (
                        <>
                          {loadingVictims ? (
                            <div className="vs-muted-text">
                              Loading victims…
                            </div>
                          ) : (() => {
                              const idSet = new Set(getLinkedVictimIds(viewData));
                              const relatedVictims = allVictims.filter((v) =>
                                idSet.has(String(v.id))
                              );
                              if (relatedVictims.length === 0)
                                return (
                                  <div className="vs-muted-text">
                                    No victims linked to this suspect.
                                  </div>
                                );
                              return (
                                <div className="vs-related-grid">
                                  {relatedVictims.map((v) => (
                                    <div
                                      key={v.id}
                                      className="vs-related-card"
                                    >
                                      <div className="vs-related-photo">
                                        {getVictimPhotoUrl(v) ? (
                                          <img
                                            src={getVictimPhotoUrl(v)}
                                            alt="Victim"
                                            className="vs-related-photo-img"
                                          />
                                        ) : (
                                          <span className="vs-related-photo-empty">
                                            No Image
                                          </span>
                                        )}
                                      </div>
                                      <div className="vs-related-info">
                                        <div className="vs-related-name">
                                          {fullName(
                                            v.v_first_name,
                                            v.v_middle_name,
                                            v.v_last_name
                                          ) || "—"}
                                        </div>
                                        <div className="vs-related-meta">
                                          Age: {v.v_age || "—"} • Date:{" "}
                                          {v.happened_at || "—"}
                                        </div>
                                        <div
                                          title={addrLine("v", v) || ""}
                                          className="vs-related-addr"
                                        >
                                          {addrLine("v", v) || "—"}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              );
                            })()}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div
              className="vs-modal-footer"
              style={{
                padding: 16,
                borderTop: "1px solid #eee",
                display: "flex",
                gap: 8,
                justifyContent: "flex-end",
              }}
            >
              {!viewReadOnly && (
                <button
                  type="button"
                  className="vs-modal-btn vs-modal-btn-primary"
                  onClick={editFromView}
                >
                  Edit Record
                </button>
              )}
              <button
                type="button"
                className="vs-modal-btn vs-modal-btn-secondary"
                onClick={closeView}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRINT CSS (tables only) - scoped */}
      <style>{`
        @media print {
          /* hide app chrome */
          .topnav, .sidebar, .action-bar, .submenu, .submenu-toggle, .logout, .vs-copy-btn, .add-btn { display: none !important; }
          .main-content { padding: 0 !important; }
          .vs-table { font-size: 11px !important; border-collapse: collapse !important; width: 100% !important; }
          .vs-table td, .vs-table th { border: 1px solid #000 !important; padding: 6px !important; vertical-align: top !important; }
          .vs-thumb { max-height: 60px; }

          /* Hide interactive dropdowns and show printable labels instead */
          .vs-dropdown, .vs-dropdown-btn, .vs-dropdown-menu { display: none !important; }
          .vs-print-actions { display: inline-block !important; font-size: 11px; color: #111; }
          .vs-print-action-item::after { content: " ·"; color: #444; margin-left: 6px; }
          .vs-print-action-item:last-child::after { content: ""; margin: 0; }

          /* ensure modal/backdrop don't print */
          .vs-modal-backdrop, .vs-modal { display: none !important; }

          /* prevent page breaks inside table rows */
          tr { page-break-inside: avoid; }
        }

        /* non-print: hide the print-only element */
        .vs-print-actions { display: none; }

        /* small stylistic helpers for screen */
        .vs-dropdown-btn { padding: 6px 10px; border-radius: 6px; border: 1px solid #ddd; background: #fff; cursor: pointer; }
      `}</style>
    </div>
  );
}

/* ===== Reusable sub-tables ===== */
function VictimTable({
  rows,
  loading,
  onViewRow,
  onPrintIRF,
  renderStatusCell,
  onArchive,
  variant,
  currentPage, setCurrentPage,
  totalPages,   // 🔥 ADD THIS
}) {
  return (
    <section className="vs-section" style={{ marginBottom: 24, width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h2 className="vs-heading" style={{ margin: "12px 0" }}>
          {variant === "solved" ? "Solved Cases" : "Victims"}
        </h2>
        {loading && <small className="vs-loading-inline">Loading…</small>}
      </div>

      <div className="vs-table-wrap">
        <table
          className={`vs-table vs-victim-table ${
            variant === "solved" ? "vs-table-solved" : ""
          }`}
          cellPadding="8"
        >
          <thead className="vs-thead">
            <tr>
              <th className="vs-th-vs-blotter">Blotter #</th>
              <th className="vs-th-vs-type">Type of Crime / Incidents</th>
              <th className="vs-th-vs-name">Full Name</th>
              <th className="vs-th-vs-age">Age</th>
              <th className="vs-th-vs-photo">Victim Photo</th>
              <th className="vs-th-vs-addr">Address</th>
              <th className="vs-th-vs-loc">Crime Location</th>
              <th className="vs-th-vs-date">Date</th>
              <th className="vs-th-vs-status">Status</th>
              <th className="vs-th-vs-actions">Actions</th>
            </tr>
          </thead>
          <tbody className="vs-tbody">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan="10"
                  className="vs-no-records"
                  style={{ textAlign: "center" }}
                >
                  No records.
                </td>
              </tr>
            ) : (
              rows.map((v) => (
                <tr
                  key={v.id}
                  className={`vs-row ${
                    variant === "solved" ? "vs-row-solved" : ""
                  }`}
                >
                  <td className="vs-td-blotter">
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <div
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: 100,
                        }}
                      >
                        {v.blotter_number || "—"}
                      </div>
                      {v.blotter_number && <CopyBtn value={v.blotter_number} />}
                    </div>
                  </td>
                  <td className="vs-td-type">{v.crime_type || "—"}</td>
                  <td className="vs-td-name">
                    {fullName(
                      v.v_first_name,
                      v.v_middle_name,
                      v.v_last_name
                    ) || "—"}
                  </td>
                  <td className="vs-td-age">{v.v_age || "—"}</td>
                  <td className="vs-td-photo">
                    {getVictimPhotoUrl(v) ? (
                      <img
                        src={getVictimPhotoUrl(v)}
                        alt="Victim"
                        className="vs-thumb"
                      />
                    ) : (
                      "N/A"
                    )}
                  </td>
                  <td
                    className="vs-td-addr"
                    style={{ whiteSpace: "pre-line" }}
                  >
                    {addrBlock("v", v) || "—"}
                  </td>
                  <td
                    className="vs-td-loc"
                    style={{ whiteSpace: "pre-line" }}
                  >
                    {addrBlock("loc", v) || "—"}
                    {v.latitude && v.longitude
                      ? `\n(${v.latitude}, ${v.longitude})`
                      : ""}
                    {v.loc_kind
                      ? `\n${String(v.loc_kind).toUpperCase()}${
                          v.loc_waterbody ? ` (${v.loc_waterbody})` : ""
                        }`
                      : ""}
                  </td>
                  <td className="vs-td-date">{v.happened_at || "—"}</td>
                  <td className="vs-td-status">{renderStatusCell(v)}</td>
                  <td className="vs-td-actions">
                    <ActionDropdown
                      label="Actions"
                      items={[
                        { label: "View", onClick: () => onViewRow(v) },
                        { label: "Print", onClick: () => onPrintIRF(v) },
                        { label: "Archive", onClick: () => onArchive(v) },
                      ]}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="pagination-container">
          <button
            className="pagination-btn"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => p - 1)}
          >
            ◀ Prev
          </button>

          <span className="pagination-info">
            Page {currentPage} of {totalPages}
          </span>

          <button
            className="pagination-btn"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => p + 1)}
          >
            Next ▶
          </button>
        </div>
    </section>
  );
}

function SuspectTable({
  rows,
  loading,
  onViewRow,
  onArchive,
  getBlotterByCrimeId,

  currentPage,      
  setCurrentPage,   
  totalPages, 
}) {
  return (
    <section className="vs-section" style={{ width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h2 className="vs-heading" style={{ margin: "12px 0" }}>
          Suspects
        </h2>
        {loading && <small className="vs-loading-inline">Loading…</small>}
      </div>

      <div className="vs-table-wrap">
        <table className="vs-table vs-suspect-table" cellPadding="8">
          <thead className="vs-thead">
            <tr>
              <th className="vs-th-blotter">Blotter #</th>
              {/* REMOVED: Type of Crime / Incidents */}
              <th className="vs-th-name">Full Name</th>
              <th className="vs-th-age">Age</th>
              <th className="vs-th-photo">Suspect Photo</th>
              <th className="vs-th-addr">Address</th>
              <th className="vs-th-loc">Crime Location</th>
              <th className="vs-th-lat">Latitude</th>
              <th className="vs-th-lon">Longitude</th>
              <th className="vs-th-date">Date</th>
              <th className="vs-th-actions">Actions</th>
            </tr>
          </thead>

          <tbody className="vs-tbody">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan="10"
                  className="vs-no-records"
                  style={{ textAlign: "center" }}
                >
                  No records.
                </td>
              </tr>
            ) : (
              rows.map((s) => {
                const cid = getSuspectCrimeId(s);
                const blotter =
                  s.blotter_number || getBlotterByCrimeId(cid) || "";

                return (
                  <tr key={s.id} className="vs-row">
                    <td className="vs-td-blotter">
                      {blotter || "—"}
                      {blotter && <CopyBtn value={blotter} />}
                    </td>

                    {/* REMOVED: s.s_crime_type column */}

                    <td className="vs-td-name">
                      {fullName(
                        s.s_first_name,
                        s.s_middle_name,
                        s.s_last_name
                      ) || "—"}
                    </td>

                    <td className="vs-td-age">{s.s_age || "—"}</td>

                    <td className="vs-td-photo">
                      {getSuspectPhotoUrl(s) ? (
                        <img
                          src={getSuspectPhotoUrl(s)}
                          alt="Suspect"
                          className="vs-thumb"
                        />
                      ) : (
                        "N/A"
                      )}
                    </td>

                    <td
                      className="vs-td-addr"
                      style={{ whiteSpace: "pre-line" }}
                    >
                      {addrBlock("s", s) || "—"}
                    </td>

                    <td
                      className="vs-td-loc"
                      style={{ whiteSpace: "pre-line" }}
                    >
                      {addrBlock("loc", s) || "—"}
                      {s.loc_kind
                        ? `\n${String(s.loc_kind).toUpperCase()}${
                            s.loc_waterbody ? ` (${s.loc_waterbody})` : ""
                          }`
                        : ""}
                    </td>

                    <td className="vs-td-lat">{s.latitude || "—"}</td>
                    <td className="vs-td-lon">{s.longitude || "—"}</td>
                    <td className="vs-td-date">
                      {toDate(s.created_at) || "—"}
                    </td>

                    <td className="vs-td-actions">
                      <ActionDropdown
                        label="Actions"
                        items={[
                          { label: "View", onClick: () => onViewRow(s) },
                          { label: "Archive", onClick: () => onArchive(s) },
                        ]}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
       <div className="pagination-container">
          <button
            className="pagination-btn"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => p - 1)}
          >
            ◀ Prev
          </button>

          <span className="pagination-info">
            Page {currentPage} of {totalPages}
          </span>

          <button
            className="pagination-btn"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => p + 1)}
          >
            Next ▶
          </button>
        </div>
    </section>
  );
}

export default VictimSuspectTables;
