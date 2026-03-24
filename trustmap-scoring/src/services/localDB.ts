import type { RawPacket } from '../types/RawPacket'

const MAX_SIZE = 500  // 保持する最大パケット数

export class LocalDB {
  private packets = new Map<string, RawPacket>()
  private seenIds = new Set<string>()

  save(packet: RawPacket): void {
    this.packets.set(packet.id, packet)
    this.seenIds.add(packet.id)

    // 上限を超えたら最も古いパケットを削除
    if (this.packets.size > MAX_SIZE) {
      const oldest = [...this.packets.values()]
        .sort((a, b) => a.timestamp - b.timestamp)[0]
      this.packets.delete(oldest.id)
    }
  }

  isDuplicate(id: string): boolean {
    return this.seenIds.has(id)
  }

  getAll(): RawPacket[] {
    return [...this.packets.values()]
  }

  size(): number {
    return this.packets.size
  }

  clear(): void {
    this.packets.clear()
    this.seenIds.clear()
  }
}