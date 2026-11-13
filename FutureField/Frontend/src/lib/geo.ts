export type LatLng = [number, number];

export function polygonHectares(points: LatLng[]): number {
  if (points.length < 3) return 0;
  const rad = Math.PI / 180;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    sum += (b[1] - a[1]) * rad * (2 + Math.sin(a[0] * rad) + Math.sin(b[0] * rad));
  }
  return Math.abs(sum) * 6378137 ** 2 / 2 / 10000;
}

export function verticesToGeoJSON(vertices: LatLng[]) {
  const ring = vertices.map(([lat, lon]) => [lon, lat]);
  if (ring.length) ring.push(ring[0]);
  return { type: "Polygon", coordinates: [ring] };
}

export function geoJSONToVertices(boundary: any): LatLng[] {
  const ring: number[][] = boundary?.coordinates?.[0] || [];
  if (!ring.length) return [];
  const pts = ring.map(([lon, lat]) => [lat, lon] as LatLng);
  const first = pts[0], last = pts[pts.length - 1];
  if (first && last && first[0] === last[0] && first[1] === last[1]) return pts.slice(0, -1);
  return pts;
}

export function fieldCenter(field: { centroid_lat?: number; centroid_lon?: number; boundary?: any } | null): LatLng {
  if (field?.centroid_lat && field?.centroid_lon) return [field.centroid_lat, field.centroid_lon];
  const pts = geoJSONToVertices(field?.boundary);
  if (!pts.length) return [23.685, 90.3563];
  const lat = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const lon = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return [lat, lon];
}
