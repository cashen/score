
export function normalizeDelta(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.round(number * 10) / 10;
}

export function scoreDeltaParts(metric) {
  if (!metric || metric.kind !== "score") return null;
  const delta = normalizeDelta(metric.delta);
  if (delta == null) return null;
  const amount = Math.abs(delta).toFixed(1).replace(/\.0$/, "");
  const compact = delta > 0 ? `+${amount} 分` : delta < 0 ? `−${amount} 分` : "0 分";
  const direction = delta > 0 ? "up" : delta < 0 ? "down" : "steady";
  return { delta, amount, compact, direction };
}

export function shouldShowScoreDelta(metric) {
  const parts = scoreDeltaParts(metric);
  return Boolean(parts && Math.abs(parts.delta) >= 1);
}

export function scoreChangeSentence(metric) {
  const parts = scoreDeltaParts(metric);
  if (!parts) return "";
  if (parts.delta > 0) return `比上一场高 ${parts.amount} 分`;
  if (parts.delta < 0) return `比上一场低 ${parts.amount} 分`;
  return "和上一场一样";
}

export function scoreChangeDetail(metric) {
  const parts = scoreDeltaParts(metric);
  if (!parts || !Number.isFinite(Number(metric.previousValue)) || !Number.isFinite(Number(metric.currentValue))) return "";
  const previous = Number(metric.previousValue).toFixed(1).replace(/\.0$/, "");
  const current = Number(metric.currentValue).toFixed(1).replace(/\.0$/, "");
  return `${previous} → ${current} 分`;
}
