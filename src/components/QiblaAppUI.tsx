import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents, Polyline } from "react-leaflet";
import L from "leaflet";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MapPin,
  Navigation,
  Compass,
  Search,
  Crosshair,
  Clock,
  Sun,
  Moon,
  Satellite,
  Layers,
  Star,
  Globe,
  Info,
  List,
  X,
  SlidersHorizontal,
  Settings,
  Loader2,
  Sparkles,
  Maximize2,
  Minimize2,
  LocateFixed,
  ChevronDown,
  ArrowRight,
  Building2,
} from "lucide-react";
import type { Location, QiblaResult, MapStyle, Mosque } from "@/types";
import { calculateQibla, getCardinalDirection, getGeodesicPoints, calculatePrayerTimes } from "@/utils/qiblaCalc";
import { mosques } from "@/data/mosquesData";

const KAABA: Location = { lat: 21.422487, lng: 39.826206 };

const TILE_STYLES: Record<MapStyle, string> = {
  dark: "https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png",
  light: "https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png",
  satellite: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
};

const TILE_ATTRIBUTIONS: Record<MapStyle, string> = {
  dark: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>',
  light: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>',
  satellite: '&copy; <a href="https://www.esri.com/">Esri</a>',
};

const kaabaIcon = L.divIcon({
  className: "kaaba-marker",
  html: `<div style="width:32px;height:32px;background:linear-gradient(135deg,#fbbf24,#d97706);border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 0 20px rgba(251,191,36,0.6),0 0 40px rgba(251,191,36,0.3);border:2px solid #fbbf24;"><span style="color:#1a1a2e;font-size:14px;font-weight:bold;">﷽</span></div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const mosqueIcon = L.divIcon({
  className: "mosque-marker",
  html: `<div style="width:28px;height:28px;background:linear-gradient(135deg,#10b981,#059669);border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 0 12px rgba(16,185,129,0.4);border:2px solid #34d399;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9"/><path d="M18 14h-8"/></svg></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

function MapEvents({ onClick }: { onClick: (latlng: Location) => void }) {
  useMapEvents({
    click(e) {
      onClick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

function KaabaPulse() {
  const map = useMap();
  useEffect(() => {
    const k = L.marker([KAABA.lat, KAABA.lng], { icon: kaabaIcon }).addTo(map);
    return () => {
      k.remove();
    };
  }, [map]);
  return null;
}

function FitBounds({ bounds }: { bounds: L.LatLngBoundsExpression | null }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
  }, [map, bounds]);
  return null;
}

function AnimatedQiblaLine({ points }: { points: Location[] }) {
  const map = useMap();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (points.length < 2) return;
    const interval = setInterval(() => {
      setProgress((p) => (p >= 1 ? 0 : Math.min(p + 0.02, 1)));
    }, 50);
    return () => clearInterval(interval);
  }, [points.length]);

  const visiblePoints = useMemo(() => {
    if (points.length < 2) return [];
    const count = Math.max(2, Math.floor(points.length * progress));
    return points.slice(0, count);
  }, [points, progress]);

  if (visiblePoints.length < 2) return null;

  const latlngs = visiblePoints.map((p) => [p.lat, p.lng] as [number, number]);

  return (
    <>
      <Polyline
        positions={latlngs}
        pathOptions={{
          color: "#fbbf24",
          weight: 4,
          opacity: 0.8,
          dashArray: "10, 10",
        }}
      />
      <Polyline
        positions={latlngs}
        pathOptions={{
          color: "#f59e0b",
          weight: 2,
          opacity: 0.4,
        }}
      />
    </>
  );
}

export default function QiblaAppUI() {
  const [origin, setOrigin] = useState<Location | null>(null);
  const [qiblaResult, setQiblaResult] = useState<QiblaResult | null>(null);
  const [mapStyle, setMapStyle] = useState<MapStyle>("dark");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("qibla");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showCompass, setShowCompass] = useState(true);
  const [userLocation, setUserLocation] = useState<Location | null>(null);
  const [prayerTimes, setPrayerTimes] = useState<ReturnType<typeof calculatePrayerTimes> | null>(null);
  const [geodesicPoints, setGeodesicPoints] = useState<Location[]>([]);
  const [selectedMosque, setSelectedMosque] = useState<Mosque | null>(null);
  const [mapBounds, setMapBounds] = useState<L.LatLngBoundsExpression | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const mapRef = useRef<L.Map | null>(null);

  const filteredMosques = useMemo(
    () =>
      mosques.filter(
        (m) =>
          m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.country.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [searchQuery]
  );

  const handleLocationSelect = useCallback((loc: Location) => {
    setOrigin(loc);
    setSelectedMosque(null);
    const result = calculateQibla(loc);
    setQiblaResult(result);
    setGeodesicPoints(getGeodesicPoints(loc, 80));
    setPrayerTimes(calculatePrayerTimes(loc.lat, loc.lng));
    setMapBounds([
      [loc.lat, loc.lng],
      [KAABA.lat, KAABA.lng],
    ]);
  }, []);

  const handleMosqueSelect = useCallback((mosque: Mosque) => {
    setSelectedMosque(mosque);
    setOrigin({ lat: mosque.lat, lng: mosque.lng, name: mosque.name });
    const result = calculateQibla({ lat: mosque.lat, lng: mosque.lng });
    setQiblaResult(result);
    setGeodesicPoints(getGeodesicPoints({ lat: mosque.lat, lng: mosque.lng }, 80));
    setPrayerTimes(calculatePrayerTimes(mosque.lat, mosque.lng));
    setMapBounds([
      [mosque.lat, mosque.lng],
      [KAABA.lat, KAABA.lng],
    ]);
    setSearchQuery("");
    toast.success(`Qibla from ${mosque.name}`, {
      description: `${result.cardinalDirection} · ${result.distanceKm} km`,
    });
  }, []);

  const handleGetGPS = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported by your browser");
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc: Location = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          name: "Your Location",
        };
        setUserLocation(loc);
        handleLocationSelect(loc);
        setGpsLoading(false);
        toast.success("Location detected!");
      },
      (err) => {
        setGpsLoading(false);
        toast.error("Could not get location: " + err.message);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [handleLocationSelect]);

  const toggleSidebar = () => setSidebarOpen((v) => !v);
  const toggleCompass = () => setShowCompass((v) => !v);

  return (
    <div className="relative h-screen w-full overflow-hidden bg-[#0a0a1a]">
      {/* Map Container */}
      <div className={`absolute inset-0 transition-all duration-500 ${sidebarOpen ? "lg:right-96" : "right-0"}`}>
        <MapContainer
          center={[24.0, 45.0]}
          zoom={5}
          className="h-full w-full z-0"
          zoomControl={false}
          ref={mapRef}
        >
          <TileLayer url={TILE_STYLES[mapStyle]} attribution={TILE_ATTRIBUTIONS[mapStyle]} />
          <MapEvents onClick={handleLocationSelect} />
          <KaabaPulse />
          <FitBounds bounds={mapBounds} />

          {geodesicPoints.length > 0 && <AnimatedQiblaLine points={geodesicPoints} />}

          {/* Mosque Markers */}
          {mosques.map((m) => (
            <Marker
              key={m.id}
              position={[m.lat, m.lng]}
              icon={m.id === "kaaba" ? kaabaIcon : mosqueIcon}
            >
              <Popup>
                <div className="text-sm min-w-[180px]">
                  <strong className="text-emerald-600">{m.name}</strong>
                  <br />
                  <span className="text-muted-foreground">
                    {m.city}, {m.country}
                  </span>
                  <br />
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2 w-full text-xs"
                    onClick={() => handleMosqueSelect(m)}
                  >
                    <Compass className="h-3 w-3 mr-1" />
                    Calculate Qibla
                  </Button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Map Style Controls */}
        <div className="absolute top-4 left-4 z-[1000] flex gap-2">
          {(["dark", "light", "satellite"] as MapStyle[]).map((style) => (
            <Button
              key={style}
              size="sm"
              variant={mapStyle === style ? "default" : "secondary"}
              className={`h-9 w-9 p-0 rounded-full backdrop-blur-md ${
                mapStyle === style
                  ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                  : "bg-black/60 text-white/80 hover:bg-black/80"
              }`}
              onClick={() => setMapStyle(style)}
            >
              {style === "dark" ? (
                <Moon className="h-4 w-4" />
              ) : style === "light" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Satellite className="h-4 w-4" />
              )}
            </Button>
          ))}
        </div>

        {/* GPS Button */}
        <div className="absolute top-4 right-4 z-[1000]">
          <Button
            size="sm"
            variant="secondary"
            className="bg-black/60 text-white/80 hover:bg-black/80 backdrop-blur-md rounded-full h-9 w-9 p-0"
            onClick={handleGetGPS}
            disabled={gpsLoading}
          >
            {gpsLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LocateFixed className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Sidebar Toggle */}
        <div className="absolute top-4 z-[1000]" style={{ left: sidebarOpen ? "calc(100% - 48px)" : "16px" }}>
          <Button
            size="sm"
            variant="secondary"
            className="bg-black/60 text-white/80 hover:bg-black/80 backdrop-blur-md rounded-full h-9 w-9 p-0"
            onClick={toggleSidebar}
          >
            {sidebarOpen ? <X className="h-4 w-4" /> : <List className="h-4 w-4" />}
          </Button>
        </div>

        {/* Compass Widget */}
        <AnimatePresence>
          {showCompass && qiblaResult && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="absolute bottom-6 left-6 z-[1000]"
            >
              <div className="relative w-28 h-28">
                <div
                  className="absolute inset-0 rounded-full border-2 border-emerald-500/30 bg-black/60 backdrop-blur-md flex items-center justify-center"
                  style={{
                    boxShadow: "0 0 30px rgba(16,185,129,0.15)",
                  }}
                >
                  {/* Compass Ring */}
                  <div className="absolute inset-0 rounded-full">
                    {["N", "NE", "E", "SE", "S", "SW", "W", "NW"].map((dir, i) => (
                      <span
                        key={dir}
                        className="absolute text-[8px] font-bold text-white/60"
                        style={{
                          top: "50%",
                          left: "50%",
                          transform: `rotate(${i * 45}deg) translateY(-38px) rotate(${-i * 45}deg)`,
                          transformOrigin: "0 0",
                        }}
                      >
                        {dir}
                      </span>
                    ))}
                  </div>
                  {/* Pointer */}
                  <motion.div
                    className="w-1 h-12 bg-gradient-to-t from-transparent via-amber-400 to-amber-300 absolute bottom-1/2 origin-bottom"
                    animate={{ rotate: qiblaResult.bearing }}
                    transition={{ type: "spring", stiffness: 60, damping: 15 }}
                    style={{
                      boxShadow: "0 0 10px rgba(251,191,36,0.5)",
                      borderRadius: "2px 2px 0 0",
                    }}
                  />
                  {/* Center dot */}
                  <div className="w-3 h-3 rounded-full bg-amber-400 z-10 shadow-lg shadow-amber-400/50" />
                </div>
                <button
                  onClick={toggleCompass}
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-black/60 text-white/60 flex items-center justify-center text-[10px] hover:bg-black/80"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Qibla Info Overlay */}
        {qiblaResult && (
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] max-w-md w-[90%]"
          >
            <Card className="bg-black/70 backdrop-blur-xl border-emerald-500/20 shadow-2xl shadow-emerald-500/10">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
                      <Compass className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-xs text-emerald-300/80 font-medium">QIBLA DIRECTION</p>
                      <p className="text-lg font-bold text-white tracking-tight">
                        {qiblaResult.cardinalDirection}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-emerald-300/80 font-medium">DISTANCE</p>
                    <p className="text-sm font-bold text-white">
                      {qiblaResult.distanceKm.toLocaleString()} km
                    </p>
                    <p className="text-xs text-white/50">{qiblaResult.distanceMiles.toLocaleString()} mi</p>
                  </div>
                </div>
                {origin?.name && (
                  <p className="text-xs text-white/40 mt-2 truncate">
                    From: {origin.name}
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>

      {/* Sidebar Panel */}
      <motion.div
        initial={false}
        animate={{
          width: sidebarOpen ? 384 : 0,
          opacity: sidebarOpen ? 1 : 0,
        }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="absolute right-0 top-0 h-full z-[1001] overflow-hidden bg-[#0d0d2b]/95 backdrop-blur-xl border-l border-emerald-500/10"
      >
        <div className="w-96 h-full flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-emerald-500/10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Compass className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white tracking-tight">Qibla Finder</h1>
                <p className="text-[10px] text-emerald-300/60 uppercase tracking-widest font-medium">
                  Precision to the Holy Kaaba
                </p>
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
              <Input
                placeholder="Search mosques, cities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-white/5 border-emerald-500/20 text-white placeholder:text-white/30 h-9 text-sm rounded-xl"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <X className="h-3.5 w-3.5 text-white/30 hover:text-white" />
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <div className="px-4 pt-2">
              <TabsList className="w-full bg-white/5 border border-emerald-500/10 rounded-xl p-0.5">
                <TabsTrigger
                  value="qibla"
                  className="flex-1 text-xs data-[state=active]:bg-emerald-500 data-[state=active]:text-white rounded-lg"
                >
                  <Compass className="h-3.5 w-3.5 mr-1.5" />
                  Qibla
                </TabsTrigger>
                <TabsTrigger
                  value="mosques"
                  className="flex-1 text-xs data-[state=active]:bg-emerald-500 data-[state=active]:text-white rounded-lg"
                >
                  <Building2 className="h-3.5 w-3.5 mr-1.5" />
                  Mosques
                </TabsTrigger>
                <TabsTrigger
                  value="prayer"
                  className="flex-1 text-xs data-[state=active]:bg-emerald-500 data-[state=active]:text-white rounded-lg"
                >
                  <Clock className="h-3.5 w-3.5 mr-1.5" />
                  Times
                </TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="flex-1 px-4 py-3">
              <TabsContent value="qibla" className="mt-0">
                {!origin ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-amber-400/20 to-emerald-500/20 flex items-center justify-center border border-amber-500/20">
                      <Globe className="h-8 w-8 text-amber-400/60" />
                    </div>
                    <h3 className="text-white/70 font-medium mb-2">Select a Location</h3>
                    <p className="text-white/40 text-sm mb-4">
                      Click anywhere on the map or choose a mosque to calculate Qibla direction
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                      onClick={handleGetGPS}
                      disabled={gpsLoading}
                    >
                      {gpsLoading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <LocateFixed className="h-4 w-4 mr-2" />
                      )}
                      Use My Location
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Card className="bg-gradient-to-br from-emerald-500/10 to-amber-500/5 border-emerald-500/20">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-emerald-300/60 font-medium uppercase tracking-wider">
                            Qibla Analysis
                          </span>
                          <Badge
                            variant="outline"
                            className="border-amber-500/30 text-amber-400 text-[10px]"
                          >
                            <Sparkles className="h-3 w-3 mr-1" />
                            Precise
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-white/5 rounded-lg p-2.5">
                            <p className="text-[10px] text-white/40 uppercase tracking-wider">Great Circle</p>
                            <p className="text-sm font-bold text-white">
                              {qiblaResult?.greatCircleBearing}°
                            </p>
                          </div>
                          <div className="bg-white/5 rounded-lg p-2.5">
                            <p className="text-[10px] text-white/40 uppercase tracking-wider">Rhumb Line</p>
                            <p className="text-sm font-bold text-white">
                              {qiblaResult?.rhumbLineBearing}°
                            </p>
                          </div>
                          <div className="bg-white/5 rounded-lg p-2.5">
                            <p className="text-[10px] text-white/40 uppercase tracking-wider">Distance</p>
                            <p className="text-sm font-bold text-white">
                              {qiblaResult?.distanceKm.toLocaleString()} km
                            </p>
                          </div>
                          <div className="bg-white/5 rounded-lg p-2.5">
                            <p className="text-[10px] text-white/40 uppercase tracking-wider">Direction</p>
                            <p className="text-sm font-bold text-amber-400">
                              {qiblaResult?.cardinalDirection.split(" ")[1]}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Compass toggle */}
                    <div className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
                      <span className="text-xs text-white/60">Digital Compass</span>
                      <Button
                        size="sm"
                        variant={showCompass ? "default" : "secondary"}
                        className={`h-7 text-xs ${
                          showCompass
                            ? "bg-emerald-500 text-white"
                            : "bg-white/10 text-white/60"
                        }`}
                        onClick={toggleCompass}
                      >
                        {showCompass ? "Visible" : "Hidden"}
                      </Button>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="mosques" className="mt-0">
                <div className="space-y-2">
                  {filteredMosques.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-white/40 text-sm">No mosques found</p>
                    </div>
                  ) : (
                    filteredMosques.map((mosque, i) => (
                      <motion.div
                        key={mosque.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                      >
                        <Card
                          className={`cursor-pointer hover:bg-white/5 transition-all border ${
                            selectedMosque?.id === mosque.id
                              ? "border-emerald-500/50 bg-emerald-500/10"
                              : "border-white/5"
                          }`}
                          onClick={() => handleMosqueSelect(mosque)}
                        >
                          <CardContent className="p-3 flex gap-3">
                            <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-white/5">
                              <img
                                src={mosque.imageUrl}
                                alt={mosque.name}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-1">
                                <p className="text-sm font-medium text-white truncate">
                                  {mosque.name}
                                </p>
                                {mosque.isFamous && (
                                  <Star className="h-3 w-3 text-amber-400 flex-shrink-0 mt-0.5" />
                                )}
                              </div>
                              <p className="text-xs text-white/40 truncate">
                                {mosque.city}, {mosque.country}
                              </p>
                              <p className="text-[10px] text-white/30 line-clamp-1 mt-0.5">
                                {mosque.description}
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="prayer" className="mt-0">
                {prayerTimes ? (
                  <div className="space-y-2">
                    <Card className="bg-gradient-to-br from-emerald-500/10 to-amber-500/5 border-emerald-500/20">
                      <CardContent className="p-4">
                        <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                          <Clock className="h-4 w-4 text-emerald-400" />
                          Prayer Times
                        </h3>
                        <div className="space-y-2">
                          {[
                            { label: "Fajr", time: prayerTimes.fajr, icon: "🌙" },
                            { label: "Sunrise", time: prayerTimes.sunrise, icon: "🌅" },
                            { label: "Dhuhr", time: prayerTimes.dhuhr, icon: "☀️" },
                            { label: "Asr", time: prayerTimes.asr, icon: "🌤️" },
                            { label: "Maghrib", time: prayerTimes.maghrib, icon: "🌇" },
                            { label: "Isha", time: prayerTimes.isha, icon: "🌃" },
                          ].map((p) => (
                            <div
                              key={p.label}
                              className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-sm">{p.icon}</span>
                                <span className="text-xs text-white/70 font-medium">{p.label}</span>
                              </div>
                              <span className="text-sm font-bold text-white">{p.time}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                    <p className="text-[10px] text-white/30 text-center">
                      Estimated times based on location. Verify locally.
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Clock className="h-10 w-10 text-white/20 mx-auto mb-3" />
                    <p className="text-white/50 text-sm">
                      Select a location to see prayer times
                    </p>
                  </div>
                )}
              </TabsContent>
            </ScrollArea>
          </Tabs>

          {/* Footer */}
          <div className="p-3 border-t border-emerald-500/10">
            <p className="text-[10px] text-white/20 text-center">
              Kaaba: {KAABA.lat}°N, {KAABA.lng}°E · Haversine Formula
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}