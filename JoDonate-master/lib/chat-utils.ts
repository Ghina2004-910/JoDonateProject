
export function conversationIdForPair(uidA: string, uidB: string): string {
  return uidA < uidB ? `${uidA}_${uidB}` : `${uidB}_${uidA}`;
}

export function peerFromConv(conversationId: string, myUid: string): string | null {
  const parts = conversationId.split("_");
  if (parts.length !== 2) return null;
  const [a, b] = parts;
  if (a === myUid) return b;
  if (b === myUid) return a;
  return null;
}
