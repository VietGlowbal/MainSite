#!/usr/bin/env node
/**
 * Bake public/hero-globe-land.png — the land/sea mask the hero globe samples.
 *
 * WHY BAKE IT. The prototype this came from fetched
 * cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json at runtime and rasterised
 * it with d3-geo + topojson-client in the browser. On the homepage hero that
 * means a third-party request and two libraries on the critical path, to
 * produce a bitmap that never changes. This does the same work once, offline,
 * and ships a ~20KB PNG the component reads with one Image().
 *
 * No new dependencies: the TopoJSON arc format is delta-encoded integers plus a
 * linear transform, which is short enough to decode here, and sharp (already
 * present for next/image) rasterises the resulting SVG.
 *
 * ─── WHY 50m AND WHY GREYSCALE ──────────────────────────────────────────────
 *
 * This used to bake land-110m at 1024x512 into a 2-colour palette PNG. Both
 * halves of that were wrong for the way the component samples it.
 *
 * 110m is a world map for a 200px thumbnail. At the ~2° sampling the globe uses
 * it puts a dot on Cyprus and loses the Panama isthmus, so the silhouette had
 * lone dots adrift in open ocean and gaps where land plainly is. 50m carries the
 * coastline detail the sampler can actually resolve.
 *
 * A 2-colour palette throws away the rasteriser's anti-aliasing, and the
 * anti-aliasing is the useful part: a grey edge pixel is a statement about how
 * much land is in it. The component averages a whole cell and keeps the dot only
 * if enough of the cell is land, which is what stops a one-pixel island from
 * becoming a dot in the middle of the Pacific. That needs 8-bit grey.
 *
 * Usage:
 *   curl -sSo /tmp/land-50m.json https://cdn.jsdelivr.net/npm/world-atlas@2/land-50m.json
 *   node scripts/build-globe-mask.mjs /tmp/land-50m.json
 */
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';

const WIDTH = 2048;
const HEIGHT = 1024;

const input = process.argv[2];
if (!input) {
  console.error('usage: node scripts/build-globe-mask.mjs <land-50m.json>');
  process.exit(1);
}

const topo = JSON.parse(await readFile(input, 'utf8'));
const { scale, translate } = topo.transform;

/**
 * One TopoJSON arc as absolute [lon, lat] pairs.
 *
 * Positions are stored as deltas against the previous point, quantised to
 * integers — so decoding is a running sum, then the topology's linear transform
 * back to degrees.
 */
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

/** A negative index means "that arc, reversed" — ~i is the encoding. */
function ring(indices) {
  const points = [];
  for (const index of indices) {
    const arc = index < 0 ? [...arcs[~index]].reverse() : arcs[index];
    // Consecutive arcs share an endpoint; dropping the duplicate keeps the
    // path from doubling back on itself by a hair, which shows as a seam.
    points.push(...(points.length > 0 ? arc.slice(1) : arc));
  }
  return points;
}

/** Equirectangular: the projection the component's lon/lat sampling assumes. */
const px = (lon) => ((lon + 180) / 360) * WIDTH;
const py = (lat) => ((90 - lat) / 180) * HEIGHT;

/**
 * The `land` object as a list of polygons, each polygon a list of its rings.
 *
 * world-atlas ships land as a GeometryCollection of Polygons and MultiPolygons,
 * so this walks all three levels rather than assuming one.
 *
 * ⚠️ GROUPING BY POLYGON IS LOAD-BEARING, and flattening it is the bug that made
 * Antarctica hollow. `fill-rule: evenodd` is per <path>: within one path a ring
 * inside a ring punches a hole, which is what we want for a lake. But it cannot
 * tell "lake" from "two land masses that overlap", so with every ring of the
 * whole world in a single path, Antarctica's mainland and the ice shelves laid
 * over it cancelled to sea and the continent came out as a coastal outline
 * around a hole. One <path> per polygon keeps evenodd's reach inside the polygon
 * it belongs to, and separate paths can only ever union — both are painted white.
 */
function collectPolygons(geometry, into) {
  if (geometry.type === 'GeometryCollection') {
    for (const child of geometry.geometries) collectPolygons(child, into);
    return;
  }
  if (geometry.type === 'Polygon') {
    into.push(geometry.arcs);
    return;
  }
  if (geometry.type === 'MultiPolygon') {
    for (const polygon of geometry.arcs) into.push(polygon);
  }
}

/**
 * A ring that is nothing but a line along 90°N or 90°S, enclosing no area.
 *
 * The tolerance is a tenth of a degree because world-atlas quantises the pole to
 * 89.999, and at this raster a tenth of a degree is under a pixel either way.
 */
function isPoleRing(points) {
  return points.every(([, lat]) => Math.abs(Math.abs(lat) - 90) < 0.1);
}

/**
 * Close a pole-touching polygon over the pole instead of across the map.
 *
 * ⚠️ ANTARCTICA IS NOT SHAPED LIKE THE OTHER 1418 POLYGONS, and taking it at
 * face value is why the south of it came out hollow. world-atlas gives it two
 * rings: the coastline, running west to east from the antimeridian back to the
 * antimeridian, and a second ring that is a bare line along 90°S. Neither
 * encloses the interior. Drawn literally, the coast ring's closing segment is a
 * chord straight across the map at about 84°S, so the fill covers the coastal
 * band and everything from there to the pole reads as sea — the continent comes
 * out as a ring of dots around an empty middle.
 *
 * The two rings are meant to be read as one boundary joined at the antimeridian,
 * which is a seam in this projection and not a real edge. So: walk the coast,
 * step out to +180 rather than jumping back to -180, drop to the pole, run along
 * it to -180, and let the closing Z climb the -180 meridian back to the start.
 * That is the same boundary the data describes, minus the spurious chord, and
 * the polar cap fills.
 */
function closeOverPole(coast, poleLat) {
  const withoutWrap = coast.slice(0, -1);
  const lastLat = withoutWrap[withoutWrap.length - 1][1];
  return [...withoutWrap, [180, lastLat], [180, poleLat], [-180, poleLat]];
}

function subpath(points) {
  return `${points
    .map(([lon, lat], i) => `${i === 0 ? 'M' : 'L'}${px(lon).toFixed(1)} ${py(lat).toFixed(1)}`)
    .join('')}Z`;
}

const polygons = [];
collectPolygons(topo.objects.land, polygons);

let ringCount = 0;
let polesClosed = 0;
const paths = [];
for (const polygon of polygons) {
  let rings = polygon.map(ring).filter((points) => points.length >= 3);
  if (rings.length === 0) continue;

  const poleRing = rings.find(isPoleRing);
  if (poleRing) {
    rings = rings.filter((r) => r !== poleRing);
    const coast = rings[0];
    // Only rewrite when the coast really does begin and end on the seam; if a
    // future dataset shapes this differently, leave it alone rather than
    // inventing a boundary for it.
    if (coast && Math.abs(Math.abs(coast[0][0]) - 180) < 0.1) {
      rings[0] = closeOverPole(coast, poleRing[0][1] > 0 ? 90 : -90);
      polesClosed += 1;
    }
  }

  ringCount += rings.length;
  paths.push(
    `<path fill="#fff" fill-rule="evenodd" d="${rings.map(subpath).join('')}"/>`,
  );
}

/* White land on black sea. */
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
<rect width="${WIDTH}" height="${HEIGHT}" fill="#000"/>
${paths.join('\n')}
</svg>`;

const out = 'public/hero-globe-land.png';
await sharp(Buffer.from(svg), { density: 72 })
  // Greyscale, 8-bit: the component reads one channel, and the intermediate
  // greys along the coast are the coverage signal it averages over a cell.
  .greyscale()
  .png({ compressionLevel: 9, effort: 10 })
  .toFile(out);

const { size } = await sharp(out).metadata().then(async (m) => ({
  size: (await readFile(out)).length,
  ...m,
}));
console.log(
  `${out}  ${WIDTH}x${HEIGHT}  ${size} bytes  ${polygons.length} polygons  ` +
    `${ringCount} rings  ${polesClosed} closed over a pole`,
);
