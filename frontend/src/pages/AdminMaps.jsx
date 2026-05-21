// src/pages/AdminMaps.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
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
  faLocationCrosshairs,
  faXmark,
  faSpinner,
} from "@fortawesome/free-solid-svg-icons";
import "../assets/css/adminmaps.css";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";

/* ===== Map stack ===== */
import "leaflet/dist/leaflet.css";
import {
  MapContainer,
  TileLayer,
  LayersControl,
  LayerGroup,
  useMap,
  Marker,
  CircleMarker,
  Popup,
} from "react-leaflet";
import L from "leaflet";
import { ZoomControl } from "react-leaflet";
/* ===== Default marker (for suspects) ===== */
const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

/* ===== Config ===== */
/**
 * NOTE:
 * - Default: http://localhost:8000  (no trailing /, no /api)
 * - Endpoints below use `${API_BASE}/api/...`
 * - In .env, set: VITE_API_BASE=http://localhost:8000
 */
const API_BASE = (import.meta.env.VITE_API_BASE || "http://localhost:8000").replace(
  /\/$/,
  ""
);

/** Build Authorization header from localStorage token */
function authHeader() {
  const raw =
    localStorage.getItem("access") ||
    localStorage.getItem("token") ||
    localStorage.getItem("access_token") ||
    "";

  if (!raw) return {};

  // already has Bearer / Token
  if (/^(Bearer|Token)\s/i.test(raw)) {
    return { Authorization: raw };
  }

  // looks like a raw JWT → wrap with Bearer
  if (/^[\w-]+\.[\w-]+\.[\w-]+$/.test(raw)) {
    return { Authorization: `Bearer ${raw}` };
  }

  // fallback
  return { Authorization: raw };
}

/* PH bounds */
const PH_BOUNDS = L.latLngBounds(L.latLng(4.5, 116.0), L.latLng(21.5, 127.0));
const PH_CENTER = PH_BOUNDS.getCenter();

/* Region IV-A province list (same as UserMaps) */
const R4A_PROVINCES = ["All", "Cavite", "Laguna", "Batangas", "Rizal", "Quezon"];

/* ===== Helpers ===== */
const VICTIM_STATUSES = ["Ongoing", "Solved", "Unsolved"];
const fullName = (a, b, c) => [a, b, c].filter(Boolean).join(" ");
const normalizeVictimStatus = (row) => {
  const value = row?.status ?? row?.case_status ?? row?.is_active ?? row?._status;
  const s = String(value ?? "").trim();
  return VICTIM_STATUSES.includes(s) ? s : "Ongoing";
};
const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/* Suspect star */
const starIcon = L.divIcon({
  className: "star-marker",
  html: `<div style="font-size:28px;color:#ef4444;transform:translate(-50%,-50%);text-shadow:0 0 3px rgba(0,0,0,.4)">★</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

/* ===== Station banner icon (logo + colored pill) ===== */
function stationColorByType(type) {
  return type === "MARPSTA" ? "#1e3a8a" : type === "MPP" ? "#b91c1c" : "#0f766e";
}
function guessType(name = "", unitType) {
  const n = String(name).toUpperCase();
  if (unitType) return unitType;
  if (n.includes("MARPSTA") || n.includes("MARITIME")) return "MARPSTA";
  if (n.includes("MPP") || n.includes("PRECINCT")) return "MPP";
  return "DEFAULT";
}
function makeStationIcon(station) {
  const type = guessType(station.name, station.unit_type);
  const color = stationColorByType(type);
  const logoUrl = station.logo_url || "/assets/pnp_badge.png";
  const label = (station.short_label || station.name || "Police Station").toUpperCase();

  const html = `
      <div style="
        transform: translate(-50%,-50%);
        display: inline-flex; align-items: center; gap: 8px;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,.35));
      ">
        <div style="
          width: 28px; height: 28px; border-radius: 50%;
          background: #fff url('${logoUrl}') center/cover no-repeat;
          border: 2px solid ${color};
        "></div>
        <div style="
          padding: 6px 12px; border-radius: 6px;
          background: ${color}; color: #fff; font-weight: 800;
          letter-spacing: .5px; font-size: 12px; text-transform: uppercase;
          border: 2px solid rgba(255,255,255,.35);
          white-space: nowrap;
        ">
          ${label}
        </div>
      </div>
    `.trim();

  return L.divIcon({
    className: "station-banner",
    html,
    iconSize: [1, 1],
    iconAnchor: [0, 0],
  });
}

/* Fit bounds + clamp to PH */
function MapController({ points }) {
  const map = useMap();
  React.useEffect(() => {
    try {
      map.setMaxBounds(PH_BOUNDS);
      const latlngs = [];
      for (const p of Array.isArray(points) ? points : []) {
        const la = Number(p?.lat),
          lo = Number(p?.lng);
        if (!Number.isFinite(la) || !Number.isFinite(lo)) continue;
        const pair = L.latLng(la, lo);
        if (PH_BOUNDS.contains(pair)) latlngs.push(pair);
      }
      if (latlngs.length === 1) {
        map.setView(latlngs[0], Math.max(map.getZoom(), 10));
      } else if (latlngs.length > 1) {
        map.fitBounds(L.latLngBounds(latlngs), {
          padding: [24, 24],
        });
      } else {
        map.fitBounds(PH_BOUNDS, { padding: [24, 24] });
      }
    } catch {
      try {
        map.fitBounds(PH_BOUNDS, { padding: [24, 24] });
      } catch {}
    }
  }, [map, points]);
  return null;
}

/* Expose Leaflet map to parent (single ref) */
function useLeafletMapRef() {
  const mapRef = useRef(null);
  function MapRefCatcher() {
    const map = useMap();
    React.useEffect(() => {
      mapRef.current = map;
    }, [map]);
    return null;
  }
  return { mapRef, MapRefCatcher };
}

/* Station marker (click → flyTo + popup) */
function StationMarker({ s, selectedStationId, onDeselect }) {
  const map = useMap();
  const markerRef = useRef(null);
  const lat = num(s.latitude),
    lng = num(s.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !PH_BOUNDS.contains([lat, lng]))
    return null;

  const onClick = (e) =>
    map.flyTo(e.latlng, Math.max(map.getZoom(), 13), {
      duration: 0.8,
    });

  React.useEffect(() => {
    if (selectedStationId === s.id && markerRef.current) {
      const ll = L.latLng(lat, lng);
      map.flyTo(ll, Math.max(map.getZoom(), 16), { duration: 0.8 });
      markerRef.current.openPopup();
    }
  }, [selectedStationId, s.id, map, lat, lng]);

  return (
    <Marker
      position={[lat, lng]}
      icon={makeStationIcon(s)}
      eventHandlers={{
        click: onClick,
        popupclose: () => onDeselect?.(),
      }}
      ref={markerRef}
    >
      <Popup>
        <div style={{ minWidth: 280 }}>
          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
            }}
          >
            <img
              src={s.logo_url || "/assets/pnp_badge.png"}
              alt="logo"
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                border: "1px solid #e5e7eb",
              }}
            />
            <div>
              <strong style={{ fontSize: 15 }}>{s.name || "Police Station"}</strong>
              {s.unit_type && (
                <div
                  style={{
                    fontSize: 12,
                    color: "#6b7280",
                  }}
                >
                  {s.unit_type}
                </div>
              )}
            </div>
          </div>
          {s.address && (
            <div
              style={{
                marginTop: 6,
                whiteSpace: "pre-wrap",
              }}
            >
              {s.address}
            </div>
          )}
          {s.contact && <div style={{ marginTop: 4 }}>{s.contact}</div>}
          <div
            style={{
              marginTop: 6,
              color: "#6b7280",
              fontSize: 12,
            }}
          >
            {lat.toFixed(5)}, {lng.toFixed(5)}
          </div>
          {s.photo_url && (
            <img
              src={s.photo_url}
              alt={s.name || "Police Station"}
              style={{
                marginTop: 8,
                width: "100%",
                height: 140,
                objectFit: "cover",
                borderRadius: 6,
                border: "1px solid #e5e7eb",
              }}
            />
          )}
        </div>
      </Popup>
    </Marker>
  );
}

/* ================== MAIN PAGE ================== */
const AdminMaps = () => {
  const navigate = useNavigate();

  /* 🔒 auth flag (same idea as Dashboard) */
  const [authChecked, setAuthChecked] = useState(false);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [submenuOpen, setSubmenuOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const [victims, setVictims] = useState([]);
  const [suspects, setSuspects] = useState([]);
  const [stations, setStations] = useState([]);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const [loadingVictims, setLoadingVictims] = useState(true);
  const [loadingSuspects, setLoadingSuspects] = useState(true);
  const [loadingStations, setLoadingStations] = useState(true);

  const [error, setError] = useState("");

  /* ===== Layers ===== */
  const [showVictims, setShowVictims] = useState(true);
  const [showSuspects, setShowSuspects] = useState(true);
  const [showStations, setShowStations] = useState(true);

  /* ===== Filters (added like UserMaps) ===== */
  const [province, setProvince] = useState("All");
  const [status, setStatus] = useState("All");
  const [crimeType, setCrimeType] = useState("All");
  const [q, setQ] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  /* ===== Search (stations + Nominatim) ===== */
  const [placeQ, setPlaceQ] = useState("");
  const [suggestions, setSuggestions] = useState([]); // mixed: stations + osm
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchMarker, setSearchMarker] = useState(null); // {lat, lon, label, bbox?}
  const [selectedStationId, setSelectedStationId] = useState(null);
  const suggestTimer = useRef(null);

  const { mapRef, MapRefCatcher } = useLeafletMapRef();

  /* 🔒 logout helper (same style as Dashboard) */
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

  /* Load data (only kapag authChecked = true) */
  useEffect(() => {
    if (!authChecked) return;
    fetchVictims();
    fetchSuspects();
    fetchStations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecked]);

  const fetchVictims = async () => {
    setLoadingVictims(true);
    try {
      const res = await axios.get(`${API_BASE}/api/crimes/`, {
        params: {
          is_archived: false,
          ordering: "-created_at",
        },
        headers: {
          ...authHeader(),
        },
      });
      const rows = Array.isArray(res.data) ? res.data : res.data.results || [];
      setVictims(
        rows.map((r) => ({
          ...r,
          _status: normalizeVictimStatus(r),
        }))
      );
    } catch (err) {
      console.error("Error loading victims:", err?.response?.data || err.message);
      if (err?.response?.status === 401) {
        logout();
        return;
      }
      setError("Failed to load victim data.");
    } finally {
      setLoadingVictims(false);
    }
  };

  const fetchSuspects = async () => {
    setLoadingSuspects(true);
    try {
      const res = await axios.get(`${API_BASE}/api/suspects/`, {
        params: { ordering: "-created_at" },
        headers: {
          ...authHeader(),
        },
      });
      const rows = Array.isArray(res.data) ? res.data : res.data.results || [];
      setSuspects(rows);
    } catch (err) {
      console.error("Error loading suspects:", err?.response?.data || err.message);
      if (err?.response?.status === 401) {
        logout();
        return;
      }
      setError("Failed to load suspect data.");
    } finally {
      setLoadingSuspects(false);
    }
  };

  const fetchStations = async () => {
    setLoadingStations(true);
    try {
      const res = await axios.get(`${API_BASE}/api/stations/`, {
        params: { ordering: "name" },
        headers: {
          ...authHeader(),
        },
      });
      const rows = Array.isArray(res.data) ? res.data : res.data.results || [];
      setStations(rows);
    } catch (e) {
      console.warn(
        "No /api/stations/ yet or failed to load. Using fallback list.",
        e?.message
      );
      // NOTE: kung 401, mag-logout tayo, huwag fallback
      if (e?.response?.status === 401) {
        logout();
        return;
      }
      setStations([
        {
          id: 1,
          name: "Regional Maritime Unit 4A (HRMU4A)",
          short_label: "RMU 4A",
          unit_type: "MARPSTA",
          address: "PFDA Compound, Brgy. Dalahican, Lucena City, Quezon Province",
          contact: "Tel: (042) 123-4567",
          logo_url: "/assets/pnp_badge.png",
          photo_url: "/assets/login_image.jpg",
          latitude: 13.904241420897941,
          longitude: 121.62096977233887,
        },
        {
          id: 2,
          name: "PNP Maritime Sub-Station Cotta (MARPSTA)",
          short_label: "COTTA MARPSTA",
          unit_type: "MARPSTA",
          address: "Barangay Cotta, Lucena City, Philippines",
          contact: "Globe: 09454153681",
          logo_url: "/assets/pnp_badge.png",
          photo_url: "/assets/cotta.jpg",
          latitude: 13.914953568461064,
          longitude: 121.60727049651402,
        },
        {
          id: 3,
          name: "404B Maritime Police Precinct - Mauban, Quezon (404B MPP-Mauban)",
          short_label: "404B MPP",
          unit_type: "MPP",
          address: "Mauban, Quezon",
          contact: "Globe: 09xxxxxxxxx",
          logo_url: "/assets/pnp_badge.png",
          photo_url: "/assets/mauban.jpg",
          latitude: 14.191389368520202,
          longitude: 121.73333621279649,
        },
        {
          id: 4,
          name: "404th Maritime Police Station - Gumaca, Quezon (GUMACA MPP)",
          short_label: "GUMACA MPP",
          unit_type: "MPP",
          address: "Gumaca, Quezon",
          contact: "Globe: 09xxxxxxxxx",
          logo_url: "/assets/pnp_badge.png",
          photo_url: "/assets/Gumaca.jpg",
          latitude: 13.920681305136013,
          longitude: 122.0990179416759,
        },
        {
          id: 5,
          name: "Calauag Municipal Police Station (CALAUAG MPP)",
          short_label: "CALAUAG MPP",
          unit_type: "MPP",
          address: "X842+JV5, Brgy, Calauag, Quezon",
          contact: "0919 589 5664",
          logo_url: "/assets/pnp_badge.png",
          photo_url: "/assets/calauag.jpg",
          latitude: 13.961641208192516,
          longitude: 122.30227784503147,
        },
        {
          id: 6,
          name: "Batangas Maritime Police Station (Batangas MARPSTA)",
          short_label: "BATANGAS MARPSTA",
          unit_type: "MARPSTA",
          address: "Q22V+WCJ, PPA Compound, Brgy, Batangas City",
          contact: "0977 688 8685",
          logo_url: "/assets/pnp_badge.png",
          photo_url: "/assets/batangas.jpg",
          latitude: 13.75256375438007,
          longitude: 121.04351092522654,
        },
        {
          id: 7,
          name: "PNP MG-SWOS (Special Waterborne Operations School)",
          short_label: "MG-SWOS",
          unit_type: "MARPSTA",
          address: "Barangay Solo, Mabini, Batangas",
          contact: "0967 196 0375",
          logo_url: "/assets/pnp_badge.png",
          photo_url: "/assets/waterbourne.jpg",
          latitude: 13.751585382217858,
          longitude: 120.90185635398875,
        },
        {
          id: 8,
          name: "Lemery Municipal Police Station (LEMERY MMP)",
          short_label: "LEMERY MMP",
          unit_type: "MPP",
          address: "VWM7+HHV, Lemery, Batangas",
          contact: "0927 707 1191",
          logo_url: "/assets/pnp_badge.png",
          photo_url: "/assets/lemery.jpg",
          latitude: 13.884445538820232,
          longitude: 120.91379299832872,
        },
        {
          id: 9,
          name: "Talisay MPS, Batangas PPO",
          short_label: "TALISAY MPS",
          unit_type: "MPP",
          address: "Talisay, Batangas",
          contact: "09xxx xxx xxx",
          logo_url: "/assets/pnp_badge.png",
          photo_url: "/assets/talisay.jpg",
          latitude: 14.093169610539519,
          longitude: 121.02698249639461,
        },
        {
          id: 10,
          name: "Cavite Maritime Police Station (CAVITE MARPSTA)",
          short_label: "CAVITE MARPSTA",
          unit_type: "MARPSTA",
          address: "9Q4P+4QM, Brgy Capipisa E Rd, West Road, Tanza, Cavite",
          contact: "0916 358 3967",
          logo_url: "/assets/pnp_badge.png",
          photo_url: "/assets/cavite.png",
          latitude: 14.357993901189012,
          longitude: 120.7862361220883,
        },
        {
          id: 11,
          name: "Noveleta Police Station (NOVELETA MPP)",
          short_label: "NOVELETA MPP",
          unit_type: "MPP",
          address: "3455 Ipil St, San Rafael 2, Noveleta, Cavite",
          contact: "0998 598 5608",
          logo_url: "/assets/pnp_badge.png",
          photo_url: "/assets/noveleta.jpg",
          latitude: 14.451199570834683,
          longitude: 120.8800762589848,
        },
      ]);
    } finally {
      setLoadingStations(false);
    }
  };

  /* ===== Derived Crime Types (for dropdown) ===== */
  const crimeTypes = useMemo(() => {
    const set = new Set();
    victims.forEach((v) => v?.crime_type && set.add(String(v.crime_type)));
    suspects.forEach((s) => s?.s_crime_type && set.add(String(s.s_crime_type)));
    return ["All", ...Array.from(set).sort()];
  }, [victims, suspects]);

  /* ===== Record filtering (same rules as UserMaps) ===== */
  const filteredVictims = useMemo(() => {
    return victims.filter((v) => {
      const lat = num(v.latitude),
        lng = num(v.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || !PH_BOUNDS.contains([lat, lng]))
        return false;
      if (province !== "All" && v.loc_province && v.loc_province !== province)
        return false;
      if (status !== "All" && normalizeVictimStatus(v) !== status) return false;
      if (crimeType !== "All" && v.crime_type && v.crime_type !== crimeType) return false;
      if (q) {
        const hay = [
          v.v_first_name,
          v.v_middle_name,
          v.v_last_name,
          v.loc_barangay,
          v.loc_city_municipality,
          v.loc_province,
          v.loc_waterbody,
          v.crime_type,
          v.loc_kind,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      if (dateFrom) {
        const d = new Date(v.happened_at || v.created_at || 0);
        if (!Number.isNaN(d.getTime()) && d < new Date(dateFrom)) return false;
      }
      if (dateTo) {
        const d = new Date(v.happened_at || v.created_at || 0);
        if (!Number.isNaN(d.getTime()) && d > new Date(`${dateTo}T23:59:59`))
          return false;
      }
      return true;
    });
  }, [victims, province, status, crimeType, q, dateFrom, dateTo]);

  const filteredSuspects = useMemo(() => {
    return suspects.filter((s) => {
      const lat = num(s.latitude),
        lng = num(s.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || !PH_BOUNDS.contains([lat, lng]))
        return false;
      if (province !== "All" && s.loc_province && s.loc_province !== province)
        return false;
      if (crimeType !== "All" && s.s_crime_type && s.s_crime_type !== crimeType)
        return false;
      if (q) {
        const hay = [
          s.s_first_name,
          s.s_middle_name,
          s.s_last_name,
          s.loc_barangay,
          s.loc_city_municipality,
          s.loc_province,
          s.loc_waterbody,
          s.s_crime_type,
          s.loc_kind,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      if (dateFrom) {
        const d = new Date(s.created_at || 0);
        if (!Number.isNaN(d.getTime()) && d < new Date(dateFrom)) return false;
      }
      if (dateTo) {
        const d = new Date(s.created_at || 0);
        if (!Number.isNaN(d.getTime()) && d > new Date(`${dateTo}T23:59:59`))
          return false;
      }
      return true;
    });
  }, [suspects, province, crimeType, q, dateFrom, dateTo]);

  /* Map points to fit (respect toggles) */
  const points = useMemo(() => {
    const list = [];
    if (showVictims)
      filteredVictims.forEach((v) => {
        const la = num(v.latitude),
          lo = num(v.longitude);
        if (Number.isFinite(la) && Number.isFinite(lo))
          list.push({
            kind: "victim",
            id: `v-${v.id}`,
            lat: la,
            lng: lo,
            _status: normalizeVictimStatus(v),
          });
      });
    if (showSuspects)
      filteredSuspects.forEach((s) => {
        const la = num(s.latitude),
          lo = num(s.longitude);
        if (Number.isFinite(la) && Number.isFinite(lo))
          list.push({
            kind: "suspect",
            id: `s-${s.id}`,
            lat: la,
            lng: lo,
          });
      });
    if (showStations)
      stations.forEach((t) => {
        const la = num(t.latitude),
          lo = num(t.longitude);
        if (Number.isFinite(la) && Number.isFinite(lo))
          list.push({
            kind: "station",
            id: `t-${t.id}`,
            lat: la,
            lng: lo,
          });
      });
    return list;
  }, [filteredVictims, filteredSuspects, stations, showVictims, showSuspects, showStations]);

  /* ===== Search (stations priority + Nominatim fallback) ===== */
  useEffect(() => {
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    const qtxt = placeQ.trim();
    if (!qtxt) {
      setSuggestions([]);
      return;
    }

    suggestTimer.current = setTimeout(async () => {
      try {
        setSearchError("");

        // local stations
        const qLower = qtxt.toLowerCase();
        const local = stations
          .filter((st) => {
            const hay = [st.name, st.short_label, st.address]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();
            return hay.includes(qLower);
          })
          .slice(0, 6)
          .map((st) => ({
            type: "station",
            id: st.id,
            lat: Number(st.latitude),
            lon: Number(st.longitude),
            display_name: st.name || "Police Station",
            station: st,
          }));

        // nominatim (PH bounded)
        const viewbox = [116.0, 21.5, 127.0, 4.5];
        const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=8&viewbox=${viewbox.join(
          ","
        )}&bounded=1&q=${encodeURIComponent(qtxt)}`;
        const res = await fetch(url, {
          headers: {
            Referer: "https://your-app.example/",
          },
        });
        if (!res.ok) throw new Error("Search failed");
        const data = await res.json();
        const osm = (Array.isArray(data) ? data : []).map((d) => ({
          type: "osm",
          lat: Number(d.lat),
          lon: Number(d.lon),
          display_name: d.display_name,
          bbox: d.boundingbox,
        }));

        setSuggestions([...local, ...osm].slice(0, 10));
      } catch (e) {
        console.error(e);
        setSearchError("Search failed. Please try again.");
      }
    }, 250);

    return () => suggestTimer.current && clearTimeout(suggestTimer.current);
  }, [placeQ, stations]);

  const doSearch = async (queryText) => {
    const qtxt = (queryText || "").trim();
    if (!qtxt) return;

    // local station first
    const qLower = qtxt.toLowerCase();
    const localMatch = stations.find((st) => {
      const hay = [st.name, st.short_label, st.address]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(qLower);
    });
    if (
      localMatch &&
      Number.isFinite(num(localMatch.latitude)) &&
      Number.isFinite(num(localMatch.longitude))
    ) {
      setSelectedStationId(localMatch.id);
      setPlaceQ(localMatch.name || "Police Station");
      setSearchMarker(null);
      const map = mapRef.current;
      if (map)
        map.flyTo([Number(localMatch.latitude), Number(localMatch.longitude)], 16, {
          duration: 0.8,
        });
      return;
    }

    // nominatim fallback
    setSearchLoading(true);
    setSearchError("");
    try {
      const viewbox = [116.0, 21.5, 127.0, 4.5];
      const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1&viewbox=${viewbox.join(
        ","
      )}&bounded=1&q=${encodeURIComponent(qtxt)}`;
      const res = await fetch(url, {
        headers: {
          Referer: "https://your-app.example/",
        },
      });
      if (!res.ok) throw new Error("Search failed");
      const [d] = await res.json();
      if (!d) {
        setSearchError("No results found in the Philippines.");
        return;
      }
      const lat = Number(d.lat),
        lon = Number(d.lon);
      const bbox = d.boundingbox;
      setSelectedStationId(null);
      setSearchMarker({
        lat,
        lon,
        label: d.display_name,
        bbox,
      });

      const map = mapRef.current;
      if (map && Number.isFinite(lat) && Number.isFinite(lon)) {
        map.flyTo([lat, lon], 16, {
          duration: 0.9,
        });
        if (Array.isArray(bbox) && bbox.length === 4) {
          const south = Number(bbox[0]),
            north = Number(bbox[1]),
            west = Number(bbox[2]),
            east = Number(bbox[3]);
          if ([south, north, west, east].every(Number.isFinite)) {
            const b = L.latLngBounds(L.latLng(south, west), L.latLng(north, east));
            if (b.isValid()) setTimeout(() => map.fitBounds(b.pad(0.2)), 60);
          }
        }
      }
    } catch (e) {
      console.error(e);
      setSearchError("Search failed. Please try again.");
    } finally {
      setSearchLoading(false);
    }
  };

  const chooseSuggestion = (s) => {
    if (s.type === "station" && s.station) {
      setSuggestions([]);
      setSelectedStationId(s.station.id);
      setPlaceQ(s.station.name || "Police Station");
      setSearchMarker(null);

      const map = mapRef.current;
      const la = Number(s.station.latitude),
        lo = Number(s.station.longitude);
      if (map && Number.isFinite(la) && Number.isFinite(lo)) {
        map.flyTo([la, lo], 16, {
          duration: 0.8,
        });
      }
      return;
    }

    // nominatim suggestion
    setPlaceQ(s.display_name);
    setSuggestions([]);
    setSelectedStationId(null);
    setSearchMarker({
      lat: s.lat,
      lon: s.lon,
      label: s.display_name,
      bbox: s.bbox,
    });

    const map = mapRef.current;
    if (map && Number.isFinite(s.lat) && Number.isFinite(s.lon)) {
      map.flyTo([s.lat, s.lon], 16, {
        duration: 0.8,
      });
      if (Array.isArray(s.bbox) && s.bbox.length === 4) {
        const [south, north, west, east] = s.bbox.map(Number);
        if ([south, north, west, east].every(Number.isFinite)) {
          const b = L.latLngBounds(L.latLng(south, west), L.latLng(north, east));
          if (b.isValid()) setTimeout(() => map.fitBounds(b.pad(0.2)), 50);
        }
      }
    }
  };

  const clearSearchPin = () => {
    setSearchMarker(null);
    setSelectedStationId(null);
    setSearchError("");
    const map = mapRef.current;
    if (map)
      map.fitBounds(PH_BOUNDS, {
        padding: [24, 24],
      });
  };

  /* Popup data from filtered lists */
  const victimPoints = useMemo(
    () =>
      filteredVictims.map((v) => ({
        id: v.id,
        la: num(v.latitude),
        lo: num(v.longitude),
        title: v.crime_type || "Incident",
        name:
          fullName(v.v_first_name, v.v_middle_name, v.v_last_name) || "Unnamed Victim",
        where: [v.loc_barangay, v.loc_city_municipality, v.loc_province]
          .filter(Boolean)
          .join(", "),
        when: v.happened_at ? iso(v.happened_at) : "",
        extra: v.loc_kind
          ? `${String(v.loc_kind).toUpperCase()}${
              v.loc_waterbody ? ` (${v.loc_waterbody})` : ""
            }`
          : "",
        status: normalizeVictimStatus(v),
      })),
    [filteredVictims]
  );

  const suspectPoints = useMemo(
    () =>
      filteredSuspects.map((s) => ({
        id: s.id,
        la: num(s.latitude),
        lo: num(s.longitude),
        title: s.s_crime_type || "Incident",
        name:
          fullName(s.s_first_name, s.s_middle_name, s.s_last_name) ||
          "Unnamed Suspect",
        where: [s.loc_barangay, s.loc_city_municipality, s.loc_province]
          .filter(Boolean)
          .join(", "),
        when: s.created_at ? String(s.created_at).split("T")[0] : "",
        extra: s.loc_kind
          ? `${String(s.loc_kind).toUpperCase()}${
              s.loc_waterbody ? ` (${s.loc_waterbody})` : ""
            }`
          : "",
      })),
    [filteredSuspects]
  );

  const toggleSubmenu = () => setSubmenuOpen((s) => !s);

  /* 🔒 Huwag mag-render hangga’t di pa tapos auth check */
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
              <div className="submenu-toggle" onClick={toggleSubmenu}>
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

        {/* ======= MAIN CONTENT ======= */}
        <main
          className="main-content"

        >
          {error && (
            <div
              style={{
                color: "crimson",
                marginBottom: 12,
              }}
            >
              {error}
            </div>
          )}
          <div className="page-header" style={{ marginBottom: 8 }}>
            <h1>Crime/Incidents Maps</h1>
          </div>

          {/* ===== Record Filters ===== */}
          <div className="filters-bar">
            <label className="filter">
              <span>Layers</span>
              <div className="toggles">
                <label>
                  <input
                    type="checkbox"
                    checked={showVictims}
                    onChange={(e) => setShowVictims(e.target.checked)}
                  />{" "}
                  Victims
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={showSuspects}
                    onChange={(e) => setShowSuspects(e.target.checked)}
                  />{" "}
                  Suspects
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={showStations}
                    onChange={(e) => setShowStations(e.target.checked)}
                  />{" "}
                  Stations
                </label>
              </div>
            </label>

            <label className="filter">
              <span>Province (IV-A)</span>
              <select value={province} onChange={(e) => setProvince(e.target.value)}>
                {R4A_PROVINCES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>

            <label className="filter">
              <span>Status (Victims)</span>
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                {["All", ...VICTIM_STATUSES].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>


            <label className="filter">
              <span>Date</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </label>

         
          </div>

          {/* ===== Map Section with inline Search Overlay ===== */}
          <section
            style={{
              height: "75vh",
              minHeight: 480,
            }}
          >
            <div
              style={{
                height: "100%",
                borderRadius: 10,
                overflow: "hidden",
                border: "1px solid #e5e7eb",
                position: "relative",
              }}
            >
              {/* Map itself */}
              <MapContainer
                className="leaflet-map"
                center={PH_CENTER}
                zoom={6}
                maxBounds={PH_BOUNDS}
                maxBoundsViscosity={1.0}
                worldCopyJump={false}
                zoomControl={false}   // ✅ IMPORTANT
                style={{
                  height: "100%",
                  width: "100%",
                }}
              >
                <MapRefCatcher />
                <MapController points={points} />

                <LayersControl position="topright">
                  <LayersControl.BaseLayer checked name="Satellite (with labels)">
                    <LayerGroup>
                      <TileLayer
                        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                        attribution="&copy; Esri"
                        detectRetina
                      />
                      <TileLayer
                        url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                        attribution=""
                        opacity={0.95}
                      />
                    </LayerGroup>
                  </LayersControl.BaseLayer>

                  <LayersControl.BaseLayer name="OpenStreetMap (Standard)">
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution="&copy; OpenStreetMap contributors"
                      detectRetina
                    />
                  </LayersControl.BaseLayer>

                  {/* Victims */}
                  {showVictims && (
                    <LayersControl.Overlay checked name="Victims (yellow circles)">
                      <LayerGroup>
                        {victimPoints.map((p) => (
                          <CircleMarker
                            key={`v-${p.id}`}
                            center={[p.la, p.lo]}
                            radius={8}
                            pathOptions={{
                              color:
                                p.status === "Unsolved"
                                  ? "#dc2626"
                                  : p.status === "Solved"
                                  ? "#16a34a"
                                  : "#eab308",
                              fillColor:
                                p.status === "Unsolved"
                                  ? "#fecaca"
                                  : p.status === "Solved"
                                  ? "#bbf7d0"
                                  : "#fde047",
                              fillOpacity: 0.9,
                              weight: 2,
                            }}
                          >
                            <Popup>
                              <div
                                style={{
                                  minWidth: 220,
                                }}
                              >
                                <strong>Victim</strong>
                                <br />
                                <strong>{p.title}</strong>
                                <br />
                                {p.name}
                                <br />
                                {p.where || ""}
                                <br />
                                {p.la.toFixed(5)}, {p.lo.toFixed(5)}
                                <br />
                                {p.extra && <em>{p.extra}</em>}
                                <br />
                                {p.when && <small>{p.when}</small>}
                                <br />
                                <small>Status: {p.status}</small>
                              </div>
                            </Popup>
                          </CircleMarker>
                        ))}
                      </LayerGroup>
                    </LayersControl.Overlay>
                  )}

                  {/* Suspects */}
                  {showSuspects && (
                    <LayersControl.Overlay checked name="Suspects (red stars)">
                      <LayerGroup>
                        {suspectPoints.map((p) => (
                          <Marker key={`s-${p.id}`} position={[p.la, p.lo]} icon={starIcon}>
                            <Popup>
                              <div
                                style={{
                                  minWidth: 220,
                                }}
                              >
                                <strong>Suspect</strong>
                                <br />
                                <strong>{p.title}</strong>
                                <br />
                                {p.name}
                                <br />
                                {p.where || ""}
                                <br />
                                {p.la.toFixed(5)}, {p.lo.toFixed(5)}
                                <br />
                                {p.extra && <em>{p.extra}</em>}
                                <br />
                                {p.when && <small>{p.when}</small>}
                              </div>
                            </Popup>
                          </Marker>
                        ))}
                      </LayerGroup>
                    </LayersControl.Overlay>
                  )}

                  {/* Stations */}
                  {showStations && (
                    <LayersControl.Overlay checked name="Police Stations (tap to zoom)">
                      <LayerGroup>
                        {stations.map((s) => (
                          <StationMarker
                            key={s.id ?? `${s.latitude}-${s.longitude}`}
                            s={s}
                            selectedStationId={selectedStationId}
                            onDeselect={() => setSelectedStationId(null)}
                          />
                        ))}
                      </LayerGroup>
                    </LayersControl.Overlay>
                  )}

                  {/* Search pin (OSM) */}
                  {searchMarker && (
                    <LayersControl.Overlay checked name="Search Pin">
                      <LayerGroup>
                        <Marker
                          position={[searchMarker.lat, searchMarker.lon]}
                          icon={L.divIcon({
                            className: "search-marker",
                            html: `<div style="transform:translate(-50%,-100%)">
                                      <svg width="28" height="28" viewBox="0 0 24 24">
                                        <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z" fill="#2563eb"/>
                                      </svg>
                                    </div>`,
                            iconSize: [28, 28],
                            iconAnchor: [14, 28],
                          })}
                          draggable
                          eventHandlers={{
                            dragend: (e) => {
                              const m = e.target.getLatLng();
                              const lat = Number(m.lat),
                                lon = Number(m.lng);
                              if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
                              setSearchMarker((prev) =>
                                prev ? { ...prev, lat, lon } : { lat, lon }
                              );
                            },
                          }}
                        >
                          <Popup>
                            <div className="u-pop">
                              <div className="u-pop-h">Selected place</div>
                              <div className="u-pop-row" style={{ maxWidth: 260 }}>
                                {searchMarker.label || "Unnamed"}
                              </div>
                              <div className="u-pop-row">
                                {`${searchMarker.lat.toFixed(5)}, ${searchMarker.lon.toFixed(
                                  5
                                )}`}
                              </div>
                              <button
                                className="btn"
                                style={{ marginTop: 6 }}
                                onClick={clearSearchPin}
                              >
                                Clear pin
                              </button>
                            </div>
                          </Popup>
                        </Marker>
                      </LayerGroup>
                    </LayersControl.Overlay>
                  )}
                </LayersControl>
              </MapContainer>

              {/* ===== SEARCH OVERLAY NA NASA LOOB NA NG MAP ===== */}
              <div
                style={{
                  position: "absolute",
                  top: 12,
                  left: 12,
                  zIndex: 500,
                  maxWidth: 520,
                }}
              >
             <div
              style={{
                background: "#ffffff",
                color: "#1e293b",
                border: "1px solid #e5e7eb",
                boxShadow: "0 10px 24px rgba(15,23,42,0.2)",
                fontSize: 12,
                padding: 12,
                borderRadius: 10,
              }}
            >
              {/* TITLE */}
              <div
                style={{
                  marginBottom: 8,
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: ".08em",
                  color: "#6b7280",
                }}
              >
                Search Place / Station
              </div>

              {/* INPUT + BUTTONS */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {/* INPUT */}
                <div style={{ position: "relative", flex: 1 }}>
                  <input
                    value={placeQ}
                    onChange={(e) => setPlaceQ(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") doSearch(placeQ);
                    }}
                    placeholder="Search station or place..."
                    style={{
                      width: "100%",
                      height: 36,
                      padding: "0 10px",
                      borderRadius: 8,
                      border: "1px solid #d1d5db",
                      background: "#ffffff",
                      color: "#1e293b",
                      fontSize: 13,
                      outline: "none",
                    }}
                  />

                  {/* SUGGESTIONS */}
                  {suggestions.length > 0 && (
                    <div
                      style={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        top: "110%",
                        zIndex: 600,
                        background: "#ffffff",
                        border: "1px solid #e5e7eb",
                        borderRadius: 8,
                        maxHeight: 260,
                        overflowY: "auto",
                        boxShadow: "0 10px 24px rgba(0,0,0,0.15)",
                      }}
                    >
                      {suggestions.map((s, idx) => (
                        <div
                          key={idx}
                          onClick={() => chooseSuggestion(s)}
                          style={{
                            padding: "8px 10px",
                            cursor: "pointer",
                            display: "flex",
                            gap: 8,
                            alignItems: "center",
                            borderBottom: "1px solid #f1f5f9",
                          }}
                          onMouseDown={(e) => e.preventDefault()}
                        >
                          <span
                            style={{
                              fontSize: 10,
                              padding: "2px 6px",
                              borderRadius: 999,
                              background:
                                s.type === "station" ? "#0f766e" : "#e5e7eb",
                              color: s.type === "station" ? "#fff" : "#374151",
                            }}
                          >
                            {s.type === "station" ? "Station" : "Place"}
                          </span>

                          <div style={{ overflow: "hidden" }}>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>
                              {s.type === "station"
                                ? s.station?.name || s.display_name
                                : s.display_name.split(",")[0]}
                            </div>
                            <div
                              style={{
                                fontSize: 11,
                                color: "#6b7280",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {s.type === "station"
                                ? s.station?.address || s.display_name
                                : s.display_name}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* SEARCH BUTTON */}
                <button
                  onClick={() => doSearch(placeQ)}
                  style={{
                    height: 36,
                    minWidth: 40,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    background: "#f9fafb",
                    cursor: "pointer",
                  }}
                >
                  {searchLoading ? (
                    <FontAwesomeIcon icon={faSpinner} spin />
                  ) : (
                    <FontAwesomeIcon icon={faLocationCrosshairs} />
                  )}
                </button>

                {/* CLEAR BUTTON */}
                {(searchMarker || selectedStationId) && (
                  <button
                    onClick={clearSearchPin}
                    style={{
                      height: 36,
                      padding: "0 10px",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      borderRadius: 8,
                      border: "1px solid #e5e7eb",
                      background: "#ffffff",
                      color: "#374151",
                      cursor: "pointer",
                    }}
                  >
                    <FontAwesomeIcon icon={faXmark} />
                    Clear
                  </button>
                )}
              </div>

              {/* ERROR */}
              {searchError && (
                <div style={{ marginTop: 6, fontSize: 11, color: "#dc2626" }}>
                  {searchError}
                </div>
              )}
            </div>
            </div>
            </div>

            {/* Legend / status */}
            <div
              style={{
                marginTop: 10,
                display: "flex",
                gap: 8,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  width: 14,
                  height: 14,
                  background: "#fde047",
                  border: "2px solid #eab308",
                  borderRadius: "50%",
                  display: "inline-block",
                }}
              />
              <small>Victim</small>
              <span
                style={{
                  color: "#ef4444",
                  fontSize: 16,
                  marginLeft: 12,
                  lineHeight: 0,
                }}
              >
                ★
              </span>
              <small>Suspect</small>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  marginLeft: 12,
                }}
              >
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: "#fff",
                    border: "2px solid #1e3a8a",
                  }}
                />
                <div
                  style={{
                    padding: "2px 8px",
                    background: "#1e3a8a",
                    color: "#fff",
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  Station
                </div>
              </div>
              {(loadingVictims || loadingSuspects || loadingStations) && (
                <div
                  style={{
                    marginLeft: 12,
                    color: "#6b7280",
                  }}
                >
                  Loading map data…
                </div>
              )}
              
              
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};

export default AdminMaps;
