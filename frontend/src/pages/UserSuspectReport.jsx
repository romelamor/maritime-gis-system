// src/pages/UserSuspectReport.jsx
import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faHome,
  faUser,
  faFileInvoice,
  faMapLocation,
  faChartLine,
  faBell,
  faRightFromBracket,
  faSave,
  faBoxArchive,
} from "@fortawesome/free-solid-svg-icons";
import "../assets/css/AdminCrime.css";

/* Leaflet (PH-locked mini picker) */
import "leaflet/dist/leaflet.css";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMapEvents,
  useMap,
} from "react-leaflet";
import L from "leaflet";

/* Fix default marker icons */
const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

/* ================= CONFIG ================= */
const API_BASE = (
  import.meta.env.VITE_API_BASE || "http://localhost:8000"
).replace(/\/$/, "");
const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
const PSGC_BASE = "https://psgc.cloud/api";

/* PH bounds & helpers */
const PH_BOUNDS = L.latLngBounds(
  L.latLng(4.5, 116.0),
  L.latLng(21.5, 127.0)
);
const PH_CENTER = L.latLng(14.5995, 120.9842);
const toViewbox = (b) => {
  const sw = b.getSouthWest(),
    ne = b.getNorthEast();
  return `${sw.lng},${sw.lat},${ne.lng},${ne.lat}`;
};

/* ========= Error Boundary ========= */
class ErrorBoundary extends React.Component {
  constructor(p) {
    super(p);
    this.state = { hasError: false, errMsg: "" };
  }
  static getDerivedStateFromError(e) {
    return { hasError: true, errMsg: e?.message || "Unknown error" };
  }
  componentDidCatch(e, info) {
    console.error("UserSuspectReport:", e, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 16 }}>
          <h3>Something went wrong.</h3>
          <pre style={{ whiteSpace: "pre-wrap", color: "#b91c1c" }}>
            {this.state.errMsg}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

/* =============== Small helpers =============== */
const fullNameVictim = (row) =>
  [row?.v_first_name, row?.v_middle_name, row?.v_last_name]
    .filter(Boolean)
    .join(" ");
const toDate = (iso) => (iso ? String(iso).split("T")[0] : "");

/* ================= Address Picker (PSGC) ================= */
function PhAddressPicker({ label, value, onChange, withAddressLine }) {
  const [regions, setRegions] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [cityMuns, setCityMuns] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [note, setNote] = useState("");

  async function safeFetchJson(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        setNote(`PSGC ${res.status} for ${url}`);
        return [];
      }
      const t = await res.text();
      try {
        const d = JSON.parse(t);
        return Array.isArray(d) ? d : [];
      } catch {
        setNote(`PSGC returned non-JSON for ${url}`);
        return [];
      }
    } catch (e) {
      setNote(`PSGC fetch error for ${url}`);
      return [];
    }
  }

  useEffect(() => {
    (async () =>
      setRegions(await safeFetchJson(`${PSGC_BASE}/regions`)))();
  }, []);
  useEffect(() => {
    (async () => {
      if (!value?.regionCode) {
        setProvinces([]);
        setCityMuns([]);
        setBarangays([]);
        return;
      }
      setProvinces(
        await safeFetchJson(
          `${PSGC_BASE}/regions/${value.regionCode}/provinces`
        )
      );
      setCityMuns([]);
      setBarangays([]);
    })();
  }, [value?.regionCode]);
  useEffect(() => {
    (async () => {
      if (!value?.provinceCode) {
        setCityMuns([]);
        setBarangays([]);
        return;
      }
      setCityMuns(
        await safeFetchJson(
          `${PSGC_BASE}/provinces/${value.provinceCode}/cities-municipalities`
        )
      );
      setBarangays([]);
    })();
  }, [value?.provinceCode]);
  useEffect(() => {
    (async () => {
      if (!value?.cityMunCode) {
        setBarangays([]);
        return;
      }
      const cm = (cityMuns || []).find((x) => x.code === value.cityMunCode);
      const isCity = (cm?.type || "").toLowerCase().includes("city");
      const url = isCity
        ? `${PSGC_BASE}/cities/${value.cityMunCode}/barangays`
        : `${PSGC_BASE}/municipalities/${value.cityMunCode}/barangays`;
      const list = await safeFetchJson(url);
      setBarangays(list);
      if (!list.length) setNote("No barangays fetched (API limit/error).");
    })();
  }, [value?.cityMunCode, cityMuns]);

  const setRegion = (code) => {
    const r = (regions || []).find((x) => x.code === code);
    onChange({
      ...(value || {}),
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
    const p = (provinces || []).find((x) => x.code === code);
    onChange({
      ...(value || {}),
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
    const cm = (cityMuns || []).find((x) => x.code === code);
    const kind = (cm?.type || "").toLowerCase().includes("city")
      ? "city"
      : "municipality";
    onChange({
      ...(value || {}),
      cityMunCode: code,
      cityMunName: cm?.name || "",
      cityMunKind: kind,
      barangayCode: "",
      barangayName: "",
    });
  };
  const setBarangay = (code) => {
    const b = (barangays || []).find((x) => x.code === code);
    const barangayName = b?.name || "";
    const regionName =
      (regions || []).find((r) => r.code === (value?.regionCode || ""))
        ?.name ||
      value?.regionName ||
      "";
    const provinceName =
      (provinces || []).find((p) => p.code === (value?.provinceCode || ""))
        ?.name ||
      value?.provinceName ||
      "";
    const cityMunName =
      (cityMuns || []).find((c) => c.code === (value?.cityMunCode || ""))
        ?.name ||
      value?.cityMunName ||
      "";

    const combinedParts = [
      barangayName,
      cityMunName,
      provinceName,
      regionName,
    ].filter(Boolean);
    const combined = combinedParts.join(", ");
    const finalAddressLine = combined;

    onChange({
      ...(value || {}),
      barangayCode: code,
      barangayName,
      addressLine: finalAddressLine,
    });
  };

  return (
    <div className="section">
      <h3>{label}</h3>
      {withAddressLine && (
        <div className="input-group">
          <label>
            Lot / Street <span className="required">*</span>
          </label>
          <input
            value={value?.addressLine || ""}
            onChange={(e) =>
              onChange({ ...(value || {}), addressLine: e.target.value })
            }
            placeholder="House no., Street, etc."
            required
          />
        </div>
      )}
      <div className="grid">
        <div className="input-group">
          <label>
            Region <span className="required">*</span>
          </label>
          <select
            value={value?.regionCode || ""}
            onChange={(e) => setRegion(e.target.value)}
            required
          >
            <option value="">Select Region</option>
            {(regions || []).map((r) => (
              <option key={r.code} value={r.code}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div className="input-group">
          <label>
            Province <span className="required">*</span>
          </label>
          <select
            value={value?.provinceCode || ""}
            onChange={(e) => setProvince(e.target.value)}
            disabled={!value?.regionCode}
            required
          >
            <option value="">Select Province</option>
            {(provinces || []).map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="input-group">
          <label>
            City / Municipality <span className="required">*</span>
          </label>
          <select
            value={value?.cityMunCode || ""}
            onChange={(e) => setCityMun(e.target.value)}
            disabled={!value?.provinceCode}
            required
          >
            <option value="">Select City/Municipality</option>
            {(cityMuns || []).map((cm) => {
              const k = (cm.type || "")
                .toLowerCase()
                .includes("city")
                ? "City"
                : "Municipality";
              return (
                <option key={cm.code} value={cm.code}>
                  {cm.name} ({k})
                </option>
              );
            })}
          </select>
        </div>
        <div className="input-group">
          <label>
            Barangay <span className="required">*</span>
          </label>
          <select
            value={value?.barangayCode || ""}
            onChange={(e) => setBarangay(e.target.value)}
            disabled={!value?.cityMunCode}
            required
          >
            <option value="">Select Barangay</option>
            {(barangays || []).map((b) => (
              <option key={b.code} value={b.code}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        {!!note && (
          <div className="input-group full">
            <small style={{ color: "#b45309" }}>{note}</small>
          </div>
        )}
      </div>
    </div>
  );
}

/* ================= SIMPLE Address Picker (for Crime Location only) ================= */
function SimpleAddressPicker({ label, value, onChange, withAddressLine }) {
  return (
    <div className="section">
      <h3>{label}</h3>
      {withAddressLine && (
        <div className="input-group">
          <label>
            Lot / Street <span className="required">*</span>
          </label>
          <input
            value={value?.addressLine || ""}
            onChange={(e) =>
              onChange({ ...(value || {}), addressLine: e.target.value })
            }
            placeholder="House no., Street, Barangay, City (optional)"
            required
          />
          <small style={{ color: "#6b7280" }}>
            Tip: Ilagay ang kompletong address sa isang linya (hal. "123 Mabini
            St., Brgy. X, Tayabas City").
          </small>
        </div>
      )}
    </div>
  );
}

/* ================= Mini Map (PH-locked) ================= */
function KeepMapInPH() {
  const map = useMap();
  useEffect(() => {
    map.setMaxBounds(PH_BOUNDS);
    map.fitBounds(PH_BOUNDS, { padding: [20, 20] });
  }, [map]);
  return null;
}

/* Recenter helper - will flyTo when pos changes */
function RecenterOnPos({ pos, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !pos || !Number.isFinite(pos[0]) || !Number.isFinite(pos[1]))
      return;
    try {
      map.flyTo(pos, zoom ?? map.getZoom(), { duration: 0.6 });
    } catch {
      map.setView(pos, zoom ?? map.getZoom());
    }
  }, [map, pos, zoom]);
  return null;
}

/* Updated MiniPickerMap: auto-centers when lat/lng present */
function MiniPickerMap({ lat, lng, onChange, onReverse }) {
  const initial =
    Number.isFinite(lat) && Number.isFinite(lng)
      ? [lat, lng]
      : [PH_CENTER.lat, PH_CENTER.lng];
  const [pos, setPos] = useState(initial);

  useEffect(() => {
    if (Number.isFinite(lat) && Number.isFinite(lng))
      setPos([Number(lat), Number(lng)]);
  }, [lat, lng]);

  function DraggableMarker() {
    const markerRef = useRef(null);
    useMapEvents({
      click(e) {
        const { lat, lng } = e.latlng;
        if (!PH_BOUNDS.contains([lat, lng])) return;
        setPos([lat, lng]);
        if (typeof onChange === "function") onChange({ lat, lng });
        if (typeof onReverse === "function") onReverse(lat, lng);
      },
    });
    return (
      <Marker
        draggable
        eventHandlers={{
          dragend() {
            const m = markerRef.current;
            if (!m) return;
            const ll = m.getLatLng();
            if (!PH_BOUNDS.contains(ll)) return;
            setPos([ll.lat, ll.lng]);
            if (typeof onChange === "function")
              onChange({ lat: ll.lat, lng: ll.lng });
            if (typeof onReverse === "function") onReverse(ll.lat, ll.lng);
          },
        }}
        position={pos}
        ref={markerRef}
      />
    );
  }

  return (
    <div
      style={{
        border: "1px solid #eee",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      <MapContainer
        style={{ height: 300, width: "100%" }}
        center={pos}
        zoom={Number.isFinite(lat) && Number.isFinite(lng) ? 15 : 6}
        scrollWheelZoom
        worldCopyJump={false}
        maxBounds={PH_BOUNDS}
        maxBoundsViscosity={1.0}
      >
        <KeepMapInPH />
        <RecenterOnPos
          pos={pos}
          zoom={Number.isFinite(lat) && Number.isFinite(lng) ? 15 : 6}
        />
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

/* ================= NAVBAR / AUTH HELPERS ================= */
function authHeader() {
  const raw =
    localStorage.getItem("token") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("access") ||
    "";
  if (!raw) return {};
  if (/^(Bearer|Token)\s/i.test(raw)) return { Authorization: raw };
  if (/^[\w-]+\.[\w-]+\.[\w-]+\.[\w-]+$/.test(raw)) {
    return { Authorization: `Bearer ${raw}` };
  }
  if (/^[\w-]+\.[\w-]+\.[\w-]+$/.test(raw)) {
    return { Authorization: `Bearer ${raw}` };
  }
  return { Authorization: raw };
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

/* ================= MAIN ================= */
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

function UserSuspectReportInner() {
  const navigate = useNavigate();

  // 🔐 route-guard flag
  const [authChecked, setAuthChecked] = useState(false);

  // user sidebar/topnav state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [submenuOpen, setSubmenuOpen] = useState(true);
  const [archiveOpen, setArchiveOpen] = useState(false);

  // user for navbar
  const [user, setUser] = useState(null);

  // form state
  const blank = {
    crime_report: "",
    s_first_name: "",
    s_middle_name: "",
    s_last_name: "",
    s_age: "",
    s_crime_type: "",
    s_addr: {
      addressLine: "",
      regionCode: "",
      regionName: "",
      provinceCode: "",
      provinceName: "",
      cityMunCode: "",
      cityMunName: "",
      cityMunKind: "",
      barangayCode: "",
      barangayName: "",
    },
    loc_addr: {
      addressLine: "",
      regionCode: "",
      regionName: "",
      provinceCode: "",
      provinceName: "",
      cityMunCode: "",
      cityMunName: "",
      cityMunKind: "",
      barangayCode: "",
      barangayName: "",
    },
    latitude: "",
    longitude: "",
    loc_kind: "",
    loc_waterbody: "",
    s_photo_file: null,
    s_photo_preview: "",
  };
  const [form, setForm] = useState(blank);

  // PSGC caches to resolve names -> codes
  const [psgcRegions, setPsgcRegions] = useState([]);
  const [psgcProvinces, setPsgcProvinces] = useState([]);
  const citiesCache = useRef({});
  const barangaysCache = useRef({});

  // crimes list for linking
  const [crimes, setCrimes] = useState([]);
  const [loadingCrimes, setLoadingCrimes] = useState(true);
  const [crimeErr, setCrimeErr] = useState("");

  // saving + misc
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [geoMsg, setGeoMsg] = useState("");

  // geocode control
  const geoTimer = useRef(null);
  const latestGeoRun = useRef(0);
  const lastGeoAction = useRef(null);

  // 🔐 Route guard: redirect to /Userlogin if no token
  useEffect(() => {
    const headers = authHeader();
    if (!headers.Authorization) {
      navigate("/Userlogin", { replace: true });
    } else {
      setAuthChecked(true);
    }
  }, [navigate]);

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("access_token");
    localStorage.removeItem("access");
    localStorage.removeItem("refresh_token");
    navigate("/Userlogin", { replace: true });
  };

  // navbar user info (with 401 handling)
  useEffect(() => {
    if (!authChecked) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/personnel/me/`, {
          headers: authHeader(),
          validateStatus: () => true,
        });
        if (!cancelled && res.status >= 200 && res.status < 300) {
          setUser(res.data || {});
        } else if (!cancelled && res.status === 401) {
          logout();
        }
      } catch (e) {
        // ignore; navbar will show defaults
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authChecked]); // eslint-disable-line react-hooks/exhaustive-deps

  // load available cases
  useEffect(() => {
    if (!authChecked) return;
    (async () => {
      setLoadingCrimes(true);
      setCrimeErr("");
      try {
        const res = await axios.get(`${API_BASE}/api/crimes/`, {
          params: {
            is_archived: false,
            ordering: "-happened_at",
            limit: 1000,
          },
          headers: authHeader(),
          validateStatus: () => true,
        });

        if (res.status === 401) {
          logout();
          return;
        }

        const rows = Array.isArray(res.data)
          ? res.data
          : res.data?.results || [];
        setCrimes(rows);
      } catch (e) {
        setCrimeErr("Failed to load cases.");
        setCrimes([]);
      } finally {
        setLoadingCrimes(false);
      }
    })();
  }, [authChecked]); // eslint-disable-line react-hooks/exhaustive-deps

  // preload PSGC regions + provinces for name->code resolution
  useEffect(() => {
    (async () => {
      try {
        const rRes = await fetch(`${PSGC_BASE}/regions`);
        const regions = rRes.ok ? await rRes.json() : [];
        setPsgcRegions(Array.isArray(regions) ? regions : []);
        const pRes = await fetch(`${PSGC_BASE}/provinces`);
        const provinces = pRes.ok ? await pRes.json() : [];
        setPsgcProvinces(Array.isArray(provinces) ? provinces : []);
      } catch (e) {
        setPsgcRegions([]);
        setPsgcProvinces([]);
      }
    })();
  }, []);

  const setSusAddr = (next) => setForm((p) => ({ ...p, s_addr: next }));
  const setLocAddr = (next) => setForm((p) => ({ ...p, loc_addr: next }));

  const onPickSuspectPhoto = (e) => {
    const f = e.target.files?.[0] || null;
    if (!f) {
      setForm((p) => ({ ...p, s_photo_file: null, s_photo_preview: "" }));
      return;
    }
    const url = URL.createObjectURL(f);
    setForm((p) => ({ ...p, s_photo_file: f, s_photo_preview: url }));
  };

  const appendAddr = (fd, prefix, a = {}) => {
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

  /* =========== Nominatim helpers =========== */
  const queryNominatim = async (obj) => {
    try {
      const params = new URLSearchParams({
        format: "jsonv2",
        addressdetails: "1",
        limit: "1",
        countrycodes: "ph",
        bounded: "1",
        viewbox: toViewbox(PH_BOUNDS),
        ...obj,
      });
      const res = await fetch(
        `${NOMINATIM_BASE}/search?${params.toString()}`,
        { headers: { "Accept-Language": "en" } }
      );
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  };

  const reverseNominatim = async (lat, lon) => {
    try {
      const params = new URLSearchParams({
        format: "jsonv2",
        lat: String(lat),
        lon: String(lon),
        addressdetails: "1",
        zoom: "18",
      });
      const res = await fetch(
        `${NOMINATIM_BASE}/reverse?${params.toString()}`,
        { headers: { "Accept-Language": "en" } }
      );
      if (!res.ok) return null;
      const data = await res.json();
      return data || null;
    } catch (e) {
      console.error("reverse nominatim error", e);
      return null;
    }
  };

  /* =========== Geocode location (debounced) =========== */
  const geocodeLocation = async () => {
    if (lastGeoAction.current === "marker") {
      lastGeoAction.current = null;
      setGeoMsg("Using marker coordinates — skipping address-based override.");
      return;
    }

    const run = ++latestGeoRun.current;
    const { addressLine, barangayName, cityMunName, provinceName, regionName } =
      form.loc_addr || {};
    if (
      !(
        addressLine ||
        barangayName ||
        cityMunName ||
        provinceName ||
        regionName
      )
    )
      return;

    setGeoMsg("Finding coordinates…");
    try {
      let hit = null;
      if (!hit) {
        const d = await queryNominatim({
          street: addressLine || "",
          city: [barangayName, cityMunName].filter(Boolean).join(", "),
          county: provinceName || "",
          state: regionName || "",
          country: "Philippines",
        });
        hit = d[0];
      }
      if (!hit) {
        const d = await queryNominatim({
          city: [barangayName, cityMunName].filter(Boolean).join(", "),
          county: provinceName || "",
          state: regionName || "",
          country: "Philippines",
        });
        hit = d[0];
      }
      if (!hit) {
        const q = [
          addressLine,
          barangayName,
          cityMunName,
          provinceName,
          regionName,
          "Philippines",
        ]
          .filter(Boolean)
          .join(", ");
        const d = await queryNominatim({ q });
        hit = d[1] || d[0];
      }
      if (!hit) {
        const q = [
          barangayName || "",
          cityMunName,
          provinceName,
          regionName,
          "Philippines",
        ]
          .filter(Boolean)
          .join(", ");
        const d = await queryNominatim({ q });
        hit = d[0];
      }
      if (!hit) {
        const q = [provinceName, regionName, "Philippines"]
          .filter(Boolean)
          .join(", ");
        const d = await queryNominatim({ q });
        hit = d[0];
      }

      if (run !== latestGeoRun.current) return;

      if (hit?.lat && hit?.lon) {
        const lat = parseFloat(hit.lat),
          lon = parseFloat(hit.lon);
        if (
          Number.isFinite(lat) &&
          Number.isFinite(lon) &&
          PH_BOUNDS.contains([lat, lon])
        ) {
          setForm((p) => ({ ...p, latitude: lat, longitude: lon }));
          setGeoMsg("Coordinates set. Drag the marker to fine-tune.");
        } else {
          setGeoMsg("Coords outside PH ignored. Drag marker or adjust address.");
        }
      } else {
        setGeoMsg("No geocode match. Drag marker or adjust address.");
      }
    } catch {
      setGeoMsg("Geocoding failed. Drag marker or adjust address.");
    }
  };

  useEffect(() => {
    if (geoTimer.current) clearTimeout(geoTimer.current);
    const { addressLine, barangayName, cityMunName, provinceName, regionName } =
      form.loc_addr || {};
    if (
      !(
        addressLine ||
        barangayName ||
        cityMunName ||
        provinceName ||
        regionName
      )
    )
      return;
    geoTimer.current = setTimeout(() => {
      geocodeLocation();
    }, 700);
    return () => {
      if (geoTimer.current) clearTimeout(geoTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    form.loc_addr?.addressLine,
    form.loc_addr?.barangayName,
    form.loc_addr?.cityMunName,
    form.loc_addr?.provinceName,
    form.loc_addr?.regionName,
  ]);

  /* =========== NEW: geocode immediately when barangay is chosen =========== */
  useEffect(() => {
    if (!form?.loc_addr?.barangayCode) return;
    if (lastGeoAction.current === "marker") {
      lastGeoAction.current = null;
      setGeoMsg("Using marker coordinates — skipping address-based override.");
      return;
    }
    geocodeLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.loc_addr?.barangayCode]);

  /* =========== Reverse on marker set -> populate loc_addr =========== */
  const handleMarkerSet = async (lat, lng) => {
    lastGeoAction.current = "marker";
    setForm((p) => ({ ...p, latitude: lat, longitude: lng }));
    setGeoMsg("Reverse-looking up address…");

    const hit = await reverseNominatim(lat, lng);
    if (!hit) {
      setGeoMsg("Reverse geocode failed. You can fill address manually.");
      return;
    }
    const addr = hit.address || {};
    const house = addr.house_number || "";
    const road =
      addr.road || addr.pedestrian || addr.cycleway || addr.footway || "";
    const neighbourhood =
      addr.neighbourhood || addr.suburb || addr.village || addr.hamlet || "";
    const addressLine = [house, road].filter(Boolean).join(" ").trim();

    const newLoc = {
      addressLine: addressLine
        ? `${addressLine}${
            neighbourhood ? `, ${neighbourhood}` : ""
          }`.trim()
        : neighbourhood || hit.display_name || "",
      regionCode: "",
      regionName: addr.state || addr.region || "",
      provinceCode: "",
      provinceName:
        addr.county || addr.state_district || addr.county || "",
      cityMunCode: "",
      cityMunName:
        addr.city || addr.town || addr.village || addr.municipality || "",
      cityMunKind: "",
      barangayCode: "",
      barangayName: neighbourhood || addr.suburb || addr.village || "",
    };

    setForm((p) => ({ ...p, loc_addr: { ...p.loc_addr, ...newLoc } }));
    setGeoMsg("Address filled from marker (you may adjust further).");
  };

  // helper: case-insensitive
  const ci = (s) => (s || "").toString().trim().toLowerCase();

  // fetch cities for a province (cache)
  const fetchCitiesForProvince = async (provinceCode) => {
    if (!provinceCode) return [];
    if (citiesCache.current[provinceCode])
      return citiesCache.current[provinceCode];
    try {
      const res = await fetch(
        `${PSGC_BASE}/provinces/${provinceCode}/cities-municipalities`
      );
      const data = res.ok ? await res.json() : [];
      citiesCache.current[provinceCode] = Array.isArray(data) ? data : [];
      return citiesCache.current[provinceCode];
    } catch (e) {
      return [];
    }
  };

  // fetch barangays for city (cache)
  const fetchBarangaysForCity = async (cityCode, isCity = true) => {
    if (!cityCode) return [];
    if (barangaysCache.current[cityCode])
      return barangaysCache.current[cityCode];
    try {
      const endpoint = isCity ? "cities" : "municipalities";
      const res = await fetch(
        `${PSGC_BASE}/${endpoint}/${cityCode}/barangays`
      );
      const data = res.ok ? await res.json() : [];
      barangaysCache.current[cityCode] = Array.isArray(data) ? data : [];
      return barangaysCache.current[cityCode];
    } catch (e) {
      return [];
    }
  };

  // resolve names -> codes (best-effort) for selected crime record
  const resolvePsgcCodesForCrime = async (selected) => {
    if (!selected) return {};
    const regionName = selected.loc_region || selected.region || "";
    const provinceName = selected.loc_province || selected.province || "";
    const cityName =
      selected.loc_city_municipality ||
      selected.city_municipality ||
      selected.city ||
      "";
    const barangayName = selected.loc_barangay || selected.barangay || "";

    let regionCode = "";
    let provinceCode = "";
    let cityMunCode = "";
    let barangayCode = "";
    let cityMunKind = "";

    if (regionName && psgcRegions.length) {
      const r = psgcRegions.find((rr) => ci(rr.name) === ci(regionName));
      if (r) regionCode = r.code || "";
    }

    if (provinceName && psgcProvinces.length) {
      const p = psgcProvinces.find((pp) => ci(pp.name) === ci(provinceName));
      if (p) provinceCode = p.code || "";
    }

    if (provinceCode && cityName) {
      const cities = await fetchCitiesForProvince(provinceCode);
      const found = (cities || []).find((c) => ci(c.name) === ci(cityName));
      if (found) {
        cityMunCode = found.code || "";
        cityMunKind = (found.type || "")
          .toLowerCase()
          .includes("city")
          ? "city"
          : "municipality";
      } else {
        for (const prov of psgcProvinces) {
          const citiesProv = await fetchCitiesForProvince(prov.code);
          const f = (citiesProv || []).find(
            (c) => ci(c.name) === ci(cityName)
          );
          if (f) {
            cityMunCode = f.code || "";
            cityMunKind = (f.type || "")
              .toLowerCase()
              .includes("city")
              ? "city"
              : "municipality";
            provinceCode = prov.code || provinceCode;
            break;
          }
        }
      }
    } else if (cityName) {
      for (const prov of psgcProvinces) {
        const citiesProv = await fetchCitiesForProvince(prov.code);
        const f = (citiesProv || []).find(
          (c) => ci(c.name) === ci(cityName)
        );
        if (f) {
          cityMunCode = f.code || "";
          cityMunKind = (f.type || "")
            .toLowerCase()
            .includes("city")
            ? "city"
            : "municipality";
          provinceCode = prov.code || provinceCode;
          break;
        }
      }
    }

    if (cityMunCode && cityMunKind) {
      const isCity = cityMunKind === "city";
      const barangays = await fetchBarangaysForCity(cityMunCode, isCity);
      const b = (barangays || []).find(
        (bb) => ci(bb.name) === ci(barangayName)
      );
      if (b) barangayCode = b.code || "";
    }

    return { regionCode, provinceCode, cityMunCode, barangayCode, cityMunKind };
  };

  /* =========== when user selects a crime, autofill location fields & try to resolve PSGC codes =========== */
  useEffect(() => {
    if (!form.crime_report || !crimes || crimes.length === 0) return;
    const selected = crimes.find(
      (c) => String(c.id) === String(form.crime_report)
    );
    if (!selected) return;

    const nextLoc = {
      addressLine:
        selected.loc_address ||
        selected.location ||
        selected.place_of_incident ||
        selected.place ||
        "",
      regionCode: selected.loc_region_code || "",
      regionName: selected.loc_region || selected.region || "",
      provinceCode: selected.loc_province_code || "",
      provinceName: selected.loc_province || selected.province || "",
      cityMunCode: selected.loc_city_mun_code || "",
      cityMunName:
        selected.loc_city_municipality ||
        selected.city_municipality ||
        selected.city ||
        "",
      cityMunKind: selected.loc_city_mun_kind || "",
      barangayCode: selected.loc_barangay_code || "",
      barangayName: selected.loc_barangay || selected.barangay || "",
    };

    setForm((p) => ({
      ...p,
      loc_addr: { ...p.loc_addr, ...nextLoc },
      latitude:
        selected.latitude != null && selected.latitude !== ""
          ? selected.latitude
          : p.latitude,
      longitude:
        selected.longitude != null && selected.longitude !== ""
          ? selected.longitude
          : p.longitude,
      loc_kind: selected.loc_kind || p.loc_kind,
      loc_waterbody: selected.loc_waterbody || p.loc_waterbody,
    }));

    (async () => {
      try {
        const codes = await resolvePsgcCodesForCrime(selected);
        setForm((p) => ({
          ...p,
          loc_addr: {
            ...p.loc_addr,
            regionCode: codes.regionCode || p.loc_addr.regionCode || "",
            provinceCode: codes.provinceCode || p.loc_addr.provinceCode || "",
            cityMunCode: codes.cityMunCode || p.loc_addr.cityMunCode || "",
            cityMunKind: codes.cityMunKind || p.loc_addr.cityMunKind || "",
            barangayCode: codes.barangayCode || p.loc_addr.barangayCode || "",
          },
        }));
      } catch (e) {
        // silent
      }
    })();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.crime_report, crimes, psgcRegions, psgcProvinces]);

  /* ================= Submit ================= */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.crime_report) {
      alert("Please select the related Crime Report/Case.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const fd = new FormData();
      fd.append("crime_report", form.crime_report);
      fd.append("s_first_name", form.s_first_name || "");
      fd.append("s_middle_name", form.s_middle_name || "");
      fd.append("s_last_name", form.s_last_name || "");
      fd.append("s_age", form.s_age || "");
      fd.append("s_crime_type", form.s_crime_type || "");
      appendAddr(fd, "s", form.s_addr);
      appendAddr(fd, "loc", form.loc_addr);
      fd.append("latitude", form.latitude || "");
      fd.append("longitude", form.longitude || "");
      fd.append("loc_kind", form.loc_kind || "");
      fd.append("loc_waterbody", form.loc_waterbody || "");
      if (form.s_photo_file) fd.append("s_photo", form.s_photo_file);

      const res = await axios.post(`${API_BASE}/api/suspects/`, fd, {
        headers: {
          "Content-Type": "multipart/form-data",
          ...authHeader(),
        },
        validateStatus: () => true,
      });

      if (res.status === 401) {
        setMessage("Your session has expired. Please log in again.");
        logout();
        return;
      }

      if (res.status < 200 || res.status >= 300) {
        console.error("save suspect error", res.data);
        setMessage(
          "Save failed. Please check required fields and try again."
        );
        return;
      }

      setMessage("Suspect report submitted.");
      setForm(blank);
      navigate("/UserViewReport");
    } catch (e2) {
      console.error("save suspect error", e2?.response?.data || e2.message);
      setMessage("Save failed. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // label for case select
  const caseLabel = (c) => {
    const name = fullNameVictim(c) || "Unknown Victim";
    const date = toDate(c?.happened_at);
    const blot = c?.blotter_number ? `[${c.blotter_number}] ` : "";
    const crimeType = c?.crime_type || "Incident";
    return `${blot}${crimeType} — ${name} — ${date}`;
  };

  const visibleImage = imageUrl(user || {});
  const rankLabel = user?.section || "—";

  // ⏳ Huwag mag-render hangga't hindi pa tapos auth check
  if (!authChecked) {
    return null; // pwede ka maglagay ng loader kung gusto mo
  }

  return (
    <div>
      {/* Topnav — USER with profile */}
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
          <div className="nav-title">User Dashboard</div>
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
        {/* Sidebar — USER layout */}
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

        {/* Main content (FORM ONLY) */}
        <main
          className={`main-content ${
            !sidebarOpen ? "sidebar-collapsed" : ""
          }`}
        >
          <ErrorBoundary>
            <form onSubmit={handleSubmit} className="crime-form single">
              <h3 style={{ marginBottom: 12 }}>Create Suspect Report</h3>

              {message && (
                <div className="alert" style={{ marginBottom: 12 }}>
                  {message}
                </div>
              )}

              {/* Link to case */}
              <div className="input-group">
                <label>
                  Attach to Crime Report <span className="required">*</span>
                </label>
                <select
                  value={form.crime_report}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, crime_report: e.target.value }))
                  }
                  required
                >
                  <option value="">Select case…</option>
                  {crimes.map((cr) => (
                    <option key={cr.id} value={cr.id} title={caseLabel(cr)}>
                      {caseLabel(cr)}
                    </option>
                  ))}
                </select>
                {loadingCrimes && (
                  <small style={{ color: "#6b7280" }}>Loading cases…</small>
                )}
                {crimeErr && (
                  <small style={{ color: "#dc2626" }}>{crimeErr}</small>
                )}
              </div>

              <div className="section">
                <h3>Suspect Details</h3>
                <div className="grid">
                  <div className="input-group">
                    <label>First Name</label>
                    <input
                      value={form.s_first_name}
                      onChange={(e) =>
                        setForm({ ...form, s_first_name: e.target.value })
                      }
                    />
                  </div>
                  <div className="input-group">
                    <label>Middle Name</label>
                    <input
                      value={form.s_middle_name}
                      onChange={(e) =>
                        setForm({ ...form, s_middle_name: e.target.value })
                      }
                    />
                  </div>
                  <div className="input-group">
                    <label>Last Name</label>
                    <input
                      value={form.s_last_name}
                      onChange={(e) =>
                        setForm({ ...form, s_last_name: e.target.value })
                      }
                    />
                  </div>
                  <div className="input-group">
                    <label>Age</label>
                    <input
                      type="number"
                      value={form.s_age}
                      onChange={(e) =>
                        setForm({ ...form, s_age: e.target.value })
                      }
                    />
                  </div>
                  <div className="input-group">
                    <label>Suspect Crime Type</label>
                    <select
                      value={form.s_crime_type}
                      onChange={(e) =>
                        setForm({ ...form, s_crime_type: e.target.value })
                      }
                    >
                      <option value="">Select</option>
                      {CRIME_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="input-group">
                    <label>Suspect Photo</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={onPickSuspectPhoto}
                    />
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
                </div>
              </div>

              <PhAddressPicker
                label="Suspect Address"
                value={form.s_addr}
                onChange={setSusAddr}
                withAddressLine
              />

              {/* Crime Location Address */}
              <SimpleAddressPicker
                label="Crime Location Address"
                value={form.loc_addr}
                onChange={setLocAddr}
                withAddressLine
              />

              <div className="grid">
                <div className="input-group">
                  <label>Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={form.latitude}
                    onChange={(e) =>
                      setForm({ ...form, latitude: e.target.value })
                    }
                  />
                </div>
                <div className="input-group">
                  <label>Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={form.longitude}
                    onChange={(e) =>
                      setForm({ ...form, longitude: e.target.value })
                    }
                  />
                </div>
                <div className="input-group full">
                  <small style={{ color: "#6b7280" }}>
                    {geoMsg ||
                      "Tip: Fill the address; coordinates auto-fill (PH-bounded). You can also click/drag the marker to reverse-fill address."}
                  </small>
                </div>
              </div>

              <MiniPickerMap
                lat={Number(form.latitude)}
                lng={Number(form.longitude)}
                onChange={({ lat, lng }) => {
                  setForm((p) => ({ ...p, latitude: lat, longitude: lng }));
                }}
                onReverse={(lat, lng) => handleMarkerSet(lat, lng)}
              />

              <div className="grid" style={{ marginTop: 12 }}>
                <div className="input-group">
                  <label>Location Kind</label>
                  <select
                    value={form.loc_kind}
                    onChange={(e) =>
                      setForm({ ...form, loc_kind: e.target.value })
                    }
                  >
                    <option value="">-- Select --</option>
                    <option value="marine">Marine</option>
                    <option value="coastal">Coastal</option>
                    <option value="inland">Inland</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </div>
                <div className="input-group">
                  <label>Waterbody (optional)</label>
                  <input
                    value={form.loc_waterbody}
                    onChange={(e) =>
                      setForm({ ...form, loc_waterbody: e.target.value })
                    }
                    placeholder="e.g., Tayabas Bay"
                  />
                </div>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn"
                  onClick={() => navigate("/UserViewReport")}
                  disabled={saving}
                >
                  Back to Reports
                </button>
                <button
                  type="submit"
                  className="submit-button"
                  disabled={saving}
                >
                  <FontAwesomeIcon icon={faSave} />{" "}
                  {saving ? "Submitting…" : "Submit Suspect"}
                </button>
              </div>
            </form>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

/* Wrapper */
export default function UserSuspectReport() {
  return (
    <ErrorBoundary>
      <UserSuspectReportInner />
    </ErrorBoundary>
  );
}
