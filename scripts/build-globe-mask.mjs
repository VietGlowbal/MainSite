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
 * Usage:
 *   curl -sSo /tmp/land-110m.json https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json
 *   node scripts/build-globe-mask.mjs /tmp/land-110m.json
 */
import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const WIDTH = 1024;
const HEIGHT = 512;

const input = process.argv[2];
if (!input) {
  console.error('usage: node scripts/build-globe-mask.mjs <land-110m.json>');
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
 * Every ring in the `land` object, whatever shape it takes.
 *
 * world-atlas ships land as a GeometryCollection of Polygons and MultiPolygons,
 * so this walks all three levels rather than assuming one. The nesting is the
 * only fiddly part: a Polygon's `arcs` is an array of rings, a MultiPolygon's is
 * an array of those.
 */
function collectRings(geometry, into) {
  if (geometry.type === 'GeometryCollection') {
    for (const child of geometry.geometries) collectRings(child, into);
    return;
  }
  if (geometry.type === 'Polygon') {
    for (const indices of geometry.arcs) into.push(indices);
    return;
  }
  if (geometry.type === 'MultiPolygon') {
    for (const polygon of geometry.arcs) for (const indices of polygon) into.push(indices);
  }
}

const rings = [];
collectRings(topo.objects.land, rings);

const paths = [];
for (const indices of rings) {
  const points = ring(indices);
  if (points.length < 3) continue;
  const d = points
    .map(([lon, lat], i) => `${i === 0 ? 'M' : 'L'}${px(lon).toFixed(1)} ${py(lat).toFixed(1)}`)
    .join('');
  paths.push(`${d}Z`);
}

/*
 * White land on black sea, and `fill-rule: evenodd` so a ring inside a ring
 * (a lake, an inland sea) punches through rather than filling solid.
 */
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
<rect width="${WIDTH}" height="${HEIGHT}" fill="#000"/>
<path fill="#fff" fill-rule="evenodd" d="${paths.join('')}"/>
</svg>`;

const out = 'public/hero-globe-land.png';
await sharp(Buffer.from(svg))
  // Greyscale + palette: the component only reads one channel, and a 2-colour
  // palette is a fraction of the size of RGB.
  .greyscale()
  .png({ palette: true, colours: 2, compressionLevel: 9, effort: 10 })
  .toFile(out);

const { size } = await sharp(out).metadata().then(async (m) => ({
  size: (await readFile(out)).length,
  ...m,
}));
console.log(`${out}  ${WIDTH}x${HEIGHT}  ${size} bytes  ${paths.length} rings`);
