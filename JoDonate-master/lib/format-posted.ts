
export function formatPostedTime(ts: unknown): string {
  try {
    const d =
      ts &&
      typeof ts === "object" &&
      "toDate" in ts &&
      typeof (ts as { toDate: () => Date }).toDate === "function"
        ? (ts as { toDate: () => Date }).toDate()
        : null;
    if (!d || Number.isNaN(d.getTime())) return "";
    const sec = Math.floor((Date.now() - d.getTime()) / 1000);
    if (sec < 60) return "Just now";
    if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
    if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
    if (sec < 604800) return `${Math.floor(sec / 86400)}d ago`;
    return d.toLocaleDateString();
  } catch {
    return "";
  }
}
