'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Globe from 'react-globe.gl';
import type { GlobeMethods } from 'react-globe.gl';

type Region = {
  name: string;
  countries: string[];
};

type Props = {
  regions: Region[];
  selectedCountries: string[];
  onToggleCountry: (country: string) => void;
  initialContinentKey?: string;
};

type PolygonCoords = number[][][];
type MultiPolygonCoords = number[][][][];

type GeoFeature = {
  properties?: {
    NAME?: string;
    name?: string;
    CONTINENT?: string;
    continent?: string;
    iso_a2?: string;
    iso_a3?: string;
    id?: string;
  };
  geometry?: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: PolygonCoords | MultiPolygonCoords;
  };
};

type ContinentConfig = {
  key: string;
  label: string;
  emoji: string;
  lat: number;
  lng: number;
  altitude: number;
  colors: {
    base: string;
    hover: string;
    active: string;
    card: string;
    badge: string;
  };
};

type ContinentFeature = {
  properties: {
    name: string;
    key: string;
  };
  geometry: {
    type: 'MultiPolygon';
    coordinates: MultiPolygonCoords;
  };
};

const continents: ContinentConfig[] = [
  { key: 'europe', label: 'Europe', emoji: '🏰', lat: 52, lng: 15, altitude: 1.35, colors: { base: 'rgba(168, 85, 247, 0.16)', hover: 'rgba(196, 181, 253, 0.28)', active: 'rgba(192, 132, 252, 0.42)', card: 'rgb(250 245 255)', badge: 'rgb(168 85 247)' } },
  { key: 'north-america', label: 'North America', emoji: '🗽', lat: 45, lng: -100, altitude: 1.45, colors: { base: 'rgba(34, 197, 94, 0.16)', hover: 'rgba(134, 239, 172, 0.28)', active: 'rgba(74, 222, 128, 0.42)', card: 'rgb(240 253 244)', badge: 'rgb(22 163 74)' } },
  { key: 'south-america', label: 'South America', emoji: '🌴', lat: -17, lng: -60, altitude: 1.5, colors: { base: 'rgba(249, 115, 22, 0.16)', hover: 'rgba(253, 186, 116, 0.28)', active: 'rgba(251, 146, 60, 0.42)', card: 'rgb(255 247 237)', badge: 'rgb(234 88 12)' } },
  { key: 'africa', label: 'Africa', emoji: '🦁', lat: 5, lng: 20, altitude: 1.45, colors: { base: 'rgba(234, 179, 8, 0.16)', hover: 'rgba(253, 224, 71, 0.28)', active: 'rgba(250, 204, 21, 0.42)', card: 'rgb(254 252 232)', badge: 'rgb(202 138 4)' } },
  { key: 'asia', label: 'Asia', emoji: '🏯', lat: 28, lng: 98, altitude: 1.4, colors: { base: 'rgba(59, 130, 246, 0.16)', hover: 'rgba(147, 197, 253, 0.28)', active: 'rgba(96, 165, 250, 0.42)', card: 'rgb(239 246 255)', badge: 'rgb(37 99 235)' } },
  { key: 'oceania', label: 'Oceania', emoji: '🌊', lat: -23, lng: 135, altitude: 1.5, colors: { base: 'rgba(20, 184, 166, 0.16)', hover: 'rgba(153, 246, 228, 0.28)', active: 'rgba(45, 212, 191, 0.42)', card: 'rgb(240 253 250)', badge: 'rgb(13 148 136)' } },
];

const geoJsonUrl = 'https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json';

const EXCLUDED_COUNTRIES = new Set(['Bermuda']);

function getFeatureName(feature: GeoFeature) {
  return feature.properties?.NAME || feature.properties?.name || '';
}

const continentByCountryName: Record<string, string> = {
  Afghanistan: 'asia', Albania: 'europe', Algeria: 'africa', Andorra: 'europe', Angola: 'africa', Antarctica: 'oceania', Argentina: 'south-america', Armenia: 'asia', Australia: 'oceania', Austria: 'europe', Azerbaijan: 'asia', Bahamas: 'north-america', Bahrain: 'asia', Bangladesh: 'asia', Belarus: 'europe', Belgium: 'europe', Belize: 'north-america', Benin: 'africa', Bhutan: 'asia', Bolivia: 'south-america', 'Bosnia and Herzegovina': 'europe', 'Bosnia and Herz.': 'europe', Botswana: 'africa', Brazil: 'south-america', Brunei: 'asia', Bulgaria: 'europe', 'Burkina Faso': 'africa', Burundi: 'africa', Cambodia: 'asia', Cameroon: 'africa', Canada: 'north-america', 'Central African Republic': 'africa', 'Central African Rep.': 'africa', Chad: 'africa', Chile: 'south-america', China: 'asia', Colombia: 'south-america', Congo: 'africa', 'Costa Rica': 'north-america', Croatia: 'europe', Cuba: 'north-america', Cyprus: 'asia', 'Czech Republic': 'europe', 'Dem. Rep. Congo': 'africa', 'Democratic Republic of the Congo': 'africa', Denmark: 'europe', Djibouti: 'africa', 'Dominican Republic': 'north-america', 'Dominican Rep.': 'north-america', Ecuador: 'south-america', Egypt: 'africa', 'El Salvador': 'north-america', 'Eq. Guinea': 'africa', 'Equatorial Guinea': 'africa', Eritrea: 'africa', Estonia: 'europe', Eswatini: 'africa', eSwatini: 'africa', Ethiopia: 'africa', 'Falkland Islands': 'south-america', 'Falkland Is.': 'south-america', Fiji: 'oceania', Finland: 'europe', France: 'europe', Gabon: 'africa', Gambia: 'africa', Georgia: 'asia', Germany: 'europe', Ghana: 'africa', Greece: 'europe', Greenland: 'north-america', Guatemala: 'north-america', Guinea: 'africa', 'Guinea-Bissau': 'africa', Guyana: 'south-america', Haiti: 'north-america', Honduras: 'north-america', 'Hong Kong': 'asia', Hungary: 'europe', Iceland: 'europe', India: 'asia', Indonesia: 'asia', Iran: 'asia', Iraq: 'asia', Ireland: 'europe', Israel: 'asia', Italy: 'europe', 'Ivory Coast': 'africa', "Côte d'Ivoire": 'africa', Jamaica: 'north-america', Japan: 'asia', Jordan: 'asia', Kazakhstan: 'asia', Kenya: 'africa', Kosovo: 'europe', Kuwait: 'asia', Kyrgyzstan: 'asia', Laos: 'asia', Latvia: 'europe', Lebanon: 'asia', Lesotho: 'africa', Liberia: 'africa', Libya: 'africa', Lithuania: 'europe', Luxembourg: 'europe', Macedonia: 'europe', Madagascar: 'africa', Malawi: 'africa', Malaysia: 'asia', Mali: 'africa', Mauritania: 'africa', Mexico: 'north-america', Moldova: 'europe', Mongolia: 'asia', Montenegro: 'europe', Morocco: 'africa', Mozambique: 'africa', Myanmar: 'asia', Namibia: 'africa', Nepal: 'asia', Netherlands: 'europe', 'New Caledonia': 'oceania', 'New Zealand': 'oceania', Nicaragua: 'north-america', Niger: 'africa', Nigeria: 'africa', 'North Korea': 'asia', 'Northern Cyprus': 'asia', 'N. Cyprus': 'asia', Norway: 'europe', Oman: 'asia', Pakistan: 'asia', Palestine: 'asia', Panama: 'north-america', 'Papua New Guinea': 'oceania', Paraguay: 'south-america', Peru: 'south-america', Philippines: 'asia', Poland: 'europe', Portugal: 'europe', 'Puerto Rico': 'north-america', Qatar: 'asia', Romania: 'europe', Russia: 'asia', Rwanda: 'africa', 'Saudi Arabia': 'asia', Senegal: 'africa', Serbia: 'europe', 'Sierra Leone': 'africa', Singapore: 'asia', Slovakia: 'europe', Slovenia: 'europe', 'Solomon Islands': 'oceania', 'Solomon Is.': 'oceania', Somalia: 'africa', 'South Africa': 'africa', 'South Korea': 'asia', 'South Sudan': 'africa', 'S. Sudan': 'africa', Spain: 'europe', 'Sri Lanka': 'asia', Sudan: 'africa', Suriname: 'south-america', Sweden: 'europe', Switzerland: 'europe', Syria: 'asia', Taiwan: 'asia', Tajikistan: 'asia', Tanzania: 'africa', Thailand: 'asia', 'Timor-Leste': 'asia', Togo: 'africa', 'Trinidad and Tobago': 'north-america', Tunisia: 'africa', Turkey: 'asia', Turkmenistan: 'asia', Uganda: 'africa', Ukraine: 'europe', 'United Arab Emirates': 'asia', 'United Kingdom': 'europe', 'United States': 'north-america', 'United States of America': 'north-america', America: 'north-america', Uruguay: 'south-america', Uzbekistan: 'asia', Vanuatu: 'oceania', Venezuela: 'south-america', Vietnam: 'asia', 'W. Sahara': 'africa', 'Western Sahara': 'africa', Yemen: 'asia', Zambia: 'africa', Zimbabwe: 'africa'
};

function classifyContinent(feature: GeoFeature) {
  const explicitContinent = feature.properties?.CONTINENT || feature.properties?.continent;
  if (explicitContinent) {
    const normalized = explicitContinent.toLowerCase();
    if (normalized === 'europe') return 'europe';
    if (normalized === 'north america') return 'north-america';
    if (normalized === 'south america') return 'south-america';
    if (normalized === 'africa') return 'africa';
    if (normalized === 'asia') return 'asia';
    if (normalized === 'oceania') return 'oceania';
  }
  return continentByCountryName[getFeatureName(feature)] || null;
}

function WorldGlobe({
  mounted,
  globeWidth,
  globeHeight,
  globeRef,
  countriesGeo,
  selectedCountries,
  hoveredCountry,
  setHoveredCountry,
  onCountryClick,
}: {
  mounted: boolean;
  globeWidth: number;
  globeHeight: number;
  globeRef: React.RefObject<GlobeMethods | undefined>;
  countriesGeo: GeoFeature[];
  selectedCountries: string[];
  hoveredCountry: string | null;
  setHoveredCountry: (value: string | null) => void;
  onCountryClick: (name: string) => void;
}) {
  const starsRef = useRef<unknown>(null);

  function handleGlobeReady() {
    if (!globeRef.current) return;

    // Dynamically import Three to create the starfield
    import('three').then((THREE) => {
      if (!globeRef.current) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const scene = (globeRef.current as any).scene?.();
      if (!scene) return;

      const count = 2000;
      const positions = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        // Random point on a sphere of radius 800
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = 750 + Math.random() * 100;
        positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = r * Math.cos(phi);
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

      const material = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 1.4,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.85,
      });

      const stars = new THREE.Points(geometry, material);
      stars.name = 'starfield';
      scene.add(stars);
      starsRef.current = stars;

      // Sync star rotation to the globe's auto-rotate controls each frame
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const controls = (globeRef.current as any).controls?.();
      if (controls) {
        const originalUpdate = controls.update.bind(controls);
        controls.update = () => {
          originalUpdate();
          // Mirror the globe scene rotation so stars move with it
          if (starsRef.current && scene) {
            (starsRef.current as THREE.Points).rotation.copy(scene.rotation);
          }
        };
      }
    });
  }

  return (
    <div className="flex h-full w-full items-center justify-center overflow-hidden">
      {mounted ? (
        <Globe
          ref={globeRef}
          width={globeWidth}
          height={globeHeight}
          style={{ display: 'block' }}
          backgroundColor="rgba(0,0,0,0)"
          showGlobe={true}
          showAtmosphere={true}
          atmosphereColor="rgba(186,230,253,0.6)"
          atmosphereAltitude={0.12}
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-day.jpg"
          onGlobeReady={handleGlobeReady}
          polygonsData={countriesGeo}
          polygonGeoJsonGeometry="geometry"
          polygonCapColor={(obj) => {
            const feature = obj as GeoFeature;
            const name = getFeatureName(feature);
            if (EXCLUDED_COUNTRIES.has(name)) return 'rgba(0,0,0,0)';
            if (selectedCountries.includes(name)) return 'rgba(103, 232, 249, 0.75)';
            if (hoveredCountry === name) return 'rgba(186, 230, 253, 0.55)';
            return 'rgba(255,255,255,0.04)';
          }}
          polygonSideColor={() => 'rgba(0,0,0,0)'}
          polygonStrokeColor={() => 'rgba(255,255,255,0.12)'}
          polygonAltitude={(obj) => {
            const feature = obj as GeoFeature;
            const name = getFeatureName(feature);
            if (hoveredCountry === name) return 0.06;
            if (selectedCountries.includes(name)) return 0.005;
            return 0.005;
          }}
          polygonLabel={(obj) => {
            const feature = obj as GeoFeature;
            const name = getFeatureName(feature);
            const selected = selectedCountries.includes(name);
            return `<div style="background:rgba(15,23,42,0.85);color:white;padding:4px 10px;border-radius:8px;font-size:12px;font-weight:600;">${name}${selected ? ' ✓' : ''}</div>`;
          }}
          onPolygonHover={(obj) => {
            const feature = obj as GeoFeature | null;
            setHoveredCountry(feature ? getFeatureName(feature) : null);
          }}
          enablePointerInteraction
          onPolygonClick={(obj) => {
            const feature = obj as GeoFeature;
            const name = getFeatureName(feature);
            if (name && !EXCLUDED_COUNTRIES.has(name)) onCountryClick(name);
          }}
        />
      ) : (
        <div className="flex items-center justify-center text-sm text-slate-400" style={{ height: globeHeight }}>
          Loading globe...
        </div>
      )}
    </div>
  );
}

function getContinentImage(key: string) {
  switch (key) {
    case 'europe':
      return 'linear-gradient(135deg, rgba(168,85,247,0.22), rgba(79,70,229,0.18)), url("https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&w=900&q=80")';
    case 'north-america':
      return 'linear-gradient(135deg, rgba(34,197,94,0.22), rgba(21,128,61,0.18)), url("https://images.unsplash.com/photo-1501594907352-04cda38ebc29?auto=format&fit=crop&w=900&q=80")';
    case 'south-america':
      return 'linear-gradient(135deg, rgba(249,115,22,0.22), rgba(180,83,9,0.18)), url("https://images.unsplash.com/photo-1483729558449-99ef09a8c325?auto=format&fit=crop&w=900&q=80")';
    case 'africa':
      return 'linear-gradient(135deg, rgba(234,179,8,0.22), rgba(161,98,7,0.18)), url("https://images.unsplash.com/photo-1523805009345-7448845a9e53?auto=format&fit=crop&w=900&q=80")';
    case 'asia':
      return 'linear-gradient(135deg, rgba(59,130,246,0.22), rgba(37,99,235,0.18)), url("https://images.unsplash.com/photo-1513415431605-d3b8c3f17248?auto=format&fit=crop&w=900&q=80")';
    case 'oceania':
      return 'linear-gradient(135deg, rgba(20,184,166,0.22), rgba(13,148,136,0.18)), url("https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?auto=format&fit=crop&w=900&q=80")';
    default:
      return 'linear-gradient(135deg, rgba(30,41,59,0.35), rgba(15,23,42,0.35))';
  }
}

export function WorldPicker({ regions, selectedCountries, onToggleCountry, initialContinentKey }: Props) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const globeBoxRef = useRef<HTMLDivElement>(null);
  const [globeSize, setGlobeSize] = useState({ width: 700, height: 500 });
  const [mounted, setMounted] = useState(false);
  const [countriesGeo, setCountriesGeo] = useState<GeoFeature[]>([]);
  const [activeContinentKey, setActiveContinentKey] = useState<string>(initialContinentKey ?? continents[0].key);
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!globeBoxRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) setGlobeSize({ width: Math.floor(width), height: Math.floor(height) });
    });
    ro.observe(globeBoxRef.current);
    return () => ro.disconnect();
  }, [open]);

  const activeContinent = useMemo(
    () => continents.find((c) => c.key === activeContinentKey) ?? continents[0],
    [activeContinentKey],
  );

  const groupedRegionCountries = useMemo(() => regions.flatMap((r) => r.countries), [regions]);

  const selectedCountPerContinent = useMemo(() => {
    const counts: Record<string, number> = {};
    countriesGeo.forEach((feature) => {
      const key = classifyContinent(feature);
      if (!key) return;
      const name = getFeatureName(feature);
      if (selectedCountries.includes(name)) {
        counts[key] = (counts[key] ?? 0) + 1;
      }
    });
    return counts;
  }, [countriesGeo, selectedCountries]);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    let cancelled = false;
    const EXCLUDED = EXCLUDED_COUNTRIES;
    fetch(geoJsonUrl)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setCountriesGeo(
          (data.features || []).filter((f: GeoFeature) => !EXCLUDED.has(getFeatureName(f)))
        );
      })
      .catch(() => { if (!cancelled) setCountriesGeo([]); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!mounted || !globeRef.current) return;
    globeRef.current.pointOfView(
      { lat: activeContinent.lat, lng: activeContinent.lng, altitude: activeContinent.altitude },
      1100,
    );
    const controls = globeRef.current.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.2;
    controls.enablePan = false;
    controls.minDistance = 120;
    controls.maxDistance = 300;
  }, [activeContinent, mounted]);

  // Only rotate to country when triggered from the list (not globe hover)
  function flyToCountry(country: string) {
    if (!globeRef.current) return;
    const feature = countriesGeo.find((f) => getFeatureName(f) === country);
    if (!feature?.geometry) return;
    const coords = feature.geometry.type === 'Polygon'
      ? (feature.geometry.coordinates as PolygonCoords)[0]
      : (feature.geometry.coordinates as MultiPolygonCoords)[0][0];
    if (!coords?.length) return;
    const lng = coords.reduce((sum, c) => sum + c[0], 0) / coords.length;
    const lat = coords.reduce((sum, c) => sum + c[1], 0) / coords.length;
    globeRef.current.pointOfView({ lat, lng, altitude: 1.8 }, 600);
  }

  const availableCountries = useMemo(() => {
    const regionCountries = new Set(groupedRegionCountries);
    return countriesGeo
      .filter((f) => classifyContinent(f) === activeContinent.key)
      .map((f) => getFeatureName(f))
      .filter(Boolean)
      .sort((a, b) => {
        const ap = regionCountries.has(a) ? 0 : 1;
        const bp = regionCountries.has(b) ? 0 : 1;
        if (ap !== bp) return ap - bp;
        return a.localeCompare(b);
      });
  }, [activeContinent.key, countriesGeo, groupedRegionCountries]);

  function openContinent(key: string) {
    setActiveContinentKey(key);
    setOpen(true);
  }

  return (
    <>
      {/* Continent card grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {continents.map((continent) => {
          const count = selectedCountPerContinent[continent.key] ?? 0;
          return (
            <button
              key={continent.key}
              type="button"
              onClick={() => openContinent(continent.key)}
              className="continent-card group relative flex min-h-[160px] flex-col overflow-hidden rounded-2xl border border-black/5 text-left transition duration-200 hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-[0_8px_24px_rgba(0,180,216,0.10)]"
            >
              <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: getContinentImage(continent.key) }} />
              <div className="absolute inset-0 bg-gradient-to-b from-black/10 to-black/40" />
              {count > 0 && (
                <span
                  className="absolute right-2.5 top-2.5 z-10 flex h-5 w-5 items-center justify-center rounded-full text-[0.65rem] font-bold text-white shadow"
                  style={{ background: continent.colors.badge }}
                >
                  {count}
                </span>
              )}
              <div className="relative mt-auto p-3.5">
                <p className="text-sm font-semibold text-white drop-shadow">{continent.label}</p>
                {count > 0 && <p className="text-xs text-white/75">{count} selected</p>}
              </div>
            </button>
          );
        })}
      </div>

      {/* Modal */}
      {open && (
        <div className="glow-modal-overlay">
          <div
            className="glow-modal-shell flex overflow-hidden"
            style={{ maxWidth: '88rem', width: '100%', height: 'min(88vh, 760px)' }}
          >
            {/* Globe panel — takes up majority of the width */}
            <div
              className="relative hidden min-w-0 flex-1 md:flex md:flex-col"
              style={{ background: 'linear-gradient(160deg, rgb(10 22 40), rgb(15 35 60))' }}
            >
              <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-8 py-4">
                <div>
                  <p className="onboarding-step-eyebrow text-sky-400">Globe view</p>
                  <p className="mt-0.5 text-sm text-white/60">Click any country to select or deselect it</p>
                </div>
                {selectedCountries.length > 0 && (
                  <span className="rounded-full bg-cyan-400/20 px-3 py-1 text-xs font-semibold text-cyan-300">
                    {selectedCountries.length} selected
                  </span>
                )}
              </div>
              {/* Globe fills remaining height */}
              <div className="min-h-0 flex-1 p-4">
                <div
                  ref={globeBoxRef}
                  className="h-full w-full overflow-hidden rounded-2xl border-2 border-sky-400/40 bg-[#0a1628]"
                  style={{ boxShadow: '0 0 0 4px rgba(56,189,248,0.15), 0 20px 60px rgba(0,0,0,0.4)' }}
                >
                  <WorldGlobe
                    mounted={mounted}
                    globeWidth={globeSize.width}
                    globeHeight={globeSize.height}
                    globeRef={globeRef}
                    countriesGeo={countriesGeo}
                    selectedCountries={selectedCountries}
                    hoveredCountry={hoveredCountry}
                    setHoveredCountry={setHoveredCountry}
                    onCountryClick={onToggleCountry}
                  />
                </div>
              </div>
            </div>

            {/* Country list panel — fixed right column */}
            <div className="flex w-full min-w-0 shrink-0 flex-col md:w-[380px]">
              <div className="glow-modal-header">
                <div>
                  <h3 className="glow-panel-title" style={{ fontSize: '1.35rem' }}>{activeContinent.label}</h3>
                  <p className="glow-section-label">{selectedCountries.length} countries selected total</p>
                </div>
                <button type="button" onClick={() => setOpen(false)} className="glow-button-secondary">
                  Done
                </button>
              </div>

              {/* Continent switcher */}
              <div className="glow-border-split px-5 py-3">
                <div className="glow-wrap-row-tight">
                  {continents.map((continent) => {
                    const count = selectedCountPerContinent[continent.key] ?? 0;
                    const selected = continent.key === activeContinent.key;
                    return (
                      <button
                        key={continent.key}
                        type="button"
                        onClick={() => setActiveContinentKey(continent.key)}
                        className={`glow-chip ${selected ? 'glow-chip-selected' : ''}`}
                      >
                        {continent.label}
                        {count > 0 && (
                          <span
                            className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-[0.6rem] font-bold text-white"
                            style={{ background: continent.colors.badge }}
                          >
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="glow-modal-body">
                <div className="glow-chip-list">
                  {availableCountries.map((country) => {
                    const selected = selectedCountries.includes(country);
                    return (
                      <button
                        key={country}
                        type="button"
                        onClick={() => onToggleCountry(country)}
                        onMouseEnter={() => { setHoveredCountry(country); flyToCountry(country); }}
                        onMouseLeave={() => setHoveredCountry(null)}
                        className={`glow-chip ${selected ? 'glow-chip-selected' : ''}`}
                      >
                        {country}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
