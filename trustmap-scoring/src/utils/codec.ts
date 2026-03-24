import type { RawPacket, Category } from '../types/RawPacket'

export const CATEGORY_ENCODE: Record<Category, number> = {
  flood:             0x01,
  fire:              0x02,
  road_block:        0x03,
  building_collapse: 0x04,
  tsunami:           0x05,
  landslide:         0x06,
  gas_leak:          0x07,
  danger:            0x08,
}

export const CATEGORY_DECODE: Record<number, Category> = {
  0x01: 'flood',
  0x02: 'fire',
  0x03: 'road_block',
  0x04: 'building_collapse',
  0x05: 'tsunami',
  0x06: 'landslide',
  0x07: 'gas_leak',
  0x08: 'danger',
}

// ┌──────┬─────┬──────────┬─────┬─────────┬──────────┬──────────┬──────────┐
// │  id  │ cat │ severity │ iss │   lat   │   lng    │   time   │  note    │
// │  4B  │ 1B  │   1B     │ 1B  │   4B    │   4B     │   4B     │ 0〜32B   │
// └──────┴─────┴──────────┴─────┴─────────┴──────────┴──────────┴──────────┘
const FIXED_SIZE = 4 + 1 + 1 + 1 + 4 + 4 + 4  // = 19バイト

export function encodePacket(p: RawPacket): Uint8Array {
  const noteBytes = p.note
    ? new TextEncoder().encode(p.note.slice(0, 32))
    : new Uint8Array(0)

  const buf  = new ArrayBuffer(FIXED_SIZE + noteBytes.length)
  const view = new DataView(buf)
  let offset = 0

  view.setUint32(offset,  parseInt(p.id, 16) >>> 0, false); offset += 4
  view.setUint8(offset,   CATEGORY_ENCODE[p.category] ?? 0x08);  offset += 1
  view.setUint8(offset,   p.severity);                            offset += 1
  view.setUint8(offset,   p.issuerType);                          offset += 1
  view.setFloat32(offset, p.lat, false);                          offset += 4
  view.setFloat32(offset, p.lng, false);                          offset += 4
  view.setUint32(offset,  p.timestamp >>> 0, false);              offset += 4
  new Uint8Array(buf, offset).set(noteBytes)

  return new Uint8Array(buf)
}

export function decodePacket(
  bytes:     Uint8Array,
  pubkey:    string,
  signature: string
): RawPacket | null {
  if (bytes.length < FIXED_SIZE) return null

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let offset = 0

  const id         = view.getUint32(offset, false).toString(16).padStart(8, '0'); offset += 4
  const catByte    = view.getUint8(offset);  offset += 1
  const category   = CATEGORY_DECODE[catByte]
  if (!category) return null

  const severity   = view.getUint8(offset) as 1|2|3|4|5; offset += 1
  if (severity < 1 || severity > 5) return null

  const issuerType = view.getUint8(offset) as 0|1;        offset += 1
  const lat        = view.getFloat32(offset, false);       offset += 4
  const lng        = view.getFloat32(offset, false);       offset += 4
  const timestamp  = view.getUint32(offset, false);        offset += 4
  const note       = bytes.length > FIXED_SIZE
    ? new TextDecoder().decode(bytes.slice(offset))
    : undefined

  return { id, category, severity, issuerType, lat, lng, timestamp, note, pubkey, signature }
}
