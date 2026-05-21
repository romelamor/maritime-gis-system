from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework.permissions import IsAuthenticated

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import get_user_model, authenticate
from .serializers import (
    UserRegistrationSerializer,
    UserSendCodeSerializer,
    UserVerifyCodeSerializer,
    UserResetPasswordSerializer,
)
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from .serializers import CustomTokenObtainPairSerializer

from rest_framework_simplejwt.views import TokenObtainPairView
from .serializers import (
    UserTokenObtainPairSerializer,
    AdminTokenObtainPairSerializer,
    AdminPersonnelProfileSerializer,
)

from rest_framework import generics, throttling
from .models import Region, OfficerRegistration
from .serializers import RegionSerializer

from rest_framework.throttling import UserRateThrottle

#### profile information #############
from rest_framework.decorators import action
from rest_framework import viewsets, status as drf_status, parsers
from .models import PersonnelProfile
from .serializers import PersonnelProfileSerializer, ChangePasswordSerializer

from rest_framework.filters import OrderingFilter

from django.http import JsonResponse, Http404
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import get_object_or_404
from .models import Personnel

########### crime report #############

from rest_framework import viewsets, permissions, filters, mixins
from rest_framework.parsers import MultiPartParser, FormParser
from .models import CrimeReport, Suspect

from .serializers import CrimeReportSerializer, CrimeReportMiniSerializer, SuspectSerializer

# =========================
# ADMIN FORGOT PASSWORD (OTP via Email)
# =========================
from django.conf import settings

from django.contrib.auth.hashers import make_password, check_password
from django.utils import timezone
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from .models import AdminProfile, PasswordResetOTP, EmailOTP
from .serializers import (
    SendCodeSerializer,
    VerifyCodeSerializer,
    ResetPasswordSerializer,
    ForgotSendCodeSerializer,
)
from .utils import generate_otp, otp_expiry, send_reset_email

#
###################
from datetime import timedelta
from rest_framework.permissions import IsAdminUser
from rest_framework.filters import SearchFilter, OrderingFilter
from django.core.mail import send_mail
from rest_framework_simplejwt.authentication import JWTAuthentication
from .serializers import (
    AdminOfficerRegistrationSerializer,
    PublicCreateRegistrationSerializer,
    PublicOfficerRegistrationSerializer,
    MyProfileSerializer,
    AdminPersonnelProfileSerializer,
)
from rest_framework.exceptions import NotFound, ValidationError

####################
from rest_framework.exceptions import PermissionDenied, NotFound
from django.db import transaction
import logging

############################ analytics #########################
import io
import math
from django.http import HttpResponse, JsonResponse
from django.views.decorators.http import require_GET
from django.db.models import F
from django.utils.dateparse import parse_date
from django.db.models import F, Q, Case, When, CharField
# import matplotlib

# matplotlib.use("Agg")  # headless
# import matplotlib.pyplot as plt
# import matplotlib.dates as mdates
from folium.plugins import (
    HeatMap,
    MiniMap,
    Fullscreen,
    MousePosition,
    MeasureControl,
    MarkerCluster,
)
from branca.element import MacroElement, Template
from django.views.decorators.clickjacking import xframe_options_exempt
from datetime import datetime
import pandas as pd
import numpy as np
from django.views.decorators.clickjacking import xframe_options_exempt
import folium
from folium.plugins import HeatMap

from django.contrib.auth import authenticate
from rest_framework_simplejwt.tokens import RefreshToken, AccessToken

from django.conf import settings
import logging
import secrets
import requests
from django.views.decorators.http import require_http_methods
import time
import certifi

from .serializers import AdminCreateUserSerializer

logger = logging.getLogger(__name__)

# ---------------------- Filters ----------------------
from datetime import datetime, date
from collections import defaultdict

from django.db.models import Count
from django.db.models.functions import TruncDate
from django.http import JsonResponse, HttpResponse
from django.utils.timezone import make_aware
from django.views.decorators.http import require_GET
from django.views.decorators.clickjacking import xframe_options_exempt

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

import folium




def _parse_filters(request):
    """
    GET:
      province         : matches loc_province OR v_province (iexact)
      crime_type       : exact
      status           : Ongoing|Solved|Unsolved (optional)
      date_from        : YYYY-MM-DD
      date_to          : YYYY-MM-DD
      include_archived : "1" to include archived (default exclude)
    """
    province = (request.GET.get("province") or "").strip()
    crime_type = (request.GET.get("crime_type") or "").strip()
    status = (request.GET.get("status") or "").strip()
    date_from = parse_date(request.GET.get("date_from") or "")
    date_to = parse_date(request.GET.get("date_to") or "")
    include_archived = (request.GET.get("include_archived") or "").strip() == "1"
    return province, crime_type, status, date_from, date_to, include_archived


def _filtered_qs(request):
    province, crime_type, status, date_from, date_to, include_archived = _parse_filters(
        request
    )
    qs = CrimeReport.objects.all()

    if not include_archived:
        qs = qs.filter(is_archived=False)

    if province:
        qs = qs.filter(Q(loc_province__iexact=province) | Q(v_province__iexact=province))

    if crime_type:
        qs = qs.filter(crime_type__iexact=crime_type)

    if status:
        qs = qs.filter(status__iexact=status)

    # happened_at is DateField
    if date_from:
        qs = qs.filter(happened_at__gte=date_from)
    if date_to:
        qs = qs.filter(happened_at__lte=date_to)

    return qs


# ---------- DataFrame builder ----------


def _to_dataframe(qs):
    """
    Normalized DF columns:
      date, province, crime_type, victims_count(=1/report), latitude, longitude
    Province = loc_province first, then fallback to v_province.
    """
    qs = qs.annotate(
        province_resolved=Case(
            When(loc_province__isnull=False, loc_province__gt="", then=F("loc_province")),
            default=F("v_province"),
            output_field=CharField(),
        )
    ).values(
        "happened_at",
        "crime_type",
        "latitude",
        "longitude",
        province=F("province_resolved"),
    )

    df = pd.DataFrame(list(qs))
    if df.empty:
        return pd.DataFrame(
            columns=["date", "province", "crime_type", "victims_count", "latitude", "longitude"]
        )

    df["date"] = pd.to_datetime(df["happened_at"], errors="coerce").dt.date
    df["victims_count"] = 1  # per report

    df["province"] = (
        df["province"]
        .fillna("")
        .astype(str)
        .str.replace(r"\s+\(.*?\)$", "", regex=True)
        .str.replace(r"^province of\s+", "", regex=True)
        .str.replace(r"\s+province$", "", regex=True)
        .str.strip()
    )

    df["latitude"] = pd.to_numeric(df["latitude"], errors="coerce")
    df["longitude"] = pd.to_numeric(df["longitude"], errors="coerce")

    return df[["date", "province", "crime_type", "victims_count", "latitude", "longitude"]]


# ---------- JSON series (for Chart.js in React) ----------
# =========================
# NOMINATIM PROXY (Fix CORS for React)
# =========================

NOMINATIM_BASE = "https://nominatim.openstreetmap.org"
NOMINATIM_HEADERS = {
    "User-Agent": "CRMS-PNP-Maritime-IV-A/1.0 (contact: youremail@example.com)",
    "Accept": "application/json",
    "Accept-Language": "en-US,en;q=0.9",
}

# simple in-memory cache (prevents rate limits)
_NOM_CACHE = {}
_NOM_TTL = 60 * 60  # 1 hour

def _cache_get(key):
    row = _NOM_CACHE.get(key)
    if not row:
        return None
    ts, data = row
    if time.time() - ts > _NOM_TTL:
        _NOM_CACHE.pop(key, None)
        return None
    return data

def _cache_set(key, data):
    _NOM_CACHE[key] = (time.time(), data)

def _as_json_or_error(r):
    ctype = (r.headers.get("Content-Type") or "").lower()
    # Sometimes Nominatim returns HTML (blocked/rate limited)
    if "application/json" not in ctype:
        return None, {
            "proxy_error": "nominatim_non_json",
            "status": r.status_code,
            "content_type": ctype,
            "text_head": (r.text or "")[:250],
        }
    try:
        return r.json(), None
    except Exception as e:
        return None, {
            "proxy_error": "nominatim_bad_json",
            "status": r.status_code,
            "detail": str(e),
            "text_head": (r.text or "")[:250],
        }

@csrf_exempt
@require_http_methods(["GET", "OPTIONS"])
def nominatim_search(request):
    # allow OPTIONS quickly
    if request.method == "OPTIONS":
        return JsonResponse({}, status=200)

    try:
        params = request.GET.dict()

        # defaults
        params.setdefault("format", "jsonv2")
        params.setdefault("addressdetails", "1")
        params.setdefault("limit", "5")        # IMPORTANT: more candidates = better match
        params.setdefault("countrycodes", "ph")

        # cache key
        key = "search:" + "&".join([f"{k}={params[k]}" for k in sorted(params.keys())])
        cached = _cache_get(key)
        if cached is not None:
            return JsonResponse(cached, safe=False, status=200)

        r = requests.get(
            f"{NOMINATIM_BASE}/search",
            params=params,
            headers=NOMINATIM_HEADERS,
            timeout=15,
            verify=certifi.where(),  # fixes some SSL env issues
        )

        data, err = _as_json_or_error(r)
        if err:
            # return JSON error instead of crashing
            return JsonResponse(err, status=502)

        # ensure list
        if not isinstance(data, list):
            data = []

        _cache_set(key, data)
        return JsonResponse(data, safe=False, status=200)

    except Exception as e:
        return JsonResponse({"proxy_error": "nominatim_search_failed", "detail": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET", "OPTIONS"])
def nominatim_reverse(request):
    if request.method == "OPTIONS":
        return JsonResponse({}, status=200)

    try:
        params = request.GET.dict()
        params.setdefault("format", "jsonv2")
        params.setdefault("addressdetails", "1")
        params.setdefault("zoom", "18")

        key = "reverse:" + "&".join([f"{k}={params[k]}" for k in sorted(params.keys())])
        cached = _cache_get(key)
        if cached is not None:
            return JsonResponse(cached, safe=False, status=200)

        r = requests.get(
            f"{NOMINATIM_BASE}/reverse",
            params=params,
            headers=NOMINATIM_HEADERS,
            timeout=15,
            verify=certifi.where(),
        )

        data, err = _as_json_or_error(r)
        if err:
            return JsonResponse(err, status=502)

        if not isinstance(data, dict):
            data = {}

        _cache_set(key, data)
        return JsonResponse(data, safe=False, status=200)

    except Exception as e:
        return JsonResponse({"proxy_error": "nominatim_reverse_failed", "detail": str(e)}, status=500)
@require_GET
@permission_classes([IsAuthenticated])
def analytics_series_json(request):
    qs = _filtered_qs(request)

    # ✅ IMPORTANT: avoid sqlite TruncDate errors (use happened_at__date instead)
    qs_daily = qs.exclude(happened_at__isnull=True)

    daily_qs = (
        qs_daily.values("happened_at__date")
        .annotate(c=Count("id"))
        .order_by("happened_at__date")
    )

    daily_labels = []
    daily_values = []
    for r in daily_qs:
        d = r.get("happened_at__date")
        daily_labels.append(d.strftime("%Y-%m-%d") if d else "")
        daily_values.append(int(r["c"]))

    # ✅ Counts by Province (incident location)
    prov_qs = (
        qs.values("loc_province")
        .annotate(c=Count("id"))
        .order_by("-c")
    )

    prov_labels, prov_values = [], []
    for r in prov_qs:
        name = r.get("loc_province") or "Unknown"
        prov_labels.append(str(name))
        prov_values.append(int(r["c"]))

    return JsonResponse({
        "dailyIncidents": {"labels": daily_labels, "values": daily_values},
        # keep key name for frontend compatibility
        "victimsByProvince": {"labels": prov_labels, "values": prov_values},
        "meta": {"count": int(qs.count())},
    })
# ---------- Matplotlib helpers ----------


def _fig_to_png(fig):
    buf = io.BytesIO()
    fig.savefig(buf, format="png", bbox_inches="tight", dpi=140)
    plt.close(fig)
    buf.seek(0)
    return HttpResponse(buf.getvalue(), content_type="image/png")


# ---------- LINE PNG ----------


@require_GET
def analytics_line_png(request):
    qs = _filtered_qs(request)
    df = _to_dataframe(qs).copy()

    # Params
    ma = int(request.GET.get("ma", 7))
    dofill = request.GET.get("fill", "1") in {"1", "true", "yes"}

    # Pick date column robustly
    date_col = next(
        (c for c in ["date", "incident_date", "date_reported", "created_at"] if c in df.columns),
        None,
    )

    fig, ax = plt.subplots(figsize=(11.5, 4.5))
    if date_col and not df.empty:
        df[date_col] = pd.to_datetime(df[date_col], errors="coerce")
        s = (
            df.dropna(subset=[date_col])
            .groupby(df[date_col].dt.floor("D"))
            .size()
            .rename("count")
            .to_frame()
            .sort_index()
        )

        if len(s):
            idx_full = pd.date_range(s.index.min(), s.index.max(), freq="D")
            s = s.reindex(idx_full).fillna(0.0)
            s["count"] = s["count"].astype(int)

            if ma and ma > 1:
                s["trend"] = s["count"].rolling(ma, min_periods=max(1, ma // 2)).mean()
            else:
                s["trend"] = np.nan

            ax.plot(s.index, s["count"], linewidth=1.8, label="Daily")
            if dofill:
                ax.fill_between(s.index, s["count"], alpha=0.18)

            if s["trend"].notna().any():
                ax.plot(s.index, s["trend"], linewidth=2.4, label=f"{ma}-day avg")

            for d in s.index:
                if d.weekday() >= 5:
                    ax.axvspan(d, d + pd.Timedelta(days=1), color="#e5e7eb", alpha=0.35)

            ax.set_title("Incidents per Day", loc="left", fontsize=12, fontweight="bold")
            ax.set_ylabel("Incidents")
            ax.grid(True, axis="y", linestyle=":", alpha=0.5)

            ax.xaxis.set_major_locator(mdates.AutoDateLocator(minticks=6, maxticks=10))
            ax.xaxis.set_major_formatter(
                mdates.ConciseDateFormatter(ax.xaxis.get_major_locator())
            )
            fig.autofmt_xdate()

            ax.legend(loc="upper left", bbox_to_anchor=(1.01, 1.0), borderaxespad=0.0)
            fig.tight_layout()
        else:
            ax.text(0.5, 0.5, "No data", ha="center", va="center", fontsize=14)
            ax.axis("off")
    else:
        ax.text(0.5, 0.5, "No data", ha="center", va="center", fontsize=14)
        ax.axis("off")

    return _fig_to_png(fig)


# ---------- BAR PNG ----------


@require_GET
def analytics_bar_png(request):
    qs = _filtered_qs(request)
    df = _to_dataframe(qs).copy()

    top_n = int(request.GET.get("top", 20))
    metric = request.GET.get("metric", "victims").lower()
    as_pct = request.GET.get("percent", "0") in {"1", "true", "yes"}
    with_others = request.GET.get("others", "1") in {"1", "true", "yes"}

    fig, ax = plt.subplots(figsize=(9.5, 8.0))

    if not df.empty:
        prov_col = "province" if "province" in df.columns else None
        if not prov_col:
            ax.text(0.5, 0.5, "No province column", ha="center", va="center", fontsize=14)
            ax.axis("off")
            return _fig_to_png(fig)

        s = None
        if metric == "incidents":
            s = (
                df[df[prov_col].astype(str).str.len() > 0]
                .groupby(prov_col)
                .size()
                .rename("value")
            )
            title = "Incidents by Province"
            xlab = "Incidents"
        else:
            vic_col = (
                "victims_count"
                if "victims_count" in df.columns
                else ("victims" if "victims" in df.columns else None)
            )
            if not vic_col:
                s = (
                    df[df[prov_col].astype(str).str.len() > 0]
                    .groupby(prov_col)
                    .size()
                    .rename("value")
                )
                title = "Incidents by Province"
                xlab = "Incidents"
            else:
                s = (
                    df[df[prov_col].astype(str).str.len() > 0]
                    .groupby(prov_col)[vic_col]
                    .sum()
                    .rename("value")
                )
                title = "Victims by Province"
                xlab = "Victims"

        s = s.sort_values(ascending=False)
        total = float(s.sum()) if len(s) else 0.0

        if top_n > 0:
            top = s.head(top_n)
            if with_others and len(s) > top_n:
                top.loc["Others"] = s.iloc[top_n:].sum()
            s = top

        if len(s):
            if as_pct and total > 0:
                vals = (s / total * 100.0).round(2)
                ax.barh(s.index, vals)
                ax.set_xlabel(f"{xlab} (%)")
                for i, (name, v) in enumerate(vals.items()):
                    ax.text(v, i, f" {v:.2f}%", va="center")
                ax.set_xlim(0, max(100, float(vals.max()) * 1.08))
                title += " (Percentage of total)"
            else:
                ax.barh(s.index, s.values)
                ax.set_xlabel(xlab)
                for i, v in enumerate(s.values):
                    ax.text(v, i, f" {int(v)}", va="center")
                ax.set_xlim(0, float(s.max()) * 1.08 if len(s) else 1)

            ax.invert_yaxis()
            ax.set_title(
                f"{title} (Top {top_n})"
                if "Others" not in s.index
                else f"{title} (Top {top_n} + Others)"
            )
            ax.grid(axis="x", linestyle=":", alpha=0.4)
            fig.tight_layout()
        else:
            ax.text(0.5, 0.5, "No data", ha="center", va="center", fontsize=14)
            ax.axis("off")
    else:
        ax.text(0.5, 0.5, "No data", ha="center", va="center", fontsize=14)
        ax.axis("off")

    return _fig_to_png(fig)


# ---------- Folium Heatmap (HTML) ----------


@xframe_options_exempt
def analytics_heatmap_html(request):
    qs = _filtered_qs(request)
    df = _to_dataframe(qs)

    ph_center = [12.8797, 121.7740]
    m = folium.Map(
        location=ph_center, tiles="OpenStreetMap", zoom_start=6, control_scale=True
    )

    def g(row, key, default=""):
        val = row.get(key)
        return "" if pd.isna(val) else str(val) if val is not None else default

    def fmt_date(s):
        if not s or pd.isna(s):
            return ""
        try:
            for fmt in ("%Y-%m-%d", "%Y-%m-%d %H:%M:%S", "%m/%d/%Y", "%d-%m-%Y"):
                try:
                    return datetime.strptime(str(s), fmt).strftime("%Y-%m-%d")
                except Exception:
                    pass
            return str(s)
        except Exception:
            return str(s)

    pts = []
    if not df.empty:
        for _, r in df.iterrows():
            lat, lon = r.get("latitude"), r.get("longitude")
            if pd.notna(lat) and pd.notna(lon):
                try:
                    lat = float(lat)
                    lon = float(lon)
                except Exception:
                    continue
                w = (
                    2.0
                    if str(r.get("crime_type", "")).strip().lower() == "homicide"
                    else 1.0
                )
                pts.append([lat, lon, w])

    if pts:
        HeatMap(
            pts,
            radius=25,
            blur=12,
            max_zoom=6,
            min_opacity=0.25,
            gradient={
                0.0: "#1e3a8a",
                0.2: "#22d3ee",
                0.4: "#10b981",
                0.6: "#fde047",
                0.8: "#f97316",
                1.0: "#dc2626",
            },
        ).add_to(m)

        lats = [p[0] for p in pts]
        lons = [p[1] for p in pts]
        try:
            m.fit_bounds(
                [[min(lats), min(lons)], [max(lats), max(lons)]], padding=(20, 20)
            )
        except Exception:
            pass

    if not df.empty:
        USE_CLUSTER = True
        MAX_MARKERS = 1500

        marker_parent = folium.FeatureGroup(name="Details (hover)", show=True)
        if USE_CLUSTER:
            marker_parent = MarkerCluster(
                name="Details (hover)", show=True, disableClusteringAtZoom=12
            )

        df_markers = df
        if len(df) > MAX_MARKERS:
            df_markers = df.sample(n=MAX_MARKERS, random_state=7)

        for _, r in df_markers.iterrows():
            lat, lon = r.get("latitude"), r.get("longitude")
            if pd.isna(lat) or pd.isna(lon):
                continue
            try:
                lat = float(lat)
                lon = float(lon)
            except Exception:
                continue

            crime = g(r, "crime_type", "—")
            province = g(r, "province", "")
            city = g(r, "city", "") or g(r, "municipality", "")
            brgy = g(r, "barangay", "")
            when = fmt_date(
                g(r, "incident_date", "") or g(r, "date_reported", "")
            )
            victims = g(r, "victims_count", "") or g(r, "victim_count", "")
            status_txt = g(r, "status", "")

            tooltip_text = f"{crime or 'Incident'}"
            if when:
                tooltip_text += f" · {when}"
            if city or province:
                locbits = ", ".join([b for b in [brgy, city, province] if b])
                if locbits:
                    tooltip_text += f" · {locbits}"

            popup_html = f"""
            <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; font-size: 12px;">
              <div style="font-weight:700; font-size: 13px; margin-bottom: 4px;">{crime or 'Incident'}</div>
              <div><b>Date:</b> {when or '—'}</div>
              <div><b>Location:</b> {", ".join([b for b in [brgy, city, province] if b]) or '—'}</div>
              {"<div><b>Victims:</b> " + victims + "</div>" if victims else ""}
              {"<div><b>Status:</b> " + status_txt + "</div>" if status_txt else ""}
              <div style="margin-top:6px; opacity:0.8;">(Hover tooltip is available on map)</div>
            </div>
            """

            folium.CircleMarker(
                location=(lat, lon),
                radius=5,
                color="#ffffff",
                weight=1,
                fill=True,
                fill_opacity=0.9,
                fill_color="#0ea5e9",
                tooltip=folium.Tooltip(tooltip_text, sticky=False),
                popup=folium.Popup(popup_html, max_width=280),
            ).add_to(marker_parent)

        marker_parent.add_to(m)

    MiniMap(toggle_display=True, minimized=True).add_to(m)
    Fullscreen(
        position="topright", title="Full Screen", title_cancel="Exit Full Screen"
    ).add_to(m)
    MousePosition(
        position="bottomright",
        separator=" | ",
        prefix="Lat/Lon",
        num_digits=5,
    ).add_to(m)
    MeasureControl(position="topright", primary_length_unit="kilometers").add_to(m)

    folium.LayerControl(collapsed=True).add_to(m)

    legend = Template(
        """
    {% macro html(this, kwargs) %}
    <div style="
      position: fixed;
      bottom: 20px;
      right: 10px;
      z-index: 9999;
      background: rgba(255,255,255,0.92);
      padding: 8px 10px;
      border-radius: 6px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      font-size: 12px; color: #111827;
    ">
      <div style="font-weight:700; margin-bottom:4px;">Density</div>
      <div style="
        width: 220px; height: 10px; border-radius: 6px; border: 1px solid rgba(0,0,0,0.2);
        background: linear-gradient(90deg, #1e3a8a, #22d3ee, #10b981, #fde047, #f97316, #dc2626);
      "></div>
      <div style="display:flex; justify-content:space-between; font-size:11px; opacity:.85; margin-top:2px;">
        <span>Low</span><span>High</span>
      </div>
    </div>
    {% endmacro %}
    """
    )
    macro = MacroElement()
    macro._template = legend
    m.get_root().add_child(macro)

    html = m.get_root().render()
    return HttpResponse(html, content_type="text/html; charset=utf-8")


def try_email(**kwargs):
    try:
        email(**kwargs)
    except Exception as e:
        logger.exception("Email send failed: %s", e)


def email(subject: str, message: str, to_email: str):
    send_mail(
        subject=subject,
        message=message,
        from_email=getattr(settings, "DEFAULT_FROM_EMAIL", None),
        recipient_list=[to_email],
        fail_silently=False,
    )


class PublicRegistrationViewSet(viewsets.GenericViewSet):
    """
    POST /api/registrations/  -> gumawa ng pending record (public endpoint)
    """

    queryset = OfficerRegistration.objects.all()
    serializer_class = PublicCreateRegistrationSerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        ser = self.get_serializer(data=request.data)
        ser.is_valid(raise_exception=True)
        obj = ser.save()
        data = AdminOfficerRegistrationSerializer(
            obj, context={"request": request}
        ).data
        return Response(data, status=status.HTTP_201_CREATED)


class AdminOfficerRegistrationViewSet(viewsets.ReadOnlyModelViewSet):
    """
    GET  /api/admin/verification/registrations/?status=pending|approved&search=&ordering=-submitted_at
    POST /api/admin/verification/registrations/<id>/approve/
    POST /api/admin/verification/registrations/<id>/reject/
    POST /api/admin/verification/registrations/<id>/request-info/
    POST /api/admin/verification/registrations/<id>/extend/?days=7
    """

    authentication_classes = [JWTAuthentication]
    serializer_class = AdminOfficerRegistrationSerializer
    permission_classes = [IsAdminUser]
    queryset = OfficerRegistration.objects.all()
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ["email", "badge_no", "first_name", "last_name"]
    ordering_fields = ["submitted_at"]

    def get_queryset(self):
        qs = super().get_queryset()
        status_param = (self.request.query_params.get("status") or "").lower().strip()
        if status_param == "approved":
            return qs.filter(
                verification_status=OfficerRegistration.STATUS_APPROVED
            )
        elif status_param == "pending":
            return qs.exclude(
                verification_status=OfficerRegistration.STATUS_APPROVED
            )
        return qs

    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, pk=None):
        reg = self.get_object()
        reg.verification_status = OfficerRegistration.STATUS_APPROVED
        reg.verified_at = timezone.now()
        reg.reviewed_by = request.user
        reg.save(update_fields=["verification_status", "verified_at", "reviewed_by"])

        if reg.user and not reg.user.is_active:
            reg.user.is_active = True
            reg.user.save(update_fields=["is_active"])

        login_url = getattr(settings, "FRONTEND_LOGIN_URL", "http://localhost:5173/login")
        email(
            subject="Your account is verified",
            message=(
                f"Hi {reg.first_name},\n\nYour account has been verified.\n"
                f"Login here: {login_url}\n\n— PNP Maritime"
            ),
            to_email=reg.email,
        )
        return Response({"detail": "Approved and user activated."})

    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request, pk=None):
        reg = self.get_object()
        reason = (request.data.get("note") or "").strip()
        reg.verification_status = OfficerRegistration.STATUS_REJECTED
        reg.rejection_reason = reason
        reg.reviewed_by = request.user
        reg.save(
            update_fields=["verification_status", "rejection_reason", "reviewed_by"]
        )

        if reg.user:
            reg.user.is_active = False
            reg.user.save(update_fields=["is_active"])

        email(
            subject="Your registration was rejected",
            message=(
                f"Hi {reg.first_name},\n\nYour registration was rejected.\n"
                f"Reason: {reason or 'Not specified.'}\n\n— PNP Maritime"
            ),
            to_email=reg.email,
        )
        return Response({"detail": "Rejected and user remains inactive."})

    @action(detail=True, methods=["post"], url_path="request-info")
    def request_info(self, request, pk=None):
        reg = self.get_object()
        note = (request.data.get("note") or "").strip()
        reg.verification_status = OfficerRegistration.STATUS_REQUEST_INFO
        reg.request_note = note
        reg.reviewed_by = request.user
        reg.save(
            update_fields=["verification_status", "request_note", "reviewed_by"]
        )

        email(
            subject="Additional information required",
            message=(
                f"Hi {reg.first_name},\n\nPlease provide the following information:\n"
                f"{note or '—'}\n\n— PNP Maritime"
            ),
            to_email=reg.email,
        )
        return Response({"detail": "Requested info and notified."})

    @action(detail=True, methods=["post"], url_path="extend")
    def extend(self, request, pk=None):
        reg = self.get_object()
        try:
            days = int(request.query_params.get("days", "7"))
        except ValueError:
            days = 7
        reg.expires_at = (reg.expires_at or timezone.now()) + timedelta(days=days)
        reg.save(update_fields=["expires_at"])
        return Response(
            {"detail": f"Extended by {days} days.", "expires_at": reg.expires_at}
        )
    
@require_GET
def analytics_breakdown_json(request):
    qs = _filtered_qs(request)
    df = _to_dataframe(qs)

    def pack(col):
        if df.empty or col not in df.columns:
            return {"labels": [], "values": []}
        s = (
            df[df[col].astype(str).str.len() > 0]
            .groupby(col)
            .size()
            .sort_values(ascending=False)
        )
        return {"labels": s.index.tolist(), "values": s.tolist()}

    # IMPORTANT: use columns that exist in your DF.
    # From your heatmap code, you have: province, barangay, crime_type, status, city or municipality :contentReference[oaicite:2]{index=2}
    by_city = None
    for c in ["city", "municipality", "city_municipality"]:
        if c in df.columns:
            by_city = c
            break

    payload = {
        "meta": {"count": int(len(df))},
        "byCrimeType": pack("crime_type"),
        "byStatus": pack("status"),
        "byCity": pack(by_city) if by_city else {"labels": [], "values": []},
        "byBarangay": pack("barangay"),
    }
    return JsonResponse(payload)



# ---------- helpers ----------
def _parse_date(s: str):
    """Accepts YYYY-MM-DD. Returns date or None."""
    if not s:
        return None
    try:
        return datetime.strptime(s, "%Y-%m-%d").date()
    except Exception:
        return None


def _filtered_qs(request):
    """
    IMPORTANT: Use incident location fields (loc_*), not victim address (v_*),
    and use happened_at for date filtering.
    """
    qs = CrimeReport.objects.filter(is_archived=False)

    province = (request.GET.get("province") or "").strip()
    crime_type = (request.GET.get("crime_type") or "").strip()
    date_from = _parse_date((request.GET.get("date_from") or "").strip())
    date_to = _parse_date((request.GET.get("date_to") or "").strip())

    if province:
        qs = qs.filter(loc_province__iexact=province)

    if crime_type:
        qs = qs.filter(crime_type__iexact=crime_type)

    # ✅ FIX: DateField na si happened_at, no need __date
    if date_from:
        qs = qs.filter(happened_at__gte=date_from)

    if date_to:
        qs = qs.filter(happened_at__lte=date_to)

    return qs


def _pack_from_qs(qs, field_name, top_n=None):
    """
    Returns {"labels":[...], "values":[...]} sorted desc by count.
    """
    rows = (
        qs.values(field_name)
        .annotate(c=Count("id"))
        .order_by("-c")
    )
    if top_n:
        rows = rows[:top_n]

    labels, values = [], []
    for r in rows:
        key = r.get(field_name)
        if key is None or str(key).strip() == "":
            key = "Unknown"
        labels.append(str(key))
        values.append(int(r["c"]))
    return {"labels": labels, "values": values}


# ---------- JSON: SERIES ----------
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def analytics_series_json(request):
    qs = _filtered_qs(request)

    # Daily trend (DateField safe for SQLite)
    qs_daily = qs.exclude(happened_at__isnull=True)

    daily_qs = (
        qs_daily.values("happened_at")
        .annotate(c=Count("id"))
        .order_by("happened_at")
    )

    daily_labels, daily_values = [], []
    for r in daily_qs:
        d = r.get("happened_at")  # DateField -> date object
        daily_labels.append(d.strftime("%Y-%m-%d") if d else "")
        daily_values.append(int(r["c"]))

    # Province counts (incident location)
    prov_qs = (
        qs.values("loc_province")
        .annotate(c=Count("id"))
        .order_by("-c")
    )

    prov_labels, prov_values = [], []
    for r in prov_qs:
        name = r.get("loc_province") or "Unknown"
        prov_labels.append(str(name))
        prov_values.append(int(r["c"]))

    return JsonResponse({
        "dailyIncidents": {"labels": daily_labels, "values": daily_values},
        "victimsByProvince": {"labels": prov_labels, "values": prov_values},
        "meta": {"count": int(qs.count())},
    })

# ---------- JSON: BREAKDOWN (Pie + insights) ----------
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def analytics_breakdown_json(request):
    """
    FE expects:
      byCrimeType: {labels,values}
      byStatus: {labels,values}
      byCity: {labels,values}
      meta: {count:int}
    """
    qs = _filtered_qs(request)

    by_crime = _pack_from_qs(qs, "crime_type")
    by_status = _pack_from_qs(qs, "status")
    by_city = _pack_from_qs(qs, "loc_city_municipality")

    payload = {
        "meta": {"count": int(qs.count())},
        "byCrimeType": by_crime,
        "byStatus": by_status,
        "byCity": by_city,
    }
    return JsonResponse(payload)


# ---------- HTML: HEATMAP (iframe) ----------
@require_GET
@xframe_options_exempt
def analytics_heatmap_html(request):
    """
    Returns an HTML map. (iframe-friendly)
    NOTE: This is NOT DRF, so JWT header won't apply in iframe.
    Keep it unprotected or switch to session auth if needed.
    """
    qs = _filtered_qs(request).exclude(latitude__isnull=True).exclude(longitude__isnull=True)

    # Default center (Philippines)
    center = [12.8797, 121.7740]
    m = folium.Map(location=center, tiles="OpenStreetMap", zoom_start=6, control_scale=True)

    pts = []
    for r in qs.values("latitude", "longitude"):
        lat = r.get("latitude")
        lon = r.get("longitude")
        if lat is None or lon is None:
            continue
        try:
            pts.append([float(lat), float(lon)])
        except Exception:
            pass

    if pts:
        HeatMap(
            pts,
            radius=18,
            blur=16,
            min_opacity=0.25,
        ).add_to(m)

        # auto-fit
        m.fit_bounds(pts)

    return HttpResponse(m.get_root().render(), content_type="text/html")


User = get_user_model()

# Tunable knobs
USER_OTP_TTL_MIN = 10
USER_RESEND_COOLDOWN_SEC = 60

GENERIC_MSG = {"message": "If the email exists, we sent an OTP to it."}


class SendResetCodeView(APIView):
    """Step 1: Admin requests an OTP for password reset."""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = SendCodeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]

        user = User.objects.filter(email__iexact=email, is_staff=True).first()

        if not user:
            return Response(GENERIC_MSG)

        profile, _ = AdminProfile.objects.get_or_create(user=user)

        code = generate_otp()
        profile.reset_code_hash = make_password(code)
        profile.code_expiry = otp_expiry()
        profile.save(update_fields=["reset_code_hash", "code_expiry"])

        try:
            send_reset_email(user.email, user.get_username(), code)
        except Exception as e:
            if settings.DEBUG:
                return Response({"error": f"Email send failed: {e}"}, status=500)
            return Response(GENERIC_MSG)

        if settings.DEBUG:
            return Response({"message": "OTP generated (DEV)", "dev_code": code})

        return Response(GENERIC_MSG)


class VerifyResetCodeView(APIView):
    """Step 2: Verify OTP sent to admin email."""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = VerifyCodeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]
        code = serializer.validated_data["code"]

        user = User.objects.filter(email__iexact=email, is_staff=True).first()
        if not user:
            return Response({"error": "Invalid or expired code"}, status=400)

        profile = getattr(user, "admin_profile", None)
        if not profile or not profile.reset_code_hash or not profile.code_expiry:
            return Response({"error": "Invalid or expired code"}, status=400)

        if timezone.now() >= profile.code_expiry:
            return Response({"error": "Invalid or expired code"}, status=400)

        if not check_password(code, profile.reset_code_hash):
            return Response({"error": "Invalid or expired code"}, status=400)

        return Response({"message": "OK"})


class ResetPasswordView(APIView):
    """Step 3: Reset password after OTP verification."""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]
        code = serializer.validated_data["code"]
        new_password = serializer.validated_data["new_password"]

        user = User.objects.filter(email__iexact=email, is_staff=True).first()
        if not user:
            return Response({"error": "Invalid or expired code"}, status=400)

        profile = getattr(user, "admin_profile", None)
        if not profile or not profile.reset_code_hash or not profile.code_expiry:
            return Response({"error": "Invalid or expired code"}, status=400)

        if timezone.now() >= profile.code_expiry:
            return Response({"error": "Invalid or expired code"}, status=400)

        if not check_password(code, profile.reset_code_hash):
            return Response({"error": "Invalid or expired code"}, status=400)

        user.set_password(new_password)
        user.save(update_fields=["password"])

        profile.reset_code_hash = None
        profile.code_expiry = None
        profile.save(update_fields=["reset_code_hash", "code_expiry"])

        return Response({"message": "Password updated"})


User = get_user_model()


class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["username"] = user.username
        return token


class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["is_admin"] = getattr(user, "is_admin", False)
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data["is_admin"] = getattr(self.user, "is_admin", False)
        return data


class MyTokenObtainPairView(TokenObtainPairView):
    serializer_class = MyTokenObtainPairSerializer


class RegisterView(APIView):
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request):
        serializer = UserRegistrationSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response({"message": "User registered successfully."}, status=201)
        return Response(serializer.errors, status=400)


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["username"] = user.username
        token["is_staff"] = user.is_staff
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data["username"] = self.user.username
        data["is_staff"] = self.user.is_staff
        return data


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


class LoginView(APIView):
    throttle_classes = [UserRateThrottle]

    def post(self, request):
        username = request.data.get("username")
        password = request.data.get("password")

        user = authenticate(username=username, password=password)

        if user is not None:
            refresh = RefreshToken.for_user(user)
            return Response(
                {
                    "refresh": str(refresh),
                    "access": str(refresh.access_token),
                    "is_admin": user.is_staff,
                }
            )
        else:
            return Response({"error": "Invalid credentials"}, status=401)


class UserLoginView(APIView):
    """
    POST /api/user/login/
    Admin-only creation: no OfficerRegistration required.
    """

    def post(self, request, *args, **kwargs):
        username = (request.data.get("username") or "").strip()
        password = request.data.get("password") or ""

        user = authenticate(username=username, password=password)
        if user is None:
            return Response({"detail": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)

        if getattr(user, "is_staff", False) or getattr(user, "is_admin", False):
            return Response({"detail": "Admins cannot login here."}, status=status.HTTP_403_FORBIDDEN)

        if not user.is_active:
            return Response(
                {"detail": "Your account is not active. Please contact the administrator."},
                status=status.HTTP_403_FORBIDDEN,
            )

        refresh = RefreshToken.for_user(user)
        return Response(
            {"refresh": str(refresh), "access": str(refresh.access_token), "is_admin": False},
            status=status.HTTP_200_OK,
        )
class UserLoginOTPInitView(APIView):
    """
    STEP 1: username + password
    ✅ Admin-only creation flow:
      - Check creds
      - Block admins
      - Require is_active=True
      - Require email
      - Send OTP
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        username = (request.data.get("username") or "").strip()
        password = request.data.get("password") or ""

        user = authenticate(username=username, password=password)
        if user is None:
            return Response(
                {"detail": "Invalid credentials"},
                status=status.HTTP_401_UNAUTHORIZED
            )

        # bawal admin sa user portal
        if getattr(user, "is_staff", False) or getattr(user, "is_admin", False):
            return Response(
                {"detail": "Admins cannot login here."},
                status=status.HTTP_403_FORBIDDEN
            )

        # kailangan active
        if not user.is_active:
            return Response(
                {"detail": "Your account is not active. Please contact the administrator."},
                status=status.HTTP_403_FORBIDDEN
            )

        # kailangan may email
        if not user.email:
            return Response(
                {"detail": "This account has no email address on file. Please contact the administrator."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # gumawa ng OTP (keep your existing helper)
        otp = _create_user_login_otp(user)

        # send email
        try:
            send_mail(
                subject="Your Login Code",
                message=(
                    f"Your login code is: {otp.code}\n"
                    f"This code will expire in {USER_LOGIN_OTP_TTL_MIN} minutes."
                ),
                from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@example.com"),
                recipient_list=[user.email],
                fail_silently=False,
            )
        except Exception:
            pass

        return Response(
            {
                "requires_otp": True,
                "user_id": user.id,
                "detail": "An OTP has been sent to your email address.",
            },
            status=status.HTTP_200_OK
        )
    
class UserLoginOTPVerifyView(APIView):
    """
    STEP 2: User enters OTP code.
    Body: { "user_id": 1, "code": "123456" }
    Success: returns JWT tokens (access + refresh)
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        user_id = request.data.get("user_id")
        code = (request.data.get("code") or "").strip()

        # basic validation
        try:
            user_id = int(user_id)
        except (TypeError, ValueError):
            return Response({"detail": "Invalid user_id"}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.filter(id=user_id).first()
        if not user:
            return Response({"detail": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        # bawal admin
        if getattr(user, "is_staff", False) or getattr(user, "is_admin", False):
            return Response({"detail": "Admins cannot login here."}, status=status.HTTP_403_FORBIDDEN)

        # hanapin OTP
        otp = (
            EmailOTP.objects.filter(
                user=user,
                code=code,
                purpose="user_login",
                is_used=False,
            )
            .order_by("-created_at")
            .first()
        )

        if not otp or timezone.now() > otp.expires_at:
            return Response({"detail": "Invalid or expired code"}, status=status.HTTP_400_BAD_REQUEST)

        # mark as used
        otp.is_used = True
        otp.save(update_fields=["is_used"])

        # issue tokens
        refresh = RefreshToken.for_user(user)

        return Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "is_admin": False,
            },
            status=status.HTTP_200_OK,
        )

class AdminLoginView(TokenObtainPairView):
    def post(self, request, *args, **kwargs):
        username = request.data.get("username")
        password = request.data.get("password")

        user = authenticate(username=username, password=password)

        if user is None:
            return Response(
                {"detail": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED
            )

        if not user.is_staff:
            return Response(
                {"detail": "Only admin accounts can log in here."},
                status=status.HTTP_403_FORBIDDEN,
            )

        response = super().post(request, *args, **kwargs)
        data = response.data
        data["is_staff"] = user.is_staff
        return Response(data)


############# profile information #############


class PersonnelProfileViewSet(viewsets.ModelViewSet):
    queryset = PersonnelProfile.objects.all()
    serializer_class = PersonnelProfileSerializer
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ["is_archived"]
    ordering_fields = ["created_at", "id"]
    ordering_fields = ["first_name", "last_name", "created_at"]

    @action(detail=True, methods=["post"])
    def archive(self, request, pk=None):
        profile = self.get_object()

        # ✅ archive profile
        profile.is_archived = True
        profile.save(update_fields=["is_archived"])

        # 🔥 ADD THIS (IMPORTANT)
        if profile.user:
            profile.user.is_active = False
            profile.user.save(update_fields=["is_active"])

        return Response({
            "status": "archived",
            "user_deactivated": True
        })
    
    @action(detail=True, methods=["post"])
    def unarchive(self, request, pk=None):
        profile = self.get_object()

        profile.is_archived = False
        profile.save(update_fields=["is_archived"])

        # 🔥 ALWAYS FIND USER
        user = None

        if profile.user:
            user = profile.user
        else:
            user = Personnel.objects.filter(
                badge_number=profile.officer_id
            ).first()

        if user:
            user.is_active = True
            user.save(update_fields=["is_active"])
            print("USER ACTIVATED:", user.username)
        else:
            print("NO USER FOUND")

        return Response({
            "status": "unarchived",
            "user_activated": bool(user)
        })
    def destroy(self, request, *args, **kwargs):
        profile = self.get_object()

        user = profile.user  # kunin muna bago delete

        # ✅ delete profile
        response = super().destroy(request, *args, **kwargs)

        # 🔥 IMPORTANT: delete user account
        if user:
            user.delete()

        return response

class RegionListAPIView(generics.ListAPIView):
    queryset = Region.objects.all()
    serializer_class = RegionSerializer


@csrf_exempt
def archive_personnel(request, pk):
    if request.method == "POST":
        personnel = get_object_or_404(Personnel, pk=pk)
        personnel.is_active = False
        personnel.save()
        return JsonResponse({"message": "Personnel archived successfully"})
    else:
        raise Http404("Only POST method is allowed")


################### crime report ####################


class CrimeReportViewSet(viewsets.ModelViewSet):
    queryset = CrimeReport.objects.all().order_by("-created_at")
    serializer_class = CrimeReportSerializer
    permission_classes = [IsAuthenticated]
    from rest_framework.parsers import JSONParser, FormParser, MultiPartParser

    parser_classes = [JSONParser, FormParser, MultiPartParser]

    from rest_framework import filters as drf_filters   

    filter_backends = [drf_filters.OrderingFilter, drf_filters.SearchFilter]
    ordering_fields = ["created_at", "happened_at", "id"]
    ordering = ["-created_at"]
    search_fields = ["crime_type", "v_first_name", "v_middle_name", "v_last_name"]

    def get_queryset(self):
        qs = super().get_queryset()
        flag = self.request.query_params.get("is_archived")
        if flag is not None:
            true_vals = {"true", "1", "yes", "t", "on"}
            qs = qs.filter(is_archived=(flag.lower() in true_vals))
        return qs
    
     # ✅ ADD THIS (ITO ANG KULANG MO)
    def perform_create(self, serializer):
        print("🔥 CURRENT USER:", self.request.user)  # 👈 ADD THIS
        user = self.request.user
        # ✅ kunin reporting person mula sa request
        rp_first = self.request.data.get("rp_first_name", "")
        rp_last = self.request.data.get("rp_last_name", "")

        instance = serializer.save(
            prepared_by=user,
            reported_by=f"{rp_first} {rp_last}".strip()
        )
        instance.desk_officer = user
        instance.save()

    def perform_update(self, serializer):
        serializer.save(
            desk_officer=self.request.user  # 👈 admin na ito
        )
    


class SuspectViewSet(viewsets.ModelViewSet):
    """
    Full CRUD for suspects (separate from CrimeReport).
    """

    queryset = Suspect.objects.select_related("crime_report").all().order_by(
        "-created_at"
    )
    serializer_class = SuspectSerializer
    permission_classes = [permissions.AllowAny]
    parser_classes = [MultiPartParser, FormParser]
    filter_backends = [filters.OrderingFilter, filters.SearchFilter]
    ordering_fields = ["created_at"]
    search_fields = [
        "s_first_name",
        "s_middle_name",
        "s_last_name",
        "s_barangay",
        "s_city_municipality",
        "s_province",
        "loc_barangay",
        "loc_city_municipality",
        "loc_province",
    ]

    @action(detail=True, methods=["post"], url_path="archive")
    def archive(self, request, pk=None):
        obj = self.get_object()
        obj.is_archived = True
        obj.save(update_fields=["is_archived", "updated_at"])
        return Response({"status": "archived"}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="unarchive")
    def unarchive(self, request, pk=None):
        obj = self.get_object()
        obj.is_archived = False
        obj.save(update_fields=["is_archived", "updated_at"])
        return Response({"status": "unarchived"}, status=status.HTTP_200_OK)


class CrimeReportListCreateView(generics.ListCreateAPIView):
    queryset = CrimeReport.objects.all()
    serializer_class = CrimeReportSerializer
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        print("🔥 CURRENT USER (LIST VIEW):", self.request.user)

        user = self.request.user

        instance = serializer.save(
            prepared_by=user,
            desk_officer=user
        )

    def perform_create(self, serializer):
        user = self.request.user

        instance = serializer.save(
            prepared_by=user,
            desk_officer=user
    )


class SuspectListCreateView(generics.ListCreateAPIView):
    queryset = Suspect.objects.all()
    serializer_class = SuspectSerializer
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]


class MeView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        u = request.user
        return Response(
            {
                "id": getattr(u, "id", None),
                "email": getattr(u, "email", ""),
                "username": getattr(u, "username", ""),
                "is_authenticated": bool(getattr(u, "is_authenticated", False)),
                "is_staff": bool(getattr(u, "is_staff", False)),
                "is_superuser": bool(getattr(u, "is_superuser", False)),
            }
        )


class MeProfileView(generics.RetrieveUpdateAPIView):
    """
    GET  /api/personnel/me/   -> basahin ang profile ng current user
    PATCH/PUT (multipart)     -> i-update ng user (o admin kung gusto)
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = PersonnelProfileSerializer
    parser_classes = (MultiPartParser, FormParser)

    def get_object(self):
        user = self.request.user

        profile, created = PersonnelProfile.objects.get_or_create(
            user=user,
            defaults={
                "officer_id": getattr(user, "badge_number", "") or f"USER-{user.pk}",
                "first_name": getattr(user, "first_name", "") or "",
                "middle_name": getattr(user, "middle_name", "") or "",
                "last_name": getattr(user, "last_name", "") or "",
                "email": getattr(user, "email", "") or "",
                "section": getattr(user, "section", "")
                if hasattr(user, "section")
                else "",
            },
        )

        if profile.is_archived and self.request.method in ("PUT", "PATCH"):
            self.permission_denied(self.request, message="Account archived")

        return profile


class PublicOfficerRegistrationViewSet(mixins.CreateModelMixin, viewsets.GenericViewSet):
    """
    POST /api/registrations/  (multipart/form-data)
    """

    queryset = OfficerRegistration.objects.all()
    serializer_class = PublicOfficerRegistrationSerializer
    permission_classes = [permissions.AllowAny]
    parser_classes = [MultiPartParser, FormParser]


class IsStaffOrIsAdminBool(permissions.BasePermission):
    """
    Allow if user.is_staff OR custom Personnel.is_admin = True
    """

    def has_permission(self, request, view):
        u = request.user
        return bool(
            u and (getattr(u, "is_staff", False) or getattr(u, "is_admin", False))
        )


class MyProfileView(generics.RetrieveUpdateAPIView):
    """
    GET  /api/me/profile/
    PATCH/PUT /api/me/profile/
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = MyProfileSerializer
    parser_classes = (
        parsers.JSONParser,
        parsers.FormParser,
        parsers.MultiPartParser,
    )

    def _defaults_from_user(self, user: Personnel):
        officer_id = user.badge_number or f"USER-{user.pk}"
        defaults = {
            "officer_id": officer_id,
            "first_name": user.first_name or "",
            "middle_name": "",
            "last_name": user.last_name or "",
            "suffix": "",
            "email": user.email or "",
            "phone": "",
            "department": "",
            "section": "",
            "residential_address": "",
            "residential_barangay": "",
            "residential_municipality": "",
            "residential_province": "",
            "residential_region": "",
        }

        reg = (
            OfficerRegistration.objects.filter(user=user)
            .order_by("-submitted_at")
            .first()
            or (
                OfficerRegistration.objects.filter(email=user.email)
                .order_by("-submitted_at")
                .first()
                if user.email
                else None
            )
        )
        if reg:
            defaults.update(
                {
                    "officer_id": reg.badge_no or defaults["officer_id"],
                    "first_name": reg.first_name or defaults["first_name"],
                    "middle_name": reg.middle_name or "",
                    "last_name": reg.last_name or defaults["last_name"],
                    "email": reg.email or defaults["email"],
                    "department": reg.rank or "",
                    "section": reg.station or "",
                    "residential_address": reg.address or "",
                }
            )
        return defaults

    def _assert_not_archived(self, user: Personnel, profile: PersonnelProfile | None):
        if hasattr(user, "is_active") and not user.is_active:
            raise PermissionDenied(detail={"detail": "Account archived", "code": "ARCHIVED"})
        if profile and getattr(profile, "is_archived", False):
            raise PermissionDenied(detail={"detail": "Account archived", "code": "ARCHIVED"})

    def get_object(self):
        user = self.request.user

        profile = None
        if hasattr(PersonnelProfile, "user"):
            profile = PersonnelProfile.objects.filter(user=user).first()
            if profile:
                self._assert_not_archived(user, profile)
                return profile

        officer_id = user.badge_number or f"USER-{user.pk}"
        legacy = PersonnelProfile.objects.filter(
            **({"user__isnull": True} if hasattr(PersonnelProfile, "user") else {}),
            officer_id=officer_id,
        ).first()
        if legacy:
            if hasattr(legacy, "user_id") and legacy.user_id is None:
                legacy.user = user
                legacy.save(update_fields=["user"])
            self._assert_not_archived(user, legacy)
            return legacy

        defaults = self._defaults_from_user(user)
        base = defaults["officer_id"]
        uniq, i = base, 1
        while PersonnelProfile.objects.filter(officer_id=uniq).exists():
            uniq = f"{base}-{i}"
            i += 1
        defaults["officer_id"] = uniq

        if hasattr(PersonnelProfile, "user"):
            profile = PersonnelProfile.objects.create(user=user, **defaults)
        else:
            profile = PersonnelProfile.objects.create(**defaults)

        self._assert_not_archived(user, profile)
        return profile


class AdminPersonnelProfileList(generics.ListAPIView):
    """
    GET /api/admin/personnel-profiles/
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsStaffOrIsAdminBool]
    serializer_class = AdminPersonnelProfileSerializer
    queryset = PersonnelProfile.objects.all().order_by("-updated_at")


class AdminPersonnelProfileArchiveView(APIView):
    """
    PATCH /api/admin/personnel-profiles/<int:pk>/archive/
    Body: { "is_archived": true|false }
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsStaffOrIsAdminBool]

    def patch(self, request, pk: int):
        profile = PersonnelProfile.objects.filter(pk=pk).first()
        if not profile:
            raise NotFound("Profile not found")

        is_archived = bool(request.data.get("is_archived", True))

        user = None
        if hasattr(profile, "user") and profile.user_id:
            user = profile.user
        else:
            user = Personnel.objects.filter(badge_number=profile.officer_id).first()

        with transaction.atomic():
            profile.is_archived = is_archived
            profile.save(update_fields=["is_archived", "updated_at"])
            if user:
                if user.is_active == (not is_archived):
                    pass
                else:
                    user.is_active = not is_archived
                    user.save(update_fields=["is_active"])

        data = AdminPersonnelProfileSerializer(profile).data
        return Response(data, status=status.HTTP_200_OK)


class AdminPersonnelProfileDestroyView(generics.DestroyAPIView):
    """
    DELETE /api/admin/personnel-profiles/<int:pk>/
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsStaffOrIsAdminBool]
    queryset = PersonnelProfile.objects.all()

    def perform_destroy(self, instance: PersonnelProfile):
        user = None
        if hasattr(instance, "user") and instance.user_id:
            user = instance.user
        else:
            user = Personnel.objects.filter(badge_number=instance.officer_id).first()

        with transaction.atomic():
            if user:
                user.delete()
            instance.delete()


############### change password ###############


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(
            data=request.data, context={"request": request}
        )
        if serializer.is_valid():
            serializer.save()
            return Response(
                {"detail": "Password changed successfully."},
                status=status.HTTP_200_OK,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


################# forgot password ####################


class ForgotThrottle(throttling.UserRateThrottle):
    scope = "forgot"


class AdminForgotSendCodeView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ForgotThrottle]

    def post(self, request):
        ser = ForgotSendCodeSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        email = ser.validated_data["email"].strip().lower()

        user_qs = User.objects.filter(email__iexact=email)
        if hasattr(User, "is_admin"):
            user_qs = user_qs.filter(is_admin=True)

        user_exists = user_qs.exists()

        if not user_exists:
            return Response(
                {"message": "If your email exists, an OTP has been sent to your inbox."}
            )

        otp_obj = PasswordResetOTP.create_otp(email=email)

        try:
            send_mail(
                subject="Your Admin Password Reset OTP",
                message=f"Your OTP is: {otp_obj.code}. It will expire in 10 minutes.",
                from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@example.com"),
                recipient_list=[email],
                fail_silently=False,
            )
        except Exception:
            pass

        return Response(
            {"message": "If your email exists, an OTP has been sent to your inbox."}
        )


class UserForgotThrottle(throttling.UserRateThrottle):
    scope = "user_forgot"
USER_LOGIN_OTP_TTL_MIN = 10  # 10 minutes

def _create_user_login_otp(user):
    """
    Gumagawa ng 6-digit OTP para sa user login, gamit EmailOTP model.
    """
    code = f"{secrets.randbelow(10**6):06d}"  # 000000–999999
    now = timezone.now()
    otp = EmailOTP.objects.create(
        user=user,
        code=code,
        expires_at=now + timedelta(minutes=USER_LOGIN_OTP_TTL_MIN),
        is_used=False,
        purpose="user_login",
    )
    return otp

def _find_user_by_identifier(email=None, username=None):
    qs = User.objects.all()
    if hasattr(User, "is_admin"):
        qs = qs.filter(is_admin=False)
    if email:
        qs = qs.filter(email__iexact=email.strip().lower())
    elif username:
        qs = qs.filter(username__iexact=username.strip())
    return qs.first()


def _cooldown_active(email: str) -> bool:
    last = (
        PasswordResetOTP.objects.filter(email__iexact=email)
        .order_by("-created_at")
        .first()
    )
    if not last:
        return False
    delta = timezone.now() - last.created_at
    return delta.total_seconds() < USER_RESEND_COOLDOWN_SEC


class UserForgotSendCodeView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [UserForgotThrottle]

    def post(self, request):
        ser = UserSendCodeSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        email = ser.validated_data.get("email", "").strip().lower() or None
        username = ser.validated_data.get("username", "").strip() or None

        user = _find_user_by_identifier(email=email, username=username)
        if not user:
            raise NotFound(detail="User not found.")

        if not user.email:
            raise ValidationError("This account has no email address on file.")

        if _cooldown_active(user.email):
            return Response(
                {"message": "Please wait before requesting another code."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        otp = PasswordResetOTP.create_otp(
            email=user.email,
            code_lifetime_minutes=USER_OTP_TTL_MIN,
        )
        try:
            send_mail(
                subject="Your Password Reset Code",
                message=(
                    f"Your OTP is: {otp.code}\n"
                    f"This code expires in {USER_OTP_TTL_MIN} minutes."
                ),
                from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@example.com"),
                recipient_list=[user.email],
                fail_silently=False,
            )
        except Exception:
            pass

        return Response({"message": "OTP sent"}, status=status.HTTP_200_OK)


class UserForgotVerifyCodeView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [UserForgotThrottle]

    def post(self, request):
        ser = UserVerifyCodeSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        email = ser.validated_data.get("email", "").strip().lower() or None
        username = ser.validated_data.get("username", "").strip() or None
        code = ser.validated_data["code"]

        user = _find_user_by_identifier(email=email, username=username)
        if not user:
            raise NotFound(detail="User not found.")

        otp = (
            PasswordResetOTP.objects.filter(email__iexact=user.email, code=code, used=False)
            .order_by("-created_at")
            .first()
        )
        if not otp or otp.is_expired():
            raise ValidationError(detail="Invalid or expired code.")

        return Response({"message": "OK"}, status=status.HTTP_200_OK)


class UserForgotResetPasswordView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [UserForgotThrottle]

    def post(self, request):
        ser = UserResetPasswordSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        email = ser.validated_data.get("email", "").strip().lower() or None
        username = ser.validated_data.get("username", "").strip() or None
        code = ser.validated_data["code"]
        new_password = ser.validated_data["new_password"]

        user = _find_user_by_identifier(email=email, username=username)

        if not user:
            raise NotFound(detail="User not found.")

        otp = (
            PasswordResetOTP.objects.filter(
                email__iexact=user.email,
                code=code
            )
            .order_by("-created_at")
            .first()
        )

        if not otp or otp.is_expired():
            raise ValidationError(detail="Invalid or expired code.")

        # update password
        user.set_password(new_password)
        user.save()

        return Response(
            {"message": "Password updated"},
            status=status.HTTP_200_OK
        )


# ============================
# ADMIN EMAIL-BASED 2FA (replaces old Google Authenticator flow)
# ============================


def _generate_login_otp(length: int = 6) -> str:
    """Generate a numeric OTP code for admin login."""
    import secrets

    return f"{secrets.randbelow(10**length):0{length}d}"


class AdminLogin2FA(APIView):
    """
    POST /api/auth/login-2fa/
    Body: { "username": "...", "password": "..." }

    STEP 1 (Admin login start)
    - Check username + password
    - Check is_staff
    - Create EmailOTP (purpose="login")
    - Send code to admin's email
    - Return: { detail, otp_id }
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        username = (request.data.get("username") or "").strip()
        password = (request.data.get("password") or "").strip()

        if not username or not password:
            return Response(
                {"detail": "Username and password are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = authenticate(username=username, password=password)
        if not user:
            return Response(
                {"detail": "Invalid credentials"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if not getattr(user, "is_staff", False):
            return Response(
                {"detail": "This portal is for administrators only."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if not user.email:
            return Response(
                {
                    "detail": "No email is associated with this administrator account."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        EmailOTP.objects.filter(
            user=user,
            purpose="login",
            is_used=False,
        ).delete()

        code = _generate_login_otp(6)
        now = timezone.now()
        otp = EmailOTP.objects.create(
            user=user,
            code=code,
            purpose="login",
            expires_at=now + timedelta(minutes=5),
        )

        subject = "Admin Login Verification Code"
        message = (
            f"Your CRMS admin login verification code is: {code}\n\n"
            "This code will expire in 5 minutes. "
            "If you did not request this, please contact your system administrator."
        )
        from_email = getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@example.com")
        recipient_list = [user.email]

        try:
            send_mail(
                subject,
                message,
                from_email,
                recipient_list,
                fail_silently=False,
            )
        except Exception as e:
            otp.delete()
            logger.exception("Failed to send admin login OTP email: %s", e)
            return Response(
                {
                    "detail": "Failed to send verification code. Please try again later."
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            {
                "detail": "A verification code has been sent to your email.",
                "otp_id": otp.id,
            },
            status=status.HTTP_200_OK,
        )


class Verify2FA(APIView):
    """
    POST /api/auth/2fa/verify/
    Body: { "otp_id": 123, "code": "123456" }

    STEP 2 (Admin login verify)
    - Validate EmailOTP (purpose="login")
    - Mark as used
    - Issue JWT tokens
    - Return: { access, refresh, is_staff }
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        otp_id = request.data.get("otp_id")
        code = (request.data.get("code") or "").strip()

        logger.info("Admin 2FA verify payload: otp_id=%r, code=%r", otp_id, code)

        if not otp_id or not code:
            return Response(
                {"detail": "OTP session and code are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            otp_id = int(otp_id)
        except (TypeError, ValueError):
            return Response(
                {"detail": "Invalid OTP session id."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            otp = EmailOTP.objects.select_related("user").get(
                id=otp_id,
                purpose="login",
            )
        except EmailOTP.DoesNotExist:
            return Response(
                {"detail": "Invalid or unknown OTP session."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if otp.is_used or timezone.now() > otp.expires_at:
            return Response(
                {"detail": "This verification code is invalid or has expired."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if otp.code != code:
            return Response(
                {"detail": "Incorrect verification code."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        otp.is_used = True
        otp.save(update_fields=["is_used"])

        user = otp.user

        if not getattr(user, "is_staff", False):
            return Response(
                {"detail": "This portal is for administrators only."},
                status=status.HTTP_403_FORBIDDEN,
            )

        refresh = RefreshToken.for_user(user)
        access_token = str(refresh.access_token)

        logger.info("Admin 2FA verify: SUCCESS for user %s", user.id)

        return Response(
            {
                "detail": "Login successful.",
                "access": access_token,
                "refresh": str(refresh),
                "is_staff": True,
            },
            status=status.HTTP_200_OK,
        )


class AdminUserAccountViewSet(viewsets.ModelViewSet):
    """
    /api/admin/users/
      GET    -> list users
      POST   -> create user
      PATCH  -> update user (activate/deactivate, email, badge_number)
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAdminUser]  # uses is_staff=True
    queryset = User.objects.all().order_by("-date_joined")
    serializer_class = AdminCreateUserSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        # optional filters:
        q = (self.request.query_params.get("q") or "").strip()
        if q:
            qs = qs.filter(username__icontains=q) | qs.filter(email__icontains=q)
        return qs

    @action(detail=True, methods=["post"], url_path="deactivate")
    def deactivate(self, request, pk=None):
        u = self.get_object()
        u.is_active = False
        u.save(update_fields=["is_active"])
        return Response({"detail": "User deactivated.", "is_active": u.is_active})

    @action(detail=True, methods=["post"], url_path="activate")
    def activate(self, request, pk=None):
        u = self.get_object()
        u.is_active = True
        u.save(update_fields=["is_active"])
        return Response({"detail": "User activated.", "is_active": u.is_active})

    @action(detail=True, methods=["post"], url_path="reset-password")
    def reset_password(self, request, pk=None):
        u = self.get_object()
        new_password = (request.data.get("new_password") or "").strip()
        if len(new_password) < 8:
            return Response({"detail": "Password must be at least 8 characters."},
                            status=status.HTTP_400_BAD_REQUEST)
        u.set_password(new_password)
        u.save(update_fields=["password"])
        return Response({"detail": "Password updated."})