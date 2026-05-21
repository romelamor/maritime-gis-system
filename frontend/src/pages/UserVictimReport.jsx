// src/pages/UserVictimReport.jsx
import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faHome,
  faUser,
  faFileInvoice,
  faMapLocation,
  faRightFromBracket,
  faSave,
} from "@fortawesome/free-solid-svg-icons";

import "../assets/css/AdminCrime.css";


import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";

/* ===== Leaflet default marker fix (Vite/React) ===== */
const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

/* ================= CONFIG ================= */
const API_BASE = (import.meta.env.VITE_API_BASE || "http://localhost:8000").replace(
  /\/$/,
  ""
);

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

/* Region IV-A bounds (approx) */
const REGION4A_BOUNDS = L.latLngBounds(L.latLng(13.0, 120.2), L.latLng(15.5, 122.5));
const REGION4A_CENTER = REGION4A_BOUNDS.getCenter();

/**
 * ✅ Offline fallback centers (NO API)
 * Used only when geocode fails or not enough info.
 */
const OFFLINE_CENTERS = {
  // Provinces
  CAVITE: { lat: 14.279, lng: 120.8686 },
  LAGUNA: { lat: 14.15, lng: 121.3 },
  BATANGAS: { lat: 13.7565, lng: 121.0583 },
  RIZAL: { lat: 14.6037, lng: 121.3133 },
  QUEZON: { lat: 13.938, lng: 122.108 },

  // Cities/Municipalities (add more as needed)
  "GENERAL NAKAR": { lat: 14.766, lng: 121.636 },
  INFANTA: { lat: 14.743, lng: 121.649 },
  REAL: { lat: 14.663, lng: 121.604 },
  LUCENA: { lat: 13.9414, lng: 121.6226 },
  TAYABAS: { lat: 14.0253, lng: 121.591 },
  CALAUAG: { lat: 13.954, lng: 122.289 },

  CALAMBA: { lat: 14.2117, lng: 121.1651 },
  "SAN PABLO": { lat: 14.0683, lng: 121.3256 },
  "STA. ROSA": { lat: 14.3122, lng: 121.1114 },
  "SANTA ROSA": { lat: 14.3122, lng: 121.1114 },

  TAGAYTAY: { lat: 14.1153, lng: 120.9621 },
  "DASMARIÑAS": { lat: 14.3294, lng: 120.9367 },
  DASMARINAS: { lat: 14.3294, lng: 120.9367 },
  IMUS: { lat: 14.4297, lng: 120.9367 },
  BACOOR: { lat: 14.4624, lng: 120.9645 },

  "BATANGAS CITY": { lat: 13.7565, lng: 121.0583 },
  NASUGBU: { lat: 14.073, lng: 120.633 },
  LIPA: { lat: 13.941, lng: 121.163 },

  ANTIPOLO: { lat: 14.6255, lng: 121.1222 },
  TAYTAY: { lat: 14.5676, lng: 121.1325 },
};

/* crime types */
const crimeTypes = [
  // PIRACY
  { value: "Piracy", label: "Piracy (RPC Art. 122 / PD 532)" },
  { value: "Qualified Piracy", label: "Qualified Piracy (RPC Art. 123 / RA 7659)" },

  // SMUGGLING
  { value: "Smuggling", label: "Smuggling (RA 10863)" },

  // ILLEGAL FISHING
  { value: "Illegal Fishing", label: "Illegal Fishing (RA 8550 / RA 10654)" },
  { value: "Dynamite Fishing", label: "Dynamite Fishing (RA 8550)" },
  { value: "Cyanide Fishing", label: "Cyanide Fishing (RA 8550)" },
  { value: "Foreign Poaching", label: "Foreign Poaching (RA 8550)" },

  // ENVIRONMENTAL
  { value: "Marine Pollution", label: "Marine Pollution / Oil Spill (PD 979 / RA 9275)" },
  { value: "Illegal Dumping", label: "Illegal Waste Dumping (RA 9003)" },
  { value: "Wildlife Trafficking", label: "Marine Wildlife Trafficking (RA 9147)" },

  // DRUGS
  { value: "Drug Trafficking", label: "Drug Trafficking via Sea (RA 9165)" },

  // HUMAN TRAFFICKING
  { value: "Human Trafficking", label: "Human Trafficking (RA 9208 / RA 10364)" },

  // FIREARMS
  { value: "Illegal Firearms", label: "Illegal Possession of Firearms (RA 10591)" },

  // TERRITORIAL
  { value: "Unauthorized Entry", label: "Unauthorized Foreign Vessel Entry (RA 12064)" },

  // SAFETY
  { value: "Overloading", label: "Overloading Vessel (RA 9993)" },
  { value: "No Safety Equipment", label: "No Safety Equipment (RA 9993)" },
  { value: "Unregistered Vessel", label: "Unregistered Vessel (MARINA Laws)" },

  // VESSEL CRIMES
  { value: "Ship Hijacking", label: "Ship Hijacking / Vessel Seizure" },
  { value: "Vessel Theft", label: "Vessel Theft" },

  // VIOLENCE
  { value: "Kidnapping", label: "Kidnapping at Sea (RPC)" },
  { value: "Murder", label: "Murder / Homicide at Sea (RPC)" },

  // OTHER INCIDENTS
  { value: "Missing Fisherman", label: "Missing Fisherman / SAR Incident" },
  { value: "Maritime Accident", label: "Maritime Accident / Collision" },

  // FALLBACK
  { value: "Others", label: "Others (Specify)" },
];

/* ------------ Error Boundary ------------ */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err, info) {
    console.error("ErrorBoundary caught:", err, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 16 }}>
          <h3>Something went wrong.</h3>
          <p style={{ color: "#6b7280" }}>
            Please reload the page. If it happens again, check console/network logs.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ================= PSGC Address Picker ================= */
function PhAddressPicker({
  label,
  value,
  onChange,
  withAddressLine,
  requiredFields = true,
  restrictToRegion4A = false,
}) {
  const [regions, setRegions] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [cityMuns, setCityMuns] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [fallback, setFallback] = useState(false);
  const [psgcError, setPsgcError] = useState("");

  const buildPsgc = (loc) => {
    const parts = [];
    if (loc.barangayName) parts.push(loc.barangayName);
    if (loc.cityMunName) parts.push(loc.cityMunName);
    if (loc.provinceName) parts.push(loc.provinceName);
    if (loc.regionName) parts.push(loc.regionName);
    return parts.join(", ");
  };

  const composeWhenBarangay = (next) => {
    const psgc = buildPsgc(next);
    const user = (next.addressLineUser || "").trim();
    let full = "";
    if (user && psgc) full = `${user}, ${psgc}`;
    else if (user) full = user;
    else full = psgc;
    return { addressLine: full, addressLineUser: user, psgc };
  };

  const updateAndCompose = (next) => {
    const composed = composeWhenBarangay(next);
    onChange({
      ...next,
      addressLine: composed.addressLine,
      addressLineUser: composed.addressLineUser,
      psgc: composed.psgc,
    });
  };

  const onUserAddressLineChange = (txt) => updateAndCompose({ ...value, addressLineUser: txt });

  const setRegion = (code) => {
    const r = regions.find((x) => x.code === code);
    updateAndCompose({
      ...value,
      regionCode: code,
      regionName: r?.name || "",
      provinceCode: "",
      provinceName: "",
      cityMunCode: "",
      cityMunName: "",
      cityMunKind: "",
      barangayCode: "",
      barangayName: "",
    });
  };

  const setProvince = (code) => {
    const p = provinces.find((x) => x.code === code);
    updateAndCompose({
      ...value,
      provinceCode: code,
      provinceName: p?.name || "",
      cityMunCode: "",
      cityMunName: "",
      cityMunKind: "",
      barangayCode: "",
      barangayName: "",
    });
  };

  const setCityMun = (code) => {
    const cm = cityMuns.find((x) => x.code === code);
    const kind = (cm?.type || "").toLowerCase().includes("city") ? "city" : "municipality";
    updateAndCompose({
      ...value,
      cityMunCode: code,
      cityMunName: cm?.name || "",
      cityMunKind: kind,
      barangayCode: "",
      barangayName: "",
    });
  };

  const setBarangay = (code) => {
    const b = barangays.find((x) => x.code === code);
    updateAndCompose({
      ...value,
      barangayCode: code,
      barangayName: b?.name || "",
    });
  };

  /* Load regions */
  useEffect(() => {
    if (fallback) return;
    (async () => {
      try {
        const res = await fetch("https://psgc.cloud/api/regions");
        if (!res.ok) {
          setFallback(true);
          setPsgcError(`PSGC unavailable (status ${res.status}). Manual typing enabled.`);
          return;
        }
        let list = await res.json();
        list = Array.isArray(list) ? list : [];

        if (restrictToRegion4A) {
          list = list.filter((r) => {
            const n = (r.name || "").toUpperCase();
            return n.includes("IV-A") || n.includes("CALABARZON");
          });
        }

        setRegions(list);

        // auto-select Region IV-A if only one
        if (restrictToRegion4A && !value.regionCode && list.length === 1) {
          const r = list[0];
          updateAndCompose({
            ...value,
            regionCode: r.code,
            regionName: r.name || "",
            provinceCode: "",
            provinceName: "",
            cityMunCode: "",
            cityMunName: "",
            cityMunKind: "",
            barangayCode: "",
            barangayName: "",
          });
        }
      } catch (e) {
        console.error(e);
        setFallback(true);
        setPsgcError("PSGC network error. Manual typing enabled.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restrictToRegion4A]);

  /* Load provinces */
  useEffect(() => {
    if (fallback) return;
    (async () => {
      if (!value.regionCode) {
        setProvinces([]);
        setCityMuns([]);
        setBarangays([]);
        return;
      }
      try {
        const res = await fetch(`https://psgc.cloud/api/regions/${value.regionCode}/provinces`);
        if (!res.ok) return;
        const d = await res.json();
        setProvinces(Array.isArray(d) ? d : []);
        setCityMuns([]);
        setBarangays([]);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [value.regionCode, fallback]);

  /* Load cities/municipalities */
  useEffect(() => {
    if (fallback) return;
    (async () => {
      if (!value.provinceCode) {
        setCityMuns([]);
        setBarangays([]);
        return;
      }
      try {
        const res = await fetch(
          `https://psgc.cloud/api/provinces/${value.provinceCode}/cities-municipalities`
        );
        if (!res.ok) return;
        const d = await res.json();
        setCityMuns(Array.isArray(d) ? d : []);
        setBarangays([]);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [value.provinceCode, fallback]);

  /* Load barangays */
  useEffect(() => {
    if (fallback) return;
    (async () => {
      if (!value.cityMunCode) {
        setBarangays([]);
        return;
      }
      try {
        const cm = cityMuns.find((x) => x.code === value.cityMunCode);
        const isCity = (cm?.type || "").toLowerCase().includes("city");
        const url = isCity
          ? `https://psgc.cloud/api/cities/${value.cityMunCode}/barangays`
          : `https://psgc.cloud/api/municipalities/${value.cityMunCode}/barangays`;

        const res = await fetch(url);
        if (!res.ok) return;
        const d = await res.json();
        setBarangays(Array.isArray(d) ? d : []);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [value.cityMunCode, cityMuns, fallback]);

  /* Fallback manual typing */
  if (fallback) {
    return (
      <div className="section">
        <h3>{label}</h3>
        {withAddressLine && (
          <div className="input-group">
            <label>
              Lot / Street {requiredFields && <span className="required">*</span>}
            </label>
            <input
              value={value.addressLineUser ?? ""}
              onChange={(e) => onUserAddressLineChange(e.target.value)}
              placeholder="House/Block/Lot, Building, Street"
              required={requiredFields}
            />
          </div>
        )}

        <div className="grid">
          <div className="input-group">
            <label>Region</label>
            <input
              value={value.regionName || ""}
              onChange={(e) => updateAndCompose({ ...value, regionName: e.target.value })}
              placeholder="e.g., Region IV-A (CALABARZON)"
            />
          </div>
          <div className="input-group">
            <label>Province</label>
            <input
              value={value.provinceName || ""}
              onChange={(e) => updateAndCompose({ ...value, provinceName: e.target.value })}
              placeholder="e.g., Quezon"
            />
          </div>
          <div className="input-group">
            <label>City / Municipality</label>
            <input
              value={value.cityMunName || ""}
              onChange={(e) => updateAndCompose({ ...value, cityMunName: e.target.value })}
              placeholder="e.g., General Nakar"
            />
          </div>
          <div className="input-group">
            <label>Barangay</label>
            <input
              value={value.barangayName || ""}
              onChange={(e) => updateAndCompose({ ...value, barangayName: e.target.value })}
              placeholder="e.g., Mahabang Lalim"
            />
          </div>
        </div>

        {psgcError && <small style={{ color: "#b91c1c" }}>{psgcError}</small>}
      </div>
    );
  }

  return (
    <div className="section">
      <h3>{label}</h3>

      {withAddressLine && (
        <div className="input-group">
          <label>
            Lot / Street {requiredFields && <span className="required">*</span>}
          </label>
          <input
            value={value.addressLineUser ?? ""}
            onChange={(e) => onUserAddressLineChange(e.target.value)}
            placeholder="House/Block/Lot, Building, Street"
            required={requiredFields}
          />
          <small style={{ color: "#6b7280" }}>
            {value.addressLine
              ? `Full location: ${value.addressLine}`
              : "Full location will appear after Barangay is selected."}
          </small>
        </div>
      )}

      <div className="grid">
        <div className="input-group">
          <label>Region</label>
          <select
            value={value.regionCode || ""}
            onChange={(e) => setRegion(e.target.value)}
            required={requiredFields}
            disabled={restrictToRegion4A}
          >
            <option value="">Select Region</option>
            {regions.map((r) => (
              <option key={r.code} value={r.code}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        <div className="input-group">
          <label>Province</label>
          <select
            value={value.provinceCode || ""}
            onChange={(e) => setProvince(e.target.value)}
            disabled={!value.regionCode}
            required={requiredFields}
          >
            <option value="">Select Province</option>
            {provinces.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="input-group">
          <label>City / Municipality</label>
          <select
            value={value.cityMunCode || ""}
            onChange={(e) => setCityMun(e.target.value)}
            disabled={!value.provinceCode}
            required={requiredFields}
          >
            <option value="">Select City/Municipality</option>
            {cityMuns.map((cm) => {
              const kind = (cm.type || "").toLowerCase().includes("city") ? "City" : "Municipality";
              return (
                <option key={cm.code} value={cm.code}>
                  {cm.name} ({kind})
                </option>
              );
            })}
          </select>
        </div>

        <div className="input-group">
          <label>Barangay</label>
          <select
            value={value.barangayCode || ""}
            onChange={(e) => setBarangay(e.target.value)}
            disabled={!value.cityMunCode}
            required={requiredFields}
          >
            <option value="">Select Barangay</option>
            {barangays.map((b) => (
              <option key={b.code} value={b.code}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {psgcError && <small style={{ color: "#b91c1c" }}>{psgcError}</small>}
    </div>
  );
}

/* ============ Leaflet Helpers ============ */
function KeepMapInRegion4A() {
  const map = useMap();
  useEffect(() => {
    map.setMaxBounds(REGION4A_BOUNDS);
    const onDrag = () => map.panInsideBounds(REGION4A_BOUNDS, { animate: false });
    map.on("drag", onDrag);
    return () => map.off("drag", onDrag);
  }, [map]);
  return null;
}

function clampToRegion4A(lat, lng) {
  const ll = L.latLng(lat, lng);
  if (REGION4A_BOUNDS.contains(ll)) return ll;
  const sw = REGION4A_BOUNDS.getSouthWest();
  const ne = REGION4A_BOUNDS.getNorthEast();
  const clampedLat = Math.min(Math.max(lat, sw.lat), ne.lat);
  const clampedLng = Math.min(Math.max(lng, sw.lng), ne.lng);
  return L.latLng(clampedLat, clampedLng);
}

/* ===== GEOCODING (for 100% follow on barangay/city/province dropdown) ===== */
function buildGeocodeQuery(locAddr) {
  const parts = [];

  const userLine = (locAddr?.addressLineUser || "").trim();
  const brgy = (locAddr?.barangayName || "").trim();
  const city = (locAddr?.cityMunName || "").trim();
  const prov = (locAddr?.provinceName || "").trim();

  // Priority: include more info = more accurate
  if (userLine) parts.push(userLine);
  if (brgy) parts.push(brgy);
  if (city) parts.push(city);
  if (prov) parts.push(prov);

  // force Region IV-A context
  parts.push("CALABARZON");
  parts.push("Philippines");

  return parts.filter(Boolean).join(", ");
}

async function geocodeViaBackendProxy(q, signal) {
  // expected backend proxy: /api/utils/nominatim/search/?q=...&format=json&limit=1
  const url = `${API_BASE}/api/utils/nominatim/search/?format=json&limit=1&q=${encodeURIComponent(q)}`;

  const res = await fetch(url, {
    method: "GET",
    headers: { ...authHeader() },
    signal,
  });

  if (!res.ok) throw new Error(`proxy geocode non-OK: ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data) || !data[0]) return null;

  const lat = Number(data[0].lat);
  const lng = Number(data[0].lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, display: data[0].display_name || "" };
}

async function geocodeDirectNominatim(q, signal) {
  // NOTE: direct nominatim can rate-limit/403; proxy is preferred.
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    signal,
  });

  if (!res.ok) throw new Error(`direct geocode non-OK: ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data) || !data[0]) return null;

  const lat = Number(data[0].lat);
  const lng = Number(data[0].lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, display: data[0].display_name || "" };
}

/**
 * ✅ SMART auto-pinpoint:
 * - Province/City/Barangay dropdown -> marker moves automatically
 * - If barangay (or city) selected -> geocode full PSGC address (best accuracy)
 * - If geocode fails -> fallback to offline centers
 */
function useSmartAutoPinpoint({ locAddr, setLatLng, setGeoMsg }) {
  const lastKeyRef = useRef("");
  const abortRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    const province = (locAddr?.provinceName || "").trim().toUpperCase();
    const city = (locAddr?.cityMunName || "").trim().toUpperCase();
    const brgy = (locAddr?.barangayName || "").trim();
    const region = (locAddr?.regionName || "").trim();

    const key = `${region}|${province}|${city}|${brgy}|${(locAddr?.addressLineUser || "").trim()}`;
    if (!province && !city && !brgy && !region) return;
    if (key === lastKeyRef.current) return;

    // cancel previous pending
    if (abortRef.current) abortRef.current.abort();
    if (timerRef.current) clearTimeout(timerRef.current);

    // Debounce (avoid spamming requests habang nagta-type / mabilis mag click)
    timerRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;

      const needGeocode = !!(brgy || city); // barangay/city needs precise
      const q = buildGeocodeQuery(locAddr);

      try {
        if (needGeocode) {
          setGeoMsg("⏳ Pinpointing selected location…");

          // 1) try backend proxy first
          let hit = null;
          try {
            hit = await geocodeViaBackendProxy(q, controller.signal);
          } catch (e) {
            // fallback to direct nominatim if proxy not available
            hit = await geocodeDirectNominatim(q, controller.signal);
          }

          if (hit) {
            const inside = clampToRegion4A(hit.lat, hit.lng);
            setLatLng(inside.lat, inside.lng);

            if (brgy) {
              setGeoMsg("✅ Auto-pinpointed to selected barangay (geocoded). Drag marker if you need micro-adjust.");
            } else {
              setGeoMsg("✅ Auto-pinpointed to selected city/municipality (geocoded). Drag marker if needed.");
            }

            lastKeyRef.current = key;
            return;
          }
        }

        // --- fallback offline centers ---
        const offlineHit =
          (city && OFFLINE_CENTERS[city]) ||
          (province && OFFLINE_CENTERS[province]) ||
          { lat: REGION4A_CENTER.lat, lng: REGION4A_CENTER.lng };

        const inside = clampToRegion4A(offlineHit.lat, offlineHit.lng);
        setLatLng(inside.lat, inside.lng);

        if (brgy) {
          setGeoMsg("⚠️ Geocode failed. Centered near selected city/province. Drag marker for exact barangay pinpoint.");
        } else if (city) {
          setGeoMsg("✅ Auto-centered to selected city/municipality (offline center). Drag marker if needed.");
        } else {
          setGeoMsg("✅ Auto-centered to selected province (offline center). Drag marker if needed.");
        }

        lastKeyRef.current = key;
      } catch (err) {
        if (String(err?.name) === "AbortError") return;
        console.error("auto pinpoint error:", err);

        // last-resort fallback
        const inside = clampToRegion4A(REGION4A_CENTER.lat, REGION4A_CENTER.lng);
        setLatLng(inside.lat, inside.lng);
        setGeoMsg("⚠️ Pinpoint error. Centered to Region IV-A. Please drag marker to set exact location.");
        lastKeyRef.current = key;
      }
    }, 350);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    locAddr?.regionName,
    locAddr?.provinceName,
    locAddr?.cityMunName,
    locAddr?.barangayName,
    locAddr?.addressLineUser,
  ]);
}

/**
 * ✅ Map picker:
 * - Click map → set marker + set lat/lng
 * - Drag marker → set lat/lng
 */
function MiniPickerMap({ lat, lng, onChange }) {
  const has = Number.isFinite(lat) && Number.isFinite(lng);
  const initial = has ? [lat, lng] : [REGION4A_CENTER.lat, REGION4A_CENTER.lng];

  const [pos, setPos] = useState(initial);

  useEffect(() => {
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      const ll = clampToRegion4A(lat, lng);
      setPos([ll.lat, ll.lng]);
    }
  }, [lat, lng]);

  function DraggableMarker() {
    const markerRef = React.useRef(null);

    useMapEvents({
      click(e) {
        let { lat, lng } = e.latlng;
        const ll = clampToRegion4A(lat, lng);
        lat = ll.lat;
        lng = ll.lng;
        setPos([lat, lng]);
        onChange?.({ lat, lng });
      },
    });

    return (
      <Marker
        draggable
        ref={markerRef}
        position={pos}
        eventHandlers={{
          dragend() {
            const m = markerRef.current;
            if (!m) return;
            const ll = m.getLatLng();
            const inside = clampToRegion4A(ll.lat, ll.lng);
            m.setLatLng(inside);
            setPos([inside.lat, inside.lng]);
            onChange?.({ lat: inside.lat, lng: inside.lng });
          },
        }}
      />
    );
  }

  return (
    <div style={{ border: "1px solid #eee", borderRadius: 8, overflow: "hidden" }}>
      <MapContainer
        style={{ height: 320, width: "100%" }}
        center={pos}
        zoom={has ? 16 : 10}
        scrollWheelZoom
        maxBounds={REGION4A_BOUNDS}
        maxBoundsViscosity={1.0}
        worldCopyJump={false}
      >
        <KeepMapInRegion4A />
        <TileLayer
          noWrap
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <DraggableMarker />
      </MapContainer>
    </div>
  );
}

/* ===== helpers ===== */
const composeFullAddress = (a) => a?.addressLine || a?.addressLineUser || "";

function generateLocalBlotter(regionCode = "", stationCode = "") {
  const now = new Date();
  const y = String(now.getFullYear());
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 100000).toString().padStart(5, "0");
  const tag = ["R4A", regionCode || null, stationCode || null].filter(Boolean).join("-");
  return `${tag}-${y}${m}${d}-${hh}${mm}${ss}-${rand}`.toUpperCase();
}

function computeAgeFromBirthdate(birthdateStr) {
  if (!birthdateStr) return "";
  const b = new Date(birthdateStr);
  if (Number.isNaN(b.getTime())) return "";
  const today = new Date();
  let age = today.getFullYear() - b.getFullYear();
  const mo = today.getMonth() - b.getMonth();
  if (mo < 0 || (mo === 0 && today.getDate() < b.getDate())) age--;
  return age >= 0 ? String(age) : "";
}

/* ================= Main ================= */
export default function UserVictimReport() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [submenuOpen, setSubmenuOpen] = useState(true);
  const navigate = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);
  const [profile, setProfile] = useState({
    first_name: "",
    middle_name: "",
    last_name: "",
    section: "",
  });

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("access_token");
    localStorage.removeItem("access");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("refresh");
    navigate("/Userlogin", { replace: true });
  };

  useEffect(() => {
    const hasToken =
      localStorage.getItem("token") ||
      localStorage.getItem("access_token") ||
      localStorage.getItem("access");
    if (!hasToken) navigate("/Userlogin", { replace: true });
    else setAuthChecked(true);
  }, [navigate]);
  useEffect(() => {
    if (!authChecked) return;

    (async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/personnel/me/`, {
          headers: authHeader(),
        });

        setProfile(res.data || {});
      } catch (err) {
        console.error("Failed to load profile", err);
      }
    })();
  }, [authChecked]);

  const blankAddr = {
    addressLineUser: "",
    addressLine: "",
    psgc: "",
    regionCode: "",
    regionName: "",
    provinceCode: "",
    provinceName: "",
    cityMunCode: "",
    cityMunName: "",
    cityMunKind: "",
    barangayCode: "",
    barangayName: "",
  };

  const blank = {
    // Reporting Person
    rp_birthdate: "",
    rp_first_name: "",
    rp_middle_name: "",
    rp_last_name: "",
    rp_citizenship: "",
    rp_sex: "",
    rp_age: "",
    rp_place_of_birth: "",
    rp_occupation: "",
    rp_email: "",
    rp_addr: { ...blankAddr },

    // Victim + Crime core
    blotter_number: "",
    crime_type: "",
    description: "",
    happened_at: "",

    v_first_name: "",
    v_middle_name: "",
    v_last_name: "",
    v_age: "",
    v_sex: "",
    v_citizenship: "",
    v_birthdate: "",
    v_place_of_birth: "",
    v_occupation: "",
    v_addr: { ...blankAddr },
    v_photo_file: null,
    v_photo_preview: "",

    // Crime location
    loc_addr: { ...blankAddr },
    latitude: "",
    longitude: "",
    loc_kind: "",
    loc_waterbody: "",

    // Suspect
    s_first_name: "",
    s_middle_name: "",
    s_last_name: "",
    s_age: "",
    s_crime_type: "",
    s_addr: { ...blankAddr },
    s_photo_file: null,
    s_photo_preview: "",
  };

  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [sameReporterVictim, setSameReporterVictim] = useState(false);

  // ✅ auto pinpoint status
  const [geoMsg, setGeoMsg] = useState("");

  const setReportAddr = (next) => setForm((p) => ({ ...p, rp_addr: next }));
  const setVictimAddr = (next) => setForm((p) => ({ ...p, v_addr: next }));

  const setLocAddr = (next) => {
    setForm((p) => ({ ...p, loc_addr: next }));
    setGeoMsg("");
  };

  const setSuspectAddr = (next) => setForm((p) => ({ ...p, s_addr: next }));

  // ✅ setter for lat/lng
  const setLatLng = (lat, lng) => {
    const inside = clampToRegion4A(Number(lat), Number(lng));
    setForm((p) => ({
      ...p,
      latitude: String(inside.lat),
      longitude: String(inside.lng),
    }));
  };

  // ✅ SMART AUTO PINPOINT (province/city/barangay -> marker follows)
  useSmartAutoPinpoint({
    locAddr: form.loc_addr,
    setLatLng,
    setGeoMsg,
  });

  const onPickVictimPhoto = (e) => {
    const file = e.target.files?.[0] || null;
    if (!file) {
      setForm((p) => ({ ...p, v_photo_file: null, v_photo_preview: "" }));
      return;
    }
    const url = URL.createObjectURL(file);
    setForm((p) => ({ ...p, v_photo_file: file, v_photo_preview: url }));
  };

  const onPickSuspectPhoto = (e) => {
    const file = e.target.files?.[0] || null;
    if (!file) {
      setForm((p) => ({ ...p, s_photo_file: null, s_photo_preview: "" }));
      return;
    }
    const url = URL.createObjectURL(file);
    setForm((p) => ({ ...p, s_photo_file: file, s_photo_preview: url }));
  };

  const appendAddr = (fd, prefix, a) => {
    fd.append(`${prefix}_address`, a.addressLine || "");
    fd.append(`${prefix}_region`, a.regionName || "");
    fd.append(`${prefix}_province`, a.provinceName || "");
    fd.append(`${prefix}_city_municipality`, a.cityMunName || "");
    fd.append(`${prefix}_city_mun_kind`, a.cityMunKind || "");
    fd.append(`${prefix}_barangay`, a.barangayName || "");
    fd.append(`${prefix}_region_code`, a.regionCode || "");
    fd.append(`${prefix}_province_code`, a.provinceCode || "");
    fd.append(`${prefix}_city_mun_code`, a.cityMunCode || "");
    fd.append(`${prefix}_barangay_code`, a.barangayCode || "");
  };

  /* same person checkbox */
  useEffect(() => {
    if (!sameReporterVictim) return;

    setForm((prev) => ({
      ...prev,
      v_first_name: prev.rp_first_name,
      v_middle_name: prev.rp_middle_name,
      v_last_name: prev.rp_last_name,
      v_citizenship: prev.rp_citizenship,
      v_sex: prev.rp_sex,
      v_place_of_birth: prev.rp_place_of_birth,
      v_occupation: prev.rp_occupation,
      v_addr: { ...prev.v_addr, ...prev.rp_addr },
      v_birthdate: prev.rp_birthdate,
      v_age: prev.rp_age,
    }));
  }, [
    sameReporterVictim,
    form.rp_first_name,
    form.rp_middle_name,
    form.rp_last_name,
    form.rp_citizenship,
    form.rp_sex,
    form.rp_place_of_birth,
    form.rp_occupation,
    form.rp_addr,
  ]);

  const SexRadio = ({ name, value, onChange }) => (
    <div className="radio-group">
      <label className="radio">
        <input
          type="radio"
          name={name}
          value="Male"
          checked={value === "Male"}
          onChange={(e) => onChange(e.target.value)}
        />
        <span>Male</span>
      </label>
      <label className="radio">
        <input
          type="radio"
          name={name}
          value="Female"
          checked={value === "Female"}
          onChange={(e) => onChange(e.target.value)}
        />
        <span>Female</span>
      </label>
      <label className="radio">
        <input
          type="radio"
          name={name}
          value="Other"
          checked={value === "Other"}
          onChange={(e) => onChange(e.target.value)}
        />
        <span>Other</span>
      </label>
    </div>
  );

  const hasSuspectData = () => {
    const s = form;
    return (
      (s.s_first_name && s.s_first_name.trim() !== "") ||
      (s.s_last_name && s.s_last_name.trim() !== "") ||
      (s.s_crime_type && s.s_crime_type.trim() !== "") ||
      (s.s_age && String(s.s_age).trim() !== "") ||
      (s.s_addr && (s.s_addr.addressLineUser || s.s_addr.addressLine)) ||
      !!s.s_photo_file
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setMessage("");

    try {
      const fd = new FormData();

      // Reporting person
      fd.append("rp_birthdate", form.rp_birthdate || "");
      fd.append("rp_first_name", form.rp_first_name || "");
      fd.append("rp_middle_name", form.rp_middle_name || "");
      fd.append("rp_last_name", form.rp_last_name || "");
      fd.append("rp_citizenship", form.rp_citizenship || "");
      fd.append("rp_sex", form.rp_sex || "");
      fd.append("rp_age", form.rp_age || "");
      fd.append("rp_place_of_birth", form.rp_place_of_birth || "");
      fd.append("rp_occupation", form.rp_occupation || "");
      fd.append("rp_email", form.rp_email || "");
      fd.append("rp_address", composeFullAddress(form.rp_addr));

      // Crime/victim
      fd.append("blotter_number", form.blotter_number || "");
      fd.append("crime_type", form.crime_type || "");
      fd.append("description", form.description || "");
      fd.append("happened_at", form.happened_at || "");

      const ageFromBirthdate = computeAgeFromBirthdate(form.v_birthdate);
      fd.append("v_first_name", form.v_first_name || "");
      fd.append("v_middle_name", form.v_middle_name || "");
      fd.append("v_last_name", form.v_last_name || "");
      fd.append("v_age", ageFromBirthdate || form.v_age || "");
      fd.append("v_sex", form.v_sex || "");
      fd.append("v_citizenship", form.v_citizenship || "");
      fd.append("v_birthdate", form.v_birthdate || "");
      fd.append("v_place_of_birth", form.v_place_of_birth || "");
      fd.append("v_occupation", form.v_occupation || "");
      if (form.v_photo_file) fd.append("v_photo", form.v_photo_file);

      appendAddr(fd, "v", form.v_addr);
      appendAddr(fd, "loc", form.loc_addr);

      fd.append("latitude", form.latitude || "");
      fd.append("longitude", form.longitude || "");
      fd.append("loc_kind", form.loc_kind || "");
      fd.append("loc_waterbody", form.loc_waterbody || "");
      fd.append("status", "Ongoing");

      const resCrime = await axios.post(`${API_BASE}/api/crimes/`, fd, {
        headers: { ...authHeader(), "Content-Type": "multipart/form-data" },
        validateStatus: () => true,
      });

      if (resCrime.status === 401) {
        setMessage("Session expired. Please login again.");
        logout();
        return;
      }
      if (resCrime.status < 200 || resCrime.status >= 300) {
        console.error("crime save error:", resCrime.data);
        setMessage("Save failed. Please check required fields.");
        return;
      }

      const createdCrimeId = resCrime?.data?.id;

      // Suspect optional
      if (createdCrimeId && hasSuspectData()) {
        const fdSus = new FormData();
        fdSus.append("crime_report", createdCrimeId);

        fdSus.append("s_first_name", form.s_first_name || "");
        fdSus.append("s_middle_name", form.s_middle_name || "");
        fdSus.append("s_last_name", form.s_last_name || "");
        fdSus.append("s_age", form.s_age || "");
        fdSus.append("s_crime_type", form.s_crime_type || "");

        appendAddr(fdSus, "s", form.s_addr);
        appendAddr(fdSus, "loc", form.loc_addr);

        fdSus.append("latitude", form.latitude || "");
        fdSus.append("longitude", form.longitude || "");
        fdSus.append("loc_kind", form.loc_kind || "");
        fdSus.append("loc_waterbody", form.loc_waterbody || "");

        if (form.s_photo_file) fdSus.append("s_photo", form.s_photo_file);

        const resSus = await axios.post(`${API_BASE}/api/suspects/`, fdSus, {
          headers: { ...authHeader(), "Content-Type": "multipart/form-data" },
          validateStatus: () => true,
        });

        if (resSus.status === 401) {
          setMessage("Session expired. Please login again.");
          logout();
          return;
        }
        if (resSus.status < 200 || resSus.status >= 300) {
          console.error("suspect save error:", resSus.data);
          setMessage("Crime saved, but suspect save failed.");
          return;
        }
      }

      setMessage("✅ Report submitted successfully.");
      setForm(blank);
      setSameReporterVictim(false);
      navigate("/UserViewReport");
    } catch (err) {
      console.error("submit error", err?.response?.data || err.message);
      setMessage("Save failed. Try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!authChecked) return null;

  return (
    <div>
      {/* Top Navigation */}

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

        {/* Right Side */}
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

          {/* Logout */}
          <button
            type="button"
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
            <li>
              <Link to="/UserDashboard">
                <FontAwesomeIcon icon={faHome} /> Home
              </Link>
            </li>

            <li>
              <Link to="/UserProfile">
                <FontAwesomeIcon icon={faUser} /> Profile Information
              </Link>
            </li>

            <li className="active">
              <div className="submenu-toggle" onClick={() => setSubmenuOpen((s) => !s)}>
                <FontAwesomeIcon icon={faFileInvoice} /> Incident Reports
              </div>
              {submenuOpen && (
                <ul className="submenu">
                  <li>
                    <Link to="/UserViewReport">View Reports</Link>
                  </li>
                  <li className="active">
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
              <button type="button" className="logout" onClick={logout}>
                <FontAwesomeIcon icon={faRightFromBracket} /> Logout
              </button>
            </li>
          </ul>
        </aside>

        {/* Main */}
        <main className="main-content">
          <ErrorBoundary>
            <form onSubmit={handleSubmit} className="crime-form single">
              <h1 style={{ marginBottom: 12 }}>Create Victim &amp; Suspect Report</h1>

              {message && (
                <div className="alert" style={{ marginBottom: 12 }}>
                  {message}
                </div>
              )}

              {/* REPORTING PERSON */}
              <div className="form-section show">
                <h2>Reporting Person</h2>

                <div className="grid">
                  <div className="input-group">
                    <label>Blotter Number (optional)</label>
                    <div className="input-with-btn" style={{ display: "flex", gap: 8 }}>
                      <input 
                        value={form.blotter_number}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            blotter_number: e.target.value.toUpperCase(),
                          })
                        }
                        placeholder="Leave blank then click Auto"
                        style={{ flex: 1 }}
                      />
                      <button
                        type="button"
                        className="inside-btn"
                        onClick={() =>
                          setForm((p) => ({
                            ...p,
                            blotter_number: generateLocalBlotter(p?.loc_addr?.regionCode || "", ""),
                          }))
                        }
                      >
                        Auto
                      </button>
                    </div>
                    <small style={{ color: "#6b7280" }}>Auto generates local blotter number (R4A-...).</small>
                  </div>
                  <div className="input-group">
                    <label>Type of Crime/Incident</label>
                    <select className="full-width-select"
                      value={form.crime_type}
                      onChange={(e) => setForm({ ...form, crime_type: e.target.value })}
                      required
                    >
                      <option value="">Select</option>
                      {crimeTypes.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="input-group">
                    <label>First Name</label>
                    <input
                      placeholder="e.g., Juan"
                      value={form.rp_first_name}
                      onChange={(e) => setForm({ ...form, rp_first_name: e.target.value })}
                    />
                  </div>

                  <div className="input-group">
                    <label>Middle Name</label>
                    <input
                      placeholder="e.g., Santos"
                      value={form.rp_middle_name}
                      onChange={(e) => setForm({ ...form, rp_middle_name: e.target.value })}
                    />
                  </div>

                  <div className="input-group">
                    <label>Last Name</label>
                    <input
                      placeholder="e.g., Dela Cruz"
                      value={form.rp_last_name}
                      onChange={(e) => setForm({ ...form, rp_last_name: e.target.value })}
                    />
                  </div>
                  <div className="input-group">
                    <label>Email Address</label>
                    <input
                      type="email"
                      placeholder="e.g., juan.dc@example.com"
                      value={form.rp_email}
                      onChange={(e) => setForm({ ...form, rp_email: e.target.value })}
                    />
                  </div>

                  <div className="input-group">
                    <label>Birthdate</label>
                    <input
                      type="date"
                      value={form.rp_birthdate}
                      onChange={(e) => {
                        const bd = e.target.value;
                        setForm((prev) => ({
                          ...prev,
                          rp_birthdate: bd,
                          rp_age: computeAgeFromBirthdate(bd),
                        }));
                      }}
                    />
                  </div>

                  <div className="input-group">
                    <label>Age (Auto)</label>
                    <input value={form.rp_age} readOnly />
                  </div>


                  <div className="input-group">
                    <label>Citizenship</label>
                    <input
                      placeholder="e.g., Filipino"
                      value={form.rp_citizenship}
                      onChange={(e) => setForm({ ...form, rp_citizenship: e.target.value })}
                    />
                  </div>

                  <div className="input-group">
                    <label>Sex</label>
                    <SexRadio
                      name="rp_sex"
                      value={form.rp_sex}
                      onChange={(v) => setForm({ ...form, rp_sex: v })}
                    />
                  </div>

                  
                  <div className="input-group">
                    <label>Place of Birth</label>
                    <input
                      placeholder="e.g., Lucena City, Quezon"
                      value={form.rp_place_of_birth}
                      onChange={(e) => setForm({ ...form, rp_place_of_birth: e.target.value })}
                    />
                  </div>

                  <div className="input-group">
                    <label>Occupation</label>
                    <input
                      placeholder="e.g., Fisherman"
                      value={form.rp_occupation}
                      onChange={(e) => setForm({ ...form, rp_occupation: e.target.value })}
                    />
                  </div>

                  
                </div>

                <PhAddressPicker
                  label="Reporting Person Address"
                  value={form.rp_addr}
                  onChange={setReportAddr}
                  withAddressLine
                  requiredFields={true}
                />
              </div>

              {/* VICTIM */}
              <div className="form-section show">
                <h2>Victim Information</h2>

                <div className="input-groups full">
                  <label className="checkbox-inline">
                    <input
                      type="checkbox"
                      checked={sameReporterVictim}
                      onChange={(e) => setSameReporterVictim(e.target.checked)}
                    />
                    <span >Same person as Reporting Person</span>
                  </label>
                </div>

                <div className="grid">

                  <div className="input-group">
                    <label>Victim Photo</label>
                    <input type="file" accept="image/*" onChange={onPickVictimPhoto} />
                    {form.v_photo_preview && (
                      <div className="img-preview">
                        <img
                          src={form.v_photo_preview}
                          alt="Victim"
                          style={{
                            maxWidth: 160,
                            maxHeight: 160,
                            borderRadius: 8,
                            objectFit: "cover",
                          }}
                        />
                      </div>
                    )}
                  </div>

                  

                  <div className="input-group">
                    <label>Date of Incident</label>
                    <input
                      type="date"
                      value={form.happened_at}
                      onChange={(e) => setForm({ ...form, happened_at: e.target.value })}
                    />
                  </div>

                 

                  <div className="input-group">
                    <label>First Name</label>
                    <input
                      placeholder="e.g., Maria"
                      value={form.v_first_name}
                      onChange={(e) => setForm({ ...form, v_first_name: e.target.value })}
                      disabled={sameReporterVictim}
                    />
                  </div>

                  <div className="input-group">
                    <label>Middle Name</label>
                    <input
                      placeholder="e.g., Reyes"
                      value={form.v_middle_name}
                      onChange={(e) => setForm({ ...form, v_middle_name: e.target.value })}
                      disabled={sameReporterVictim}
                    />
                  </div>

                  <div className="input-group">
                    <label>Last Name</label>
                    <input
                      placeholder="e.g., Santos"
                      value={form.v_last_name}
                      onChange={(e) => setForm({ ...form, v_last_name: e.target.value })}
                      disabled={sameReporterVictim}
                    />
                  </div>
                  <div className="input-group">
                    <label>Sex</label>
                    <SexRadio
                      name="v_sex"
                      value={form.v_sex}
                      onChange={(v) => setForm({ ...form, v_sex: v })}
                    />
                  </div>

                  <div className="input-group">
                    <label>Birthdate</label>
                    <input
                      type="date"
                      value={form.v_birthdate}
                      onChange={(e) => {
                        const bd = e.target.value;
                        setForm((prev) => ({
                          ...prev,
                          v_birthdate: bd,
                          v_age: computeAgeFromBirthdate(bd),
                        }));
                      }}
                    />
                  </div>

                  <div className="input-group">
                    <label>Age (Auto)</label>
                    <input type="number" placeholder="Auto" value={form.v_age} readOnly />
                  </div>

              

                  <div className="input-group">
                    <label>Citizenship</label>
                    <input
                      placeholder="e.g., Filipino"
                      value={form.v_citizenship}
                      onChange={(e) => setForm({ ...form, v_citizenship: e.target.value })}
                      disabled={sameReporterVictim}
                    />
                  </div>

                  <div className="input-group">
                    <label>Place of Birth</label>
                    <input
                      placeholder="e.g., Tayabas City, Quezon"
                      value={form.v_place_of_birth}
                      onChange={(e) => setForm({ ...form, v_place_of_birth: e.target.value })}
                      disabled={sameReporterVictim}
                    />
                  </div>

                  <div className="input-group">
                    <label>Occupation</label>
                    <input
                      placeholder="e.g., Vendor"
                      value={form.v_occupation}
                      onChange={(e) => setForm({ ...form, v_occupation: e.target.value })}
                      disabled={sameReporterVictim}
                    />
                  </div>

                   <div className="input-group full">
                    <label>Description / Narrative</label>
                    <textarea
                      rows={3}
                      placeholder="Brief description of the incident…"
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                    />
                  </div>

                  
                </div>

                <PhAddressPicker
                  label="Victim Address"
                  value={form.v_addr}
                  onChange={setVictimAddr}
                  withAddressLine
                  requiredFields={false}
                />
              </div>

              {/* SUSPECT */}
              <div className="form-section show">
                <h2>Suspect Information (Optional)</h2>

                  <div className="input-group">
                    <label>Suspect Photo</label>
                    <input type="file" accept="image/*" onChange={onPickSuspectPhoto} />
                    {form.s_photo_preview && (
                      <div className="img-preview">
                        <img
                          src={form.s_photo_preview}
                          alt="Suspect"
                          style={{
                            maxWidth: 160,
                            maxHeight: 160,
                            borderRadius: 8,
                            objectFit: "cover",
                          }}
                        />
                      </div>
                    )}
                  </div>

                <div className="grid">
                  <div className="input-group">
                    <label>First Name</label>
                    <input
                      value={form.s_first_name}
                      onChange={(e) => setForm({ ...form, s_first_name: e.target.value })}
                      placeholder="Enter suspect first name"
                    />
                  </div>

                  <div className="input-group">
                    <label>Middle Name</label>
                    <input
                      value={form.s_middle_name}
                      onChange={(e) => setForm({ ...form, s_middle_name: e.target.value })}
                      placeholder="Enter suspect middle name"
                    />
                  </div>

                  <div className="input-group">
                    <label>Last Name</label>
                    <input
                      value={form.s_last_name}
                      onChange={(e) => setForm({ ...form, s_last_name: e.target.value })}
                      placeholder="Enter suspect last name"
                    />
                  </div>

                  <div className="input-group">
                    <label>Age</label>
                    <input
                      type="number"
                      value={form.s_age}
                      onChange={(e) => setForm({ ...form, s_age: e.target.value })}
                      placeholder="Enter age"
                    />
                  </div>


                
                </div>

                <PhAddressPicker
                  label="Suspect Address"
                  value={form.s_addr}
                  onChange={setSuspectAddr}
                  withAddressLine
                  requiredFields={false}
                />
              </div>

              {/* CRIME LOCATION */}
              <div className="form-section show">
                <h2>Crime Location (Region IV-A only)</h2>

                <PhAddressPicker
                  label="Address (Region IV-A)"
                  value={form.loc_addr}
                  onChange={setLocAddr}
                  withAddressLine
                  requiredFields={false}
                  restrictToRegion4A={true}
                />

                <div className="grid">
                  <div className="input-group">
                    <label>Latitude</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="Auto from dropdown or drag marker"
                      value={form.latitude}
                      onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                    />
                  </div>

                  <div className="input-group">
                    <label>Longitude</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="Auto from dropdown or drag marker"
                      value={form.longitude}
                      onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                    />
                  </div>

                  <div className="input-group full">
                    <small style={{ color: geoMsg?.startsWith("✅") ? "#047857" : "#6b7280" }}>
                      
                    </small>
                  </div>

                  <div className="input-group full">
                    <small style={{ color: "#6b7280" }}>
                      Tip: Click the map to set marker. Drag marker for micro-adjustment.
                    </small>
                  </div>
                </div>

                <MiniPickerMap
                  lat={Number(form.latitude)}
                  lng={Number(form.longitude)}
                  onChange={({ lat, lng }) => {
                    setLatLng(lat, lng);

                  }}
                />
              </div>

              <div className="form-actions">
                
                <button type="submit" className="submit-button" disabled={saving}>
                  <FontAwesomeIcon icon={faSave} /> {saving ? "Saving…" : "Save Report"}
                </button>
              </div>
            </form>
          </ErrorBoundary>
        </main>
      </div>

      <style>{`
        .radio-group { display:flex; gap:14px; align-items:center; padding-top:6px; }
        .radio { display:inline-flex; align-items:center; gap:8px; cursor:pointer; }
        .radio input[type="radio"] { transform: scale(1.1); }
        .checkbox-inline { display:flex; align-items:center; cursor:pointer; }
      `}</style>
    </div>
  );
}
