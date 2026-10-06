/** Web Mercator helpers and safe output names, shared by previews and exports. */
export function mercatorY(latitude) {
  const lat = Math.max(-85.05112878, Math.min(85.05112878, latitude));
  return Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
}
export function geographicSourceRow(row, outputHeight, sourceHeight, south, north) {
  const y = mercatorY(north) - (row + .5) / outputHeight * (mercatorY(north) - mercatorY(south));
  const latitude = (2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180 / Math.PI;
  return Math.max(0, Math.min(sourceHeight - 1, (north - latitude) / (north - south) * sourceHeight));
}
export function hasImagery(pixels) {
  let covered = 0, min = 255, max = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 24) continue;
    covered++;
    min = Math.min(min, pixels[i], pixels[i + 1], pixels[i + 2]);
    max = Math.max(max, pixels[i], pixels[i + 1], pixels[i + 2]);
  }
  if (covered < pixels.length / 4 * .01) return false;
  // Only reject completely flat white/black backgrounds, never textured snow or water.
  return !(max - min === 0 && (max === 255 || max === 0));
}
export function uniqueFilename(base, used) {
  const safe = base.replace(/[^a-zA-Z0-9_-]/g, '_');
  let name = safe, suffix = 2;
  while (used.has(name)) name = safe + '_' + suffix++;
  used.add(name);
  return name;
}
