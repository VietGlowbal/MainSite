#!/usr/bin/env node
/**
 * Bake public/hero-globe-countries.png and
 * src/features/marketing/domain/globe-country-index.ts — the country lookup the
 * hero globe uses to light only the countries GlowBal has scholarship data for.
 *
 * WHY A RASTER AND NOT BOUNDING BOXES. The design prototype tested each dot
 * against one lat/lon box per country. A box is a rectangle and a country is
 * not: the United States box lights half of northern Mexico, and every new
 * country in the database would need someone to hand-draw another box. This
 * paints every country in its own flat grey level (index 1–241, 0 = sea) with
 * anti-aliasing OFF, so the globe reads a dot's country with one pixel lookup
 * and a border falls where the border is.
 *
 * ⚠️ `shape-rendering="crispEdges"` IS LOAD-BEARING. The land mask
 * (build-globe-mask.mjs) wants anti-aliasing because a grey edge pixel is a
 * coverage estimate. Here a grey edge pixel would be a DIFFERENT COUNTRY's
 * index — the blend of Germany (97) and France (79) is somebody else.
 *
 * The module also carries one representative point per country (the centroid
 * of its largest polygon). Singapore and Hong Kong are smaller than a globe dot,
 * so no land dot ever lands on them; the component places a dot at that point
 * for any lit country that would otherwise be invisible.
 *
 * Same input format as build-globe-mask.mjs, and d3-geo (already a dependency)
 * does the projection, so there is no hand-written antimeridian handling.
 *
 * Usage:
 *   curl -sSo /tmp/countries-50m.json https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json
 *   node scripts/build-globe-countries.mjs /tmp/countries-50m.json
 */
import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { geoArea, geoCentroid, geoEquirectangular, geoPath } from 'd3-geo';

const WIDTH = 1024;
const HEIGHT = 512;

/**
 * Natural Earth names that differ from the ones in `universities.country` /
 * `scholarships.country`, which is what the globe is matched against.
 */
const NAME_FIXES = {
  'United States of America': 'United States',
  Czechia: 'Czech Republic',
  'Dem. Rep. Korea': 'North Korea',
  'Bosnia and Herz.': 'Bosnia and Herzegovina',
  'Dominican Rep.': 'Dominican Republic',
  'Central African Rep.': 'Central African Republic',
  'Dem. Rep. Congo': 'Democratic Republic of the Congo',
  'S. Sudan': 'South Sudan',
  'Eq. Guinea': 'Equatorial Guinea',
  'Solomon Is.': 'Solomon Islands',
  "Côte d'Ivoire": 'Ivory Coast',
};

const input = process.argv[2];
if (!input) {
  console.error('usage: node scripts/build-globe-countries.mjs <countries-50m.json>');
  process.exit(1);
}

const topo = JSON.parse(await readFile(input, 'utf8'));
const { scale, translate } = topo.transform;

/** Delta-decoded TopoJSON arc → absolute [lon, lat] pairs. */
function decodeArc(arc) {
  let x = 0;
  let y = 0;
  return arc.map(([dx, dy]) => {
    x += dx;
    y += dy;
    return [x * scale[0] + translate[0], y * scale[1] + translate[1]];
  });
}
const arcs = topo.arcs.map(decodeArc);

function ring(indices) {
  const points = [];
  for (const index of indices) {
    const arc = index < 0 ? [...arcs[~index]].reverse() : arcs[index];
    points.push(...(points.length > 0 ? arc.slice(1) : arc));
  }
  return points;
}

function toGeometry(geometry) {
  if (geometry.type === 'Polygon') {
    return { type: 'Polygon', coordinates: geometry.arcs.map(ring) };
  }
  if (geometry.type === 'MultiPolygon') {
    return { type: 'MultiPolygon', coordinates: geometry.arcs.map((polygon) => polygon.map(ring)) };
  }
  return null;
}

/** The centroid of the largest polygon, so France resolves to Europe, not Guiana. */
function representativePoint(geometry) {
  if (geometry.type === 'Polygon') return geoCentroid(geometry);
  let best = null;
  let bestArea = -1;
  for (const coordinates of geometry.coordinates) {
    const polygon = { type: 'Polygon', coordinates };
    const area = geoArea(polygon);
    if (area > bestArea) {
      bestArea = area;
      best = polygon;
    }
  }
  return geoCentroid(best);
}

// Scale 1024 / 2π puts ±180° on the image edges; the default centre (0, 0) lands
// in the middle — the same lon/lat → pixel mapping the component samples with.
const projection = geoEquirectangular()
  .scale(WIDTH / (2 * Math.PI))
  .translate([WIDTH / 2, HEIGHT / 2]);
const path = geoPath(projection);

const countries = [];
const paths = [];
for (const raw of topo.objects.countries.geometries) {
  const geometry = toGeometry(raw);
  if (geometry === null) continue;
  const name = NAME_FIXES[raw.properties.name] ?? raw.properties.name;
  const index = countries.length + 1;
  if (index > 255) throw new Error('More than 255 countries — they no longer fit one channel.');
  const [lon, lat] = representativePoint(geometry);
  countries.push({ index, name, lat: Number(lat.toFixed(2)), lon: Number(lon.toFixed(2)) });
  const d = path(geometry);
  if (d) paths.push(`<path fill="rgb(${index},${index},${index})" d="${d}"/>`);
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" shape-rendering="crispEdges">
<rect width="${WIDTH}" height="${HEIGHT}" fill="#000"/>
${paths.join('\n')}
</svg>`;

const out = 'public/hero-globe-countries.png';
await sharp(Buffer.from(svg), { density: 72 })
  .greyscale()
  .png({ compressionLevel: 9, effort: 10 })
  .toFile(out);

// Verify the crisp-edges promise: every pixel must be sea or a real index.
const { data } = await sharp(out).raw().toBuffer({ resolveWithObject: true });
const valid = new Set([0, ...countries.map((c) => c.index)]);
let stray = 0;
for (let i = 0; i < data.length; i++) if (!valid.has(data[i])) stray += 1;

const moduleSource = `/**
 * GENERATED by scripts/build-globe-countries.mjs — do not edit by hand.
 *
 * Index → country for public/hero-globe-countries.png (grey level = index,
 * 0 = sea), plus one representative point per country for the ones too small
 * to own a globe dot. Names follow \`universities.country\`.
 */
export type GlobeCountryEntry = {
  readonly name: string;
  readonly lat: number;
  readonly lon: number;
};

export const GLOBE_COUNTRY_MASK_SRC = '/hero-globe-countries.png';

export const GLOBE_COUNTRY_INDEX: ReadonlyArray<GlobeCountryEntry | null> = [
  null,
${countries.map((c) => `  { name: ${JSON.stringify(c.name)}, lat: ${c.lat}, lon: ${c.lon} },`).join('\n')}
];
`;
await writeFile('src/features/marketing/domain/globe-country-index.ts', moduleSource);

const size = (await readFile(out)).length;
console.log(
  `wrote ${out} (${WIDTH}x${HEIGHT}, ${(size / 1024).toFixed(1)} KB), ${countries.length} countries, ${stray} stray pixels`,
);
