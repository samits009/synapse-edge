"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { escapeHTML } from "@/lib/utils";

/* ========================================================================
   CrisisMap — CartoDB Dark Matter + Leaflet (SSR-safe)
   ========================================================================
   Pure Leaflet imperative component (no react-leaflet) to avoid
   SSR hydration issues in Next.js App Router. Uses CartoDB Dark Matter
   tiles for the venture-scale dark aesthetic.

   Security:
   - Uses centralized escapeHTML() to prevent XSS in Leaflet popups
   ======================================================================== */

interface MapTask {
  id: string;
  status: string;
  urgency: number;
  intent: string;
  description: string;
  // Support both old SimTask shape and new LiveTask shape
  location?: { lat: number; lng: number };
  location_lat?: number | null;
  location_lng?: number | null;
  matches?: { volunteer_name: string; similarity_score: number }[];
  matched_volunteer?: { name: string; bio: string; skills_raw: string[] } | null;
  dispatched?: boolean;
}

interface CrisisMapProps {
  tasks: MapTask[];
  height?: string;
  onTaskClick?: (taskId: string) => void;
}

// Custom marker SVGs (no external images needed)
function createMarkerIcon(color: string, pulseColor: string, size: number = 12): L.DivIcon {
  return L.divIcon({
    className: "",
    iconSize: [size * 2, size * 2],
    iconAnchor: [size, size],
    html: `
      <div style="position:relative;width:${size * 2}px;height:${size * 2}px;display:flex;align-items:center;justify-content:center;">
        <div style="
          position:absolute;
          width:${size * 2}px;height:${size * 2}px;
          border-radius:50%;
          background:${pulseColor};
          animation:map-pulse 2s ease-out infinite;
          opacity:0.4;
        "></div>
        <div style="
          width:${size}px;height:${size}px;
          border-radius:50%;
          background:${color};
          border:2px solid rgba(255,255,255,0.3);
          box-shadow:0 0 8px ${color};
          position:relative;z-index:2;
        "></div>
      </div>
    `,
  });
}

const TASK_ICON = createMarkerIcon("#ef4444", "#ef444440", 10);
const TASK_URGENT_ICON = createMarkerIcon("#f97316", "#f9731640", 14);
const DISPATCHED_ICON = createMarkerIcon("#10b981", "#10b98140", 10);
const EXTRACTING_ICON = createMarkerIcon("#3b82f6", "#3b82f640", 10);

function getIcon(task: MapTask): L.DivIcon {
  if (task.status === "dispatched" || task.status === "resolved") return DISPATCHED_ICON;
  if (task.status === "extracting" || task.status === "matching") return EXTRACTING_ICON;
  if (task.urgency >= 4) return TASK_URGENT_ICON;
  return TASK_ICON;
}

export default function CrisisMap({ tasks, height = "100%", onTaskClick }: CrisisMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const pathsRef = useRef<Map<string, L.Polyline>>(new Map());
  const volMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const volunteerCoordsRef = useRef<Map<string, { lat: number; lng: number }>>(new Map());


  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [26.85, 80.91],
      zoom: 6,
      zoomControl: false,
      attributionControl: false,
    });

    // CartoDB Dark Matter tiles — zero API key needed
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      subdomains: "abcd",
      maxZoom: 19,
    }).addTo(map);

    // Zoom control top-right
    L.control.zoom({ position: "topright" }).addTo(map);

    // Inject pulse animation CSS
    const style = document.createElement("style");
    style.textContent = `
      @keyframes map-pulse {
        0% { transform: scale(0.8); opacity: 0.6; }
        100% { transform: scale(2.2); opacity: 0; }
      }
      .neon-path {
        filter: drop-shadow(0 0 4px #10b981) drop-shadow(0 0 10px #10b981);
        animation: neon-dash 1.5s linear infinite;
      }
      @keyframes neon-dash {
        to { stroke-dashoffset: -20; }
      }
      @keyframes highlight-ping {
        0% { transform: scale(0.5); opacity: 0.8; }
        50% { transform: scale(1.5); opacity: 0.3; }
        100% { transform: scale(0.5); opacity: 0.8; }
      }
      .highlight-ring {
        animation: highlight-ping 1.2s ease-in-out infinite;
      }
      .leaflet-popup-content-wrapper {
        background: rgba(15, 23, 42, 0.9) !important;
        backdrop-filter: blur(8px);
        border: 1px solid rgba(16, 185, 129, 0.3);
        border-radius: 8px;
        box-shadow: 0 0 20px rgba(0, 0, 0, 0.5) !important;
      }
      .leaflet-popup-tip {
        background: rgba(15, 23, 42, 0.9) !important;
        border: 1px solid rgba(16, 185, 129, 0.3);
      }
    `;
    document.head.appendChild(style);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      style.remove();
    };
  }, []);

  // Sync markers with tasks
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const currentIds = new Set(tasks.map((t) => t.id));

    // Remove stale markers and paths
    markersRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
        
        const path = pathsRef.current.get(id);
        if (path) {
          path.remove();
          pathsRef.current.delete(id);
        }

        const volMarker = volMarkersRef.current.get(id);
        if (volMarker) {
          volMarker.remove();
          volMarkersRef.current.delete(id);
        }
      }
    });

    // Add or update markers
    tasks.forEach((task) => {
      // Resolve lat/lng from either shape
      const lat = task.location?.lat ?? task.location_lat;
      const lng = task.location?.lng ?? task.location_lng;
      if (lat == null || lng == null) return; // skip tasks without location

      const existing = markersRef.current.get(task.id);

      // Resolve match info from either shape
      const matchName = task.matches?.[0]?.volunteer_name ?? task.matched_volunteer?.name;
      const matchScore = task.matches?.[0]?.similarity_score;
      const hasMatch = !!matchName;

      const popupContent = `
        <div style="font-family:monospace;font-size:11px;max-width:220px;color:#e2e8f0;">
          <div style="color:#94a3b8;font-size:9px;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">
            ${escapeHTML(task.id.slice(0, 12))}
          </div>
          <div style="color:${task.urgency >= 4 ? "#f97316" : "#3b82f6"};font-weight:bold;margin-bottom:4px;">
            ${escapeHTML((task.intent || "pending").replace(/_/g, " ").toUpperCase())}
          </div>
          <div style="color:#94a3b8;font-size:10px;line-height:1.4;">
            ${escapeHTML((task.description || "").slice(0, 120))}...
          </div>
          ${hasMatch ? `
            <div style="margin-top:6px;padding-top:6px;border-top:1px solid #334155;color:#10b981;font-size:10px;">
              ✓ ${escapeHTML(matchName || "")}${matchScore ? ` (${(matchScore * 100).toFixed(0)}%)` : ""}
            </div>
          ` : ""}
        </div>
      `;

      if (existing) {
        existing.setIcon(getIcon(task));
        existing.setPopupContent(popupContent);
      } else {
        const marker = L.marker([lat, lng], {
          icon: getIcon(task),
        })
          .bindPopup(popupContent, {
            className: "crisis-popup",
            closeButton: false,
          })
          .addTo(map);

        marker.on('mouseover', () => {
          marker.openPopup();
        });
        marker.on('mouseout', () => {
          marker.closePopup();
        });
        marker.on('click', () => {
          onTaskClick?.(task.id);
        });

        markersRef.current.set(task.id, marker);
      }

      // If matched, draw a neon path to a simulated volunteer
      if (hasMatch) {
        let volCoord = volunteerCoordsRef.current.get(task.id);
        if (!volCoord) {
          // Generate random coordinate within ~10-15km radius
          volCoord = {
            lat: lat + (Math.random() - 0.5) * 0.2,
            lng: lng + (Math.random() - 0.5) * 0.2,
          };
          volunteerCoordsRef.current.set(task.id, volCoord);
        }

        if (!pathsRef.current.has(task.id)) {
          // Add neon line
          const polyline = L.polyline([[volCoord.lat, volCoord.lng], [lat, lng]], {
            color: "#10b981",
            weight: 3,
            opacity: 0.8,
            dashArray: "10, 10",
            className: "neon-path",
          }).addTo(map);
          pathsRef.current.set(task.id, polyline);

          // Add small volunteer dot
          const volDot = L.marker([volCoord.lat, volCoord.lng], {
            icon: L.divIcon({
              className: "",
              iconSize: [8, 8],
              html: "<div style='width:8px;height:8px;background:#10b981;border-radius:50%;box-shadow:0 0 10px #10b981, 0 0 20px #10b981;'></div>",
            }),
          }).addTo(map);
          volMarkersRef.current.set(task.id, volDot);
        }
      }
    });
  }, [tasks, onTaskClick]);

  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-slate-800/60" style={{ height }}>
      <div ref={containerRef} className="w-full h-full" />
      {/* Map overlay gradient at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-gray-950/80 to-transparent pointer-events-none z-[1000]" />
      {/* Legend */}
      <div className="absolute bottom-3 left-3 z-[1000] flex gap-3 text-[9px] font-mono text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-500" /> INCOMING
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-blue-500" /> PROCESSING
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500" /> DISPATCHED
        </span>
      </div>
    </div>
  );
}
