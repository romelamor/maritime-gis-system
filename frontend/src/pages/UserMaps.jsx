// src/pages/UserMaps.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";

/* ===== Icons ===== */
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faHome,
  faUser,
  faFileInvoice,
  faMapLocation,
  faRightFromBracket,
  faLocationCrosshairs,
  faXmark,
  faSpinner,
} from "@fortawesome/free-solid-svg-icons";

/* ===== Centralized Axios ===== */
import api from "../lib/api";

/* ===== Leaflet ===== */
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

/* ===== Styles ===== */
import "../assets/css/user-maps.css";

/* ================= GEO ================= */
const PH_BOUNDS = L.latLngBounds(L.latLng(4.5, 116.0), L.latLng(21.5, 127.0));
const PH_CENTER = PH_BOUNDS.getCenter();
const R4A_PROVINCES = ["All", "Cavite", "Laguna", "Batangas", "Rizal", "Quezon"];

/* Default marker icon (Leaflet bundler quirk) */
const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

/* ================= HELPERS ================= */
const VICTIM_STATUSES = ["Ongoing", "Solved", "Unsolved"];
const fullName = (a, b, c) => [a, b, c].filter(Boolean).join(" ");
const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");
const normalizeVictimStatus = (row) => {
  const value = row?.status ?? row?.case_status ?? row?.is_active ?? row?._status;
  const s = String(value ?? "").trim();
  return VICTIM_STATUSES.includes(s) ? s : "Ongoing";
};
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/* Suspects star icon */
const starIcon = L.divIcon({
  className: "star-marker",
  html: `<div style="font-size:28px;color:#ef4444;transform:translate(-50%,-50%);text-shadow:0 0 3px rgba(0,0,0,.4)">★</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

/* Search pin */
const searchIcon = L.divIcon({
  className: "search-marker",
  html: `<div style="transform:translate(-50%,-100%)">
           <svg width="28" height="28" viewBox="0 0 24 24">
             <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z" fill="#2563eb"/>
           </svg>
         </div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});

/* ===== Station banner icon (logo + colored pill) ===== */
function stationColorByType(type) {
  return type === "MARPSTA"
    ? "#1e3a8a"
    : type === "MPP"
    ? "#b91c1c"
    : "#0f766e";
}
function guessType(name = "", unitType) {
  const n = String(name).toUpperCase();
  return unitType
    ? unitType
    : n.includes("MARPSTA") || n.includes("MARITIME")
    ? "MARPSTA"
    : n.includes("MPP") || n.includes("PRECINCT")
    ? "MPP"
    : "DEFAULT";
}
function makeStationIcon(station) {
  const type = guessType(station.name, station.unit_type);
  const color = stationColorByType(type);
  const logoUrl = station.logo_url || "/assets/pnp_badge.png";
  const label =
    (station.short_label || station.name || "Police Station").toUpperCase();

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

/* Fit/clamp bounds based on points */
function MapController({ points }) {
  const map = useMap();
  useEffect(() => {
    try {
      map.setMaxBounds(PH_BOUNDS);

      const latlngs = [];
      for (const p of Array.isArray(points) ? points : []) {
        const la = Number(p?.lat);
        const lo = Number(p?.lng);
        if (!Number.isFinite(la) || !Number.isFinite(lo)) continue;
        const pair = L.latLng(la, lo);
        if (PH_BOUNDS.contains(pair)) latlngs.push(pair);
      }

      if (latlngs.length === 1) {
        map.setView(latlngs[0], Math.max(map.getZoom(), 10));
      } else if (latlngs.length > 1) {
        const b = L.latLngBounds(latlngs);
        map.fitBounds(b, { padding: [24, 24] });
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

/* Expose map to parent (for flyTo) */
function useLeafletMapRef() {
  const mapRef = useRef(null);
  function MapRefCatcher() {
    const map = useMap();
    useEffect(() => {
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
  const lat = num(s.latitude);
  const lng = num(s.longitude);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    !PH_BOUNDS.contains([lat, lng])
  )
    return null;

  const onClick = (e) => {
    map.flyTo(e.latlng, Math.max(map.getZoom(), 13), { duration: 0.8 });
  };

  // Auto-open popup when this station is selected from the search list
  useEffect(() => {
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
      eventHandlers={{ click: onClick, popupclose: () => onDeselect?.() }}
      ref={markerRef}
    >
      <Popup>
        <div className="u-pop" style={{ minWidth: 280 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
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
              <div className="u-pop-h">{s.name || "Police Station"}</div>
              {s.unit_type && (
                <div className="u-pop-sub">{s.unit_type}</div>
              )}
            </div>
          </div>
          {s.address && (
            <div className="u-pop-row" style={{ marginTop: 6 }}>
              {s.address}
            </div>
          )}
          {s.contact && <div className="u-pop-row">{s.contact}</div>}
          <div className="u-pop-sub">
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

/* =================== PAGE =================== */
export default function UserMaps() {
  const navigate = useNavigate();

  /* 🔒 auth flag */
  const [authChecked, setAuthChecked] = useState(false);

  /* layout state */
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [submenuOpen, setSubmenuOpen] = useState(false);

  /* data */
  const [victims, setVictims] = useState([]);
  const [suspects, setSuspects] = useState([]);
  const [stations, setStations] = useState([]);

  /* user profile */
  const [profile, setProfile] = useState({
    first_name: "",
    middle_name: "",
    last_name: "",
    section: "",
  });

  const [loading, setLoading] = useState(true);
  const [loadingStations, setLoadingStations] = useState(true);
  const [error, setError] = useState("");

  /* filters */
  const [showVictims, setShowVictims] = useState(true);
  const [showSuspects, setShowSuspects] = useState(true);
  const [showStations, setShowStations] = useState(true);
  const [province, setProvince] = useState("All");
  const [status, setStatus] = useState("All");
  const [crimeType, setCrimeType] = useState("All");
  const [q, setQ] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  /* place search */
  const [placeQ, setPlaceQ] = useState("");
  const [suggestions, setSuggestions] = useState([]); // mixed: stations + nominatim
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchMarker, setSearchMarker] = useState(null); // {lat, lon, label, bbox?}
  const [selectedStationId, setSelectedStationId] = useState(null);
  const suggestTimer = useRef(null);

  const { mapRef, MapRefCatcher } = useLeafletMapRef();

  /* 🔒 logout helper (same idea as UserSuspectReport) */
  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("access_token");
    localStorage.removeItem("access");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("refresh"); // ✅ dagdag para same cleanup as admin pages
    navigate("/Userlogin", { replace: true });
  };

  /* 🔒 Route guard: redirect to Userlogin if walang token */
  useEffect(() => {
    const hasToken =
      localStorage.getItem("token") ||
      localStorage.getItem("access_token") ||
      localStorage.getItem("access");
    if (!hasToken) {
      navigate("/Userlogin", { replace: true });
    } else {
      setAuthChecked(true);
    }
  }, [navigate]);

  /* ======= fetch app data (victims + suspects) ======= */
  /* ======= fetch app data (victims + suspects + profile) ======= */
  useEffect(() => {
    if (!authChecked) return;

    (async () => {
      setLoading(true);
      setError("");

      try {
        const [vRes, sRes, pRes] = await Promise.all([
          api.get(`/api/crimes/`, {
            params: { is_archived: false, ordering: "-created_at" },
          }),

          api.get(`/api/suspects/`, {
            params: { ordering: "-created_at" },
          }),

          // ✅ USER PROFILE
          api.get(`/api/personnel/me/`),
        ]);

        /* victims */
        const vRows = Array.isArray(vRes.data)
          ? vRes.data
          : vRes.data?.results || [];

        /* suspects */
        const sRows = Array.isArray(sRes.data)
          ? sRes.data
          : sRes.data?.results || [];

        /* set victims */
        setVictims(
          vRows.map((r) => ({
            ...r,
            _status: normalizeVictimStatus(r),
          }))
        );

        /* set suspects */
        setSuspects(sRows);

        /* ✅ set user profile */
        setProfile(pRes.data || {});
        
      } catch (e) {
        console.error(e);

        if (e?.response?.status === 401) {
          logout();
          return;
        }

        setError("Failed to load map data.");
      } finally {
        setLoading(false);
      }
    })();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecked]);

  /* fetch stations (API or fallback) */
  useEffect(() => {
    if (!authChecked) return;
    (async () => {
      setLoadingStations(true);
      try {
        const res = await api.get(`/api/stations/`, {
          params: { ordering: "name" },
        });
        const rows = Array.isArray(res.data)
          ? res.data
          : res.data?.results || [];
        setStations(rows);
      } catch (e) {
        if (e?.response?.status === 401) {
          logout();
          return;
        }
        // Fallback sample list (11 stations)
        setStations([
          {
            id: 1,
            name: "Regional Maritime Unit 4A (HRMU4A)",
            short_label: "RMU 4A",
            unit_type: "MARPSTA",
            address:
              "PFDA Compound, Brgy. Dalahican, Lucena City, Quezon Province",
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
            name: "404B Maritime Police Precinct - Mauban, Quezon",
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
            name: "404th Maritime Police Station - Gumaca, Quezon",
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
            name: "Calauag Municipal Police Station",
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
            name: "Batangas Maritime Police Station",
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
            name: "Lemery Municipal Police Station",
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
            name: "Cavite Maritime Police Station",
            short_label: "CAVITE MARPSTA",
            unit_type: "MARPSTA",
            address:
              "9Q4P+4QM, Brgy Capipisa E Rd, West Road, Tanza, Cavite",
            contact: "0916 358 3967",
            logo_url: "/assets/pnp_badge.png",
            photo_url: "/assets/cavite.png",
            latitude: 14.357993901189012,
            longitude: 120.7862361220883,
          },
          {
            id: 11,
            name: "Noveleta Police Station",
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
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecked]);

  /* derived crime types */
  const crimeTypes = useMemo(() => {
    const set = new Set();
    victims.forEach((v) => v?.crime_type && set.add(String(v.crime_type)));
    suspects.forEach(
      (s) => s?.s_crime_type && set.add(String(s.s_crime_type))
    );
    return ["All", ...Array.from(set).sort()];
  }, [victims, suspects]);

  /* record filtering */
  const filteredVictims = useMemo(() => {
    return victims.filter((v) => {
      const lat = num(v.latitude),
        lng = num(v.longitude);
      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        !PH_BOUNDS.contains([lat, lng])
      )
        return false;
      if (province !== "All" && v.loc_province && v.loc_province !== province)
        return false;
      if (status !== "All" && normalizeVictimStatus(v) !== status) return false;
      if (
        crimeType !== "All" &&
        v.crime_type &&
        v.crime_type !== crimeType
      )
        return false;
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
        if (
          !Number.isNaN(d.getTime()) &&
          d > new Date(`${dateTo}T23:59:59`)
        )
          return false;
      }
      return true;
    });
  }, [victims, province, status, crimeType, q, dateFrom, dateTo]);

  const filteredSuspects = useMemo(() => {
    return suspects.filter((s) => {
      const lat = num(s.latitude),
        lng = num(s.longitude);
      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        !PH_BOUNDS.contains([lat, lng])
      )
        return false;
      if (
        province !== "All" &&
        s.loc_province &&
        s.loc_province !== province
      )
        return false;
      if (
        crimeType !== "All" &&
        s.s_crime_type &&
        s.s_crime_type !== crimeType
      )
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
        if (
          !Number.isNaN(d.getTime()) &&
          d > new Date(`${dateTo}T23:59:59`)
        )
          return false;
      }
      return true;
    });
  }, [suspects, province, crimeType, q, dateFrom, dateTo]);

  /* points to fit (includes stations if toggled) */
  const points = useMemo(() => {
    const list = [];
    if (showVictims)
      filteredVictims.forEach((v) => {
        const la = num(v.latitude),
          lo = num(v.longitude);
        if (Number.isFinite(la) && Number.isFinite(lo))
          list.push({ kind: "victim", id: `v-${v.id}`, lat: la, lng: lo });
      });
    if (showSuspects)
      filteredSuspects.forEach((s) => {
        const la = num(s.latitude),
          lo = num(s.longitude);
        if (Number.isFinite(la) && Number.isFinite(lo))
          list.push({ kind: "suspect", id: `s-${s.id}`, lat: la, lng: lo });
      });
    if (showStations)
      stations.forEach((st) => {
        const la = num(st.latitude),
          lo = num(st.longitude);
        if (Number.isFinite(la) && Number.isFinite(lo))
          list.push({ kind: "station", id: `t-${st.id}`, lat: la, lng: lo });
      });
    return list;
  }, [
    filteredVictims,
    filteredSuspects,
    stations,
    showVictims,
    showSuspects,
    showStations,
  ]);

  /* ============== Search (stations + nominatim) ============== */
  useEffect(() => {
    if (suggestTimer.current) clearTimeout(suggestTimer.current);

    const q = placeQ.trim();
    if (!q) {
      setSuggestions([]);
      return;
    }

    suggestTimer.current = setTimeout(async () => {
      try {
        setSearchError("");

        // 1) Local station suggestions (name/address contains query)
        const qLower = q.toLowerCase();
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

        // 2) Online Nominatim suggestions (still bounded to PH)
        const viewbox = [116.0, 21.5, 127.0, 4.5];
        const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=8&viewbox=${viewbox.join(
          ","
        )}&bounded=1&q=${encodeURIComponent(q)}`;
        const res = await fetch(url, {
          headers: { Referer: "https://your-app.example/" },
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

        // Combine (stations first)
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

    // 0) Try exact / best local station match first
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
      setSearchMarker(null); // no blue pin for station
      const map = mapRef.current;
      const la = Number(localMatch.latitude),
        lo = Number(localMatch.longitude);
      if (map) map.flyTo([la, lo], 16, { duration: 0.8 });
      return;
    }

    // 1) Otherwise, fallback to Nominatim single result
    setSearchLoading(true);
    setSearchError("");
    try {
      const viewbox = [116.0, 21.5, 127.0, 4.5];
      const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1&viewbox=${viewbox.join(
        ","
      )}&bounded=1&q=${encodeURIComponent(qtxt)}`;
      const res = await fetch(url, {
        headers: { Referer: "https://your-app.example/" },
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
      setSearchMarker({ lat, lon, label: d.display_name, bbox });

      const map = mapRef.current;
      if (map && Number.isFinite(lat) && Number.isFinite(lon)) {
        map.flyTo([lat, lon], 16, { duration: 0.9 });
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
    // If user clicked a station result
    if (s.type === "station" && s.station) {
      setSuggestions([]);
      setSelectedStationId(s.station.id);
      setPlaceQ(s.station.name || "Police Station");
      setSearchMarker(null);

      const map = mapRef.current;
      const la = Number(s.station.latitude),
        lo = Number(s.station.longitude);
      if (map && Number.isFinite(la) && Number.isFinite(lo)) {
        map.flyTo([la, lo], 16, { duration: 0.8 });
      }
      return;
    }

    // Otherwise: nominatim suggestion
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
      map.flyTo([s.lat, s.lon], 16, { duration: 0.8 });
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
    if (map) map.fitBounds(PH_BOUNDS, { padding: [24, 24] });
  };

  const reverseGeocode = async (lat, lon) => {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`;
      const res = await fetch(url, {
        headers: { Referer: "https://your-app.example/" },
      });
      if (!res.ok) throw new Error("Reverse geocode failed");
      const data = await res.json();
      const label =
        data?.display_name || `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
      setSearchMarker((m) =>
        m ? { ...m, lat, lon, label } : { lat, lon, label }
      );
      setPlaceQ(label);
    } catch {
      setSearchMarker((m) => (m ? { ...m, lat, lon } : { lat, lon }));
    }
  };

  /* 🔒 Huwag mag-render content hangga’t di pa tapos auth check */
  if (!authChecked) {
    return null; // pwede ka maglagay ng loading spinner dito kung gusto mo
  }

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
  
        {/* Rank */}
        <div style={{ textAlign: "right", lineHeight: 1 }}>
          <div style={{ fontWeight: 600 }}>
            {profile.section || "—"}
          </div>
        </div>

        {/* Full Name */}
        <div style={{ textAlign: "right", lineHeight: 1 }}>
          <div style={{ fontWeight: 600 }}>
            {[profile.first_name, profile.middle_name, profile.last_name]
              .filter(Boolean)
              .join(" ") || "Unnamed"}
          </div>
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
      <div className="usermaps-container">
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
                    <Link to="/UserVictimReport">Add Report</Link>
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

        {/* MAIN CONTENT */}
        <main className={`usermaps-main ${!sidebarOpen ? "sidebar-collapsed" : ""}`}>
          {/* Header */}
          <div className="page-header">
            <h2>Community Crime Map</h2>
            <div className="page-actions">
              <button
                className="btn"
                onClick={() => {
                  setShowVictims(true);
                  setShowSuspects(true);
                  setShowStations(true);
                  setProvince("All");
                  setStatus("All");
                  setCrimeType("All");
                  setQ("");
                  setDateFrom("");
                  setDateTo("");
                  setPlaceQ("");
                  setSuggestions([]);
                  setSearchMarker(null);
                  setSelectedStationId(null);
                }}
              >
                Reset Filters
              </button>
            </div>
          </div>

          {/* Record filters */}
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
              <select
                value={province}
                onChange={(e) => setProvince(e.target.value)}
              >
                {R4A_PROVINCES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>

            <label className="filter">
              <span>Status (Victims)</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {["All", ...VICTIM_STATUSES].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="filter">
              <span>Date From</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </label>

          
          </div>

          {/* Search (stations + nominatim) */}
          <div className="filters-bar" style={{ marginTop: 8 }}>
            <label className="filter grow" style={{ position: "relative" }}>
              <span>
                Search Place (Google-Maps-like) — now searches your Stations too
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ position: "relative", flex: 1 }}>
                  <input
                    value={placeQ}
                    onChange={(e) => setPlaceQ(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") doSearch(placeQ);
                    }}
                    placeholder="e.g., RMU 4A, Cotta MARPSTA, Lucena City Hall…"
                  />
                  {/* suggestions dropdown */}
                  {suggestions.length > 0 && (
                    <div
                      style={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        top: "100%",
                        zIndex: 500,
                        background: "var(--card-bg, #fff)",
                        border: "1px solid var(--border, #e5e7eb)",
                        borderTop: "none",
                        maxHeight: 320,
                        overflowY: "auto",
                        boxShadow: "0 8px 24px rgba(0,0,0,.08)",
                      }}
                    >
                      {suggestions.map((s, idx) => (
                        <div
                          key={idx}
                          onClick={() => chooseSuggestion(s)}
                          style={{
                            padding: "8px 10px",
                            cursor: "pointer",
                            borderTop:
                              "1px solid var(--border, #e5e7eb)",
                            lineHeight: 1.2,
                            display: "flex",
                            gap: 8,
                          }}
                          onMouseDown={(e) => e.preventDefault()}
                          title={s.display_name}
                        >
                          {/* small badge: Station / Place */}
                          <span
                            style={{
                              fontSize: 10,
                              padding: "2px 6px",
                              borderRadius: 999,
                              background:
                                s.type === "station"
                                  ? "#0f766e"
                                  : "#334155",
                              color: "#fff",
                              height: 18,
                            }}
                          >
                            {s.type === "station" ? "Station" : "Place"}
                          </span>
                          <div style={{ overflow: "hidden" }}>
                            <div
                              style={{
                                fontSize: 13,
                                fontWeight: 700,
                                marginBottom: 2,
                              }}
                            >
                              {s.type === "station"
                                ? s.station?.name || s.display_name
                                : s.display_name.split(",")[0]}
                            </div>
                            <div
                              style={{
                                fontSize: 12,
                                opacity: 0.8,
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
                <button
                  className="btn"
                  onClick={() => doSearch(placeQ)}
                  title="Auto-pin the top result or select a Station"
                >
                  {searchLoading ? (
                    <FontAwesomeIcon icon={faSpinner} spin />
                  ) : (
                    <FontAwesomeIcon icon={faLocationCrosshairs} />
                  )}
                  &nbsp;Locate
                </button>
                {(searchMarker || selectedStationId) && (
                  <button
                    className="btn danger"
                    onClick={clearSearchPin}
                    title="Clear selection/pin"
                  >
                    <FontAwesomeIcon icon={faXmark} /> Clear
                  </button>
                )}
              </div>
              {searchError && (
                <div className="alert error" style={{ marginTop: 6 }}>
                  {searchError}
                </div>
              )}
            </label>
          </div>

          {/* Map */}
          <div className="map-card">
            {error && <div className="alert error">{error}</div>}
            <div className="map-wrap">
              <MapContainer
                className="map"
                center={PH_CENTER}
                zoom={6}
                maxBounds={PH_BOUNDS}
                maxBoundsViscosity={1.0}
                worldCopyJump={false}
                style={{ height: "100%", width: "100%" }}
              >
                <MapRefCatcher />

                <LayersControl position="topright">
                  {/* Base layers */}
                  <LayersControl.BaseLayer checked name="Satellite (with labels)">
                    <LayerGroup>
                      <TileLayer
                        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                        attribution="© Esri"
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
                      attribution="© OpenStreetMap contributors"
                      detectRetina
                    />
                  </LayersControl.BaseLayer>

                  {/* Victims */}
                  {showVictims && (
                    <LayersControl.Overlay checked name="Victims">
                      <LayerGroup>
                        {filteredVictims.map((v) => {
                          const la = num(v.latitude),
                            lo = num(v.longitude);
                          const st = normalizeVictimStatus(v);
                          const style =
                            st === "Unsolved"
                              ? {
                                  stroke: "#dc2626",
                                  fill: "#fecaca",
                                }
                              : st === "Solved"
                              ? {
                                  stroke: "#16a34a",
                                  fill: "#bbf7d0",
                                }
                              : {
                                  stroke: "#eab308",
                                  fill: "#fde047",
                                };
                          return (
                            <CircleMarker
                              key={`v-${v.id}`}
                              center={[la, lo]}
                              radius={9}
                              pathOptions={{
                                color: style.stroke,
                                fillColor: style.fill,
                                fillOpacity: 0.9,
                                weight: 2,
                              }}
                            >
                              <Popup>
                                <div className="u-pop">
                                  <div className="u-pop-h">
                                    Victim • {v.crime_type || "Incident"}
                                  </div>
                                  <div className="u-pop-row">
                                    {fullName(
                                      v.v_first_name,
                                      v.v_middle_name,
                                      v.v_last_name
                                    ) || "Unnamed Victim"}
                                  </div>
                                  <div className="u-pop-row">
                                    {[
                                      v.loc_barangay,
                                      v.loc_city_municipality,
                                      v.loc_province,
                                    ]
                                      .filter(Boolean)
                                      .join(", ")}
                                  </div>
                                  <div className="u-pop-row">
                                    {`${la.toFixed(5)}, ${lo.toFixed(5)}`}
                                  </div>
                                  {v.loc_kind && (
                                    <div className="u-pop-row">
                                      <em>
                                        {String(v.loc_kind).toUpperCase()}
                                        {v.loc_waterbody
                                          ? ` (${v.loc_waterbody})`
                                          : ""}
                                      </em>
                                    </div>
                                  )}
                                  {v.happened_at && (
                                    <div className="u-pop-sub">
                                      {iso(v.happened_at)}
                                    </div>
                                  )}
                                  <div className="u-pop-sub">
                                    Status: {st}
                                  </div>
                                  <Link
                                    className="u-pop-link"
                                    to={`/report/${v.id}`}
                                  >
                                    View details
                                  </Link>
                                </div>
                              </Popup>
                            </CircleMarker>
                          );
                        })}
                      </LayerGroup>
                    </LayersControl.Overlay>
                  )}

                  {/* Suspects */}
                  {showSuspects && (
                    <LayersControl.Overlay checked name="Suspects">
                      <LayerGroup>
                        {filteredSuspects.map((s) => {
                          const la = num(s.latitude),
                            lo = num(s.longitude);
                          return (
                            <Marker
                              key={`s-${s.id}`}
                              position={[la, lo]}
                              icon={starIcon}
                            >
                              <Popup>
                                <div className="u-pop">
                                  <div className="u-pop-h">
                                    Suspect • {s.s_crime_type || "Incident"}
                                  </div>
                                  <div className="u-pop-row">
                                    {fullName(
                                      s.s_first_name,
                                      s.s_middle_name,
                                      s.s_last_name
                                    ) || "Unnamed Suspect"}
                                  </div>
                                  <div className="u-pop-row">
                                    {[
                                      s.loc_barangay,
                                      s.loc_city_municipality,
                                      s.loc_province,
                                    ]
                                      .filter(Boolean)
                                      .join(", ")}
                                  </div>
                                  <div className="u-pop-row">
                                    {`${la.toFixed(5)}, ${lo.toFixed(5)}`}
                                  </div>
                                  {s.loc_kind && (
                                    <div className="u-pop-row">
                                      <em>
                                        {String(s.loc_kind).toUpperCase()}
                                        {s.loc_waterbody
                                          ? ` (${s.loc_waterbody})`
                                          : ""}
                                      </em>
                                    </div>
                                  )}
                                  {s.created_at && (
                                    <div className="u-pop-sub">
                                      {iso(s.created_at)}
                                    </div>
                                  )}
                                  <Link
                                    className="u-pop-link"
                                    to={`/suspect/${s.id}`}
                                  >
                                    View details
                                  </Link>
                                </div>
                              </Popup>
                            </Marker>
                          );
                        })}
                      </LayerGroup>
                    </LayersControl.Overlay>
                  )}

                  {/* Stations */}
                  {showStations && (
                    <LayersControl.Overlay
                      checked
                      name="Police Stations (tap to zoom)"
                    >
                      <LayerGroup>
                        {stations.map((st) => (
                          <StationMarker
                            key={st.id ?? `${st.latitude}-${st.longitude}`}
                            s={st}
                            selectedStationId={selectedStationId}
                            onDeselect={() => setSelectedStationId(null)}
                          />
                        ))}
                      </LayerGroup>
                    </LayersControl.Overlay>
                  )}

                  {/* Search pin */}
                  {searchMarker && (
                    <LayersControl.Overlay checked name="Search Pin">
                      <LayerGroup>
                        <Marker
                          position={[searchMarker.lat, searchMarker.lon]}
                          icon={searchIcon}
                          draggable
                          eventHandlers={{
                            dragend: (e) => {
                              const m = e.target.getLatLng();
                              const lat = Number(m.lat),
                                lon = Number(m.lng);
                              if (
                                !Number.isFinite(lat) ||
                                !Number.isFinite(lon)
                              )
                                return;
                              reverseGeocode(lat, lon);
                            },
                          }}
                        >
                          <Popup>
                            <div className="u-pop">
                              <div className="u-pop-h">Selected place</div>
                              <div
                                className="u-pop-row"
                                style={{ maxWidth: 260 }}
                              >
                                {searchMarker.label || "Unnamed"}
                              </div>
                              <div className="u-pop-row">
                                {`${searchMarker.lat.toFixed(
                                  5
                                )}, ${searchMarker.lon.toFixed(5)}`}
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
            </div>
          </div>

    
        </main>
      </div>
    </div>
  );
}
