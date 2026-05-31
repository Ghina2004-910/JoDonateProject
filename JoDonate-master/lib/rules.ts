export function canRequestItem(status: string): boolean {
  return status === "available" || status === "requested";
}

export function canMarkDonated(status: string): boolean {
  return status === "accepted";
}
