"use client";
import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import MarkerClusterGroup from "react-leaflet-cluster";

interface Toilet {
  id: number;
  name: string | null;
  latitude: number;
  longitude: number;
  address: string | null;
  accessible: string | null;
  opening_hours: string | null;
  fee: string | null;
  region: string | null;
  distance?: number;
}

const accessibleIcon = L.divIcon({
  className: "",
  html: `<div style="width:30px;height:30px;background:#2563eb;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:15px;">♿</div>`,
  iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -17],
});

const bookmarkIcon = L.divIcon({
  className: "",
  html: `<div style="width:30px;height:30px;background:#fbbf24;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:15px;">🚻</div>`,
  iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -17],
});

const defaultIcon = L.divIcon({
  className: "",
  html: `<div style="width:26px;height:26px;background:#dc2626;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.2);display:flex;align-items:center;justify-content:center;font-size:13px;">🚻</div>`,
  iconSize: [26, 26], iconAnchor: [13, 13], popupAnchor: [0, -15],
});

function createCurrentIcon(heading: number | null): L.DivIcon {
  const size = 80;
  const cx = size / 2;
  const cy = size / 2;
  let beamSvg = "";
  if (heading !== null) {
    beamSvg = `<polygon points="${cx},${cy} ${cx - 12},${cy - 44} ${cx + 12},${cy - 44}" fill="rgba(220,38,38,0.35)" transform="rotate(${heading}, ${cx}, ${cy})"/>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">${beamSvg}<circle cx="${cx}" cy="${cy}" r="10" fill="#dc2626" stroke="white" stroke-width="3"/></svg>`;
  return L.divIcon({ html: svg, iconSize: [size, size], iconAnchor: [cx, cy], className: "" });
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km.toFixed(1)}km`;
}

interface MapProps {
  toilets: Toilet[];
  center: [number, number];
  bookmarks: Set<number>;
  onToggleBookmark: (id: number) => void;
}

function MapInit({ center }: { center: [number, number] }) {
  const map = useMap();
  const initialized = useRef(false);
  useEffect(() => {
    if (!initialized.current) {
      map.setView(center, 15);
      initialized.current = true;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any)._toiletMap = map;
    }
  }, [center, map]);
  return null;
}

export default function ToiletMap({ toilets, center, bookmarks, onToggleBookmark }: MapProps) {
  const [heading, setHeading] = useState<number | null>(null);
  const [compassEnabled, setCompassEnabled] = useState(false);
  const handleOrientationRef = useRef<((e: DeviceOrientationEvent) => void) | null>(null);
  const headingRef = useRef<number | null>(null);

  function handleOrientation(e: DeviceOrientationEvent) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ios = (e as any).webkitCompassHeading;
    const newHeading = ios != null ? ios : e.alpha != null ? 360 - e.alpha : null;
    if (newHeading === null) return;
    const prev = headingRef.current;
    if (prev === null || Math.abs(newHeading - prev) >= 5) {
      headingRef.current = newHeading;
      setHeading(newHeading);
    }
  }

  function attachCompass() {
    handleOrientationRef.current = handleOrientation;
    window.addEventListener("deviceorientation", handleOrientation, true);
    setCompassEnabled(true);
    localStorage.setItem('toilet_compass_enabled', 'true');
  }

  async function enableCompass() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const DevOrient = DeviceOrientationEvent as any;
    if (typeof DevOrient.requestPermission === "function") {
      try {
        const result = await DevOrient.requestPermission();
        if (result === "granted") attachCompass();
      } catch (err) {
        console.error('Compass permission error:', err);
      }
    } else {
      attachCompass();
    }
  }

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const DevOrient = DeviceOrientationEvent as any;
    if (typeof DevOrient.requestPermission !== "function") {
      attachCompass();
    } else {
      const saved = localStorage.getItem('toilet_compass_enabled');
      if (saved === 'true') {
        DevOrient.requestPermission()
          .then((result: string) => { if (result === "granted") attachCompass(); })
          .catch(() => {});
      }
    }
    return () => {
      if (handleOrientationRef.current) {
        window.removeEventListener("deviceorientation", handleOrientationRef.current, true);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function goToCurrentLocation() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const map = (window as any)._toiletMap;
    if (map && center) map.setView(center, 16);
  }

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      <MapContainer center={center} zoom={15} style={{ height: "100%", width: "100%" }}>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <MapInit center={center} />
        <Marker position={center} icon={createCurrentIcon(heading)}>
          <Popup>📍 現在地</Popup>
        </Marker>
        <MarkerClusterGroup
          iconCreateFunction={(cluster: { getChildCount: () => number; getAllChildMarkers: () => L.Marker[] }) => {
            const count = cluster.getChildCount();
            const markers = cluster.getAllChildMarkers();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const hasBookmark = markers.some(m => bookmarks.has((m.options as any).toiletId));
            const bg = hasBookmark ? '#fbbf24' : '#dc2626';
            return L.divIcon({
              className: "",
              html: `<div style="width:40px;height:40px;background:${bg};border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;flex-direction:column;"><span style="font-size:14px;">🚻</span><span style="font-size:10px;color:white;font-weight:bold;line-height:1;">${count}</span></div>`,
              iconSize: [40, 40], iconAnchor: [20, 20],
            });
          }}
        >
          {toilets.map(toilet => {
            const isBookmarked = bookmarks.has(toilet.id);
            const isAccessible = toilet.accessible === 'yes';
            const icon = isBookmarked ? bookmarkIcon : isAccessible ? accessibleIcon : defaultIcon;
            return (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              <Marker key={toilet.id} position={[toilet.latitude, toilet.longitude]} icon={icon} {...{ toiletId: toilet.id } as any}>
                <Popup>
                  <div style={{ minWidth: "180px" }}>
                    <p style={{ fontWeight: "bold", marginBottom: "4px", fontSize: "14px" }}>🚻 {toilet.name || "公衆トイレ"}</p>
                    {toilet.distance != null && <p style={{ fontSize: "12px", color: "#dc2626", fontWeight: "bold", marginBottom: "4px" }}>📍 {formatDistance(toilet.distance)}</p>}
                    <div style={{ display: "flex", gap: "4px", marginBottom: "6px", flexWrap: "wrap" }}>
                      {isAccessible && <span style={{ fontSize: "11px", background: "#dbeafe", color: "#1d4ed8", padding: "2px 6px", borderRadius: "999px" }}>♿ 多目的</span>}
                      {(!toilet.fee || toilet.fee === 'no') && <span style={{ fontSize: "11px", background: "#dcfce7", color: "#15803d", padding: "2px 6px", borderRadius: "999px" }}>無料</span>}
                      {toilet.opening_hours === '24/7' && <span style={{ fontSize: "11px", background: "#f3e8ff", color: "#7e22ce", padding: "2px 6px", borderRadius: "999px" }}>24時間</span>}
                    </div>
                    {toilet.address && <p style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}>{toilet.address}</p>}
                    {toilet.opening_hours && toilet.opening_hours !== '24/7' && <p style={{ fontSize: "11px", color: "#888", marginBottom: "6px" }}>🕐 {toilet.opening_hours}</p>}
                    <div style={{ display: "flex", gap: "4px", marginBottom: "6px" }}>
                      <button onClick={() => onToggleBookmark(toilet.id)} style={{ flex: 1, padding: "4px", background: isBookmarked ? "#fbbf24" : "#f3f4f6", border: "1px solid #d1d5db", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}>
                        {isBookmarked ? "⭐ 登録中" : "☆ お気に入り"}
                      </button>
                    </div>
                    <a href={`https://www.google.com/maps/dir/?api=1&destination=${toilet.latitude},${toilet.longitude}`} target="_blank" rel="noopener noreferrer"
                      style={{ display: "block", textAlign: "center", background: "#dc2626", color: "white", padding: "6px", borderRadius: "4px", fontSize: "12px", textDecoration: "none" }}>
                      🗺️ ルート案内
                    </a>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MarkerClusterGroup>
      </MapContainer>

      {/* コンパスボタン */}
      {!compassEnabled && (
        <button
          onClick={enableCompass}
          style={{
            position: 'absolute', bottom: 80, right: 12, zIndex: 1000,
            width: 44, height: 44, borderRadius: '50%',
            background: 'white', border: '2px solid #dc2626',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)', cursor: 'pointer',
            fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          title="コンパスを有効化"
        >🧭</button>
      )}

      {/* 現在地ボタン */}
      <button
        onClick={goToCurrentLocation}
        style={{
          position: 'absolute', bottom: 32, right: 12, zIndex: 1000,
          width: 44, height: 44, borderRadius: '50%',
          background: 'white', border: '2px solid #dc2626',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)', cursor: 'pointer',
          fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        title="現在地に戻る"
      >📍</button>
    </div>
  );
}
