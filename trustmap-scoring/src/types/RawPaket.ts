export type Category =
  | 'flood'
  | 'fire'
  | 'road_block'
  | 'shelter'
  | 'danger'

export interface RawPacket {
  id:        string
  category:  Category
  severity:  1 | 2 | 3 | 4 | 5
  lat:       number
  lng:       number
  timestamp: number
  note?:     string
  pubkey:    string
  signature: string
}