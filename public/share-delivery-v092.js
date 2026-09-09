export function shareUrlFor(origin, item) {
  if (!item?.locator || !item?.kind) return "";
  const prefix = item.kind === "secret" ? "/share/" : "/p/";
  return new URL(`${prefix}${encodeURIComponent(item.locator)}`, origin).href;
}

export function shareFileName(item, suffix = "png") {
  const scope = item?.scope === "trajectory" ? "trajectory" : "exam";
  const kind = item?.kind === "secret" ? "private" : "public";
  return `gaosan-coordinate-${kind}-${scope}.${suffix}`;
}
