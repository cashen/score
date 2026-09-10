export function shareUrlFor(origin, item) {
  if (!item?.locator || !item?.kind) return "";
  const prefix = item.kind === "secret" ? "/share/" : "/p/";
  return new URL(`${prefix}${encodeURIComponent(item.locator)}`, origin).href;
}
