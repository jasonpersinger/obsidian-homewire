/** A tiny inline-SVG line chart; colour comes from CSS (`currentColor`). */
export function sparkline(el: HTMLElement, values: number[], width: number, height: number): void {
  if (values.length < 2) return;
  const lo = Math.min(...values), hi = Math.max(...values), span = hi - lo || 1;
  const step = width / (values.length - 1);
  const points = values.map((v, i) => `${(i * step).toFixed(1)},${(height - 1 - ((v - lo) / span) * (height - 2)).toFixed(1)}`);
  el.createSvg("svg", { cls: "hw-spark", attr: { width, height, viewBox: `0 0 ${width} ${height}` } }, (svg) => {
    svg.createSvg("polyline", { attr: { points: points.join(" "), fill: "none", stroke: "currentColor", "stroke-width": 1.2 } });
  });
}
