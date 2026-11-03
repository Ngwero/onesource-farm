export type BlockPolygon = { type: 'Polygon'; coordinates: [number, number][][] };

/** Area-weighted centroid in the local lon/lat plane; suitable for farm-sized plots. */
export function polygonCentroid(polygon: BlockPolygon): { lat: number; lng: number } | null {
  let area = 0;
  let x = 0;
  let y = 0;
  const origin = polygon.coordinates[0]?.[0];
  if (!origin) return null;
  for (const [index, ring] of polygon.coordinates.entries()) {
    let crossSum = 0;
    let ringX = 0;
    let ringY = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      const ax = ring[i][0] - origin[0];
      const ay = ring[i][1] - origin[1];
      const bx = ring[i + 1][0] - origin[0];
      const by = ring[i + 1][1] - origin[1];
      const cross = ax * by - bx * ay;
      crossSum += cross;
      ringX += (ax + bx) * cross;
      ringY += (ay + by) * cross;
    }
    if (Math.abs(crossSum) < 1e-16) return null;
    const weight = Math.abs(crossSum) * (index === 0 ? 1 : -1);
    area += weight;
    x += (ringX / (3 * crossSum)) * weight;
    y += (ringY / (3 * crossSum)) * weight;
  }
  if (area <= 1e-16) return null;
  return { lng: origin[0] + x / area, lat: origin[1] + y / area };
}
