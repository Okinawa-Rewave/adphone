export type Category =
  | 'flood'
  | 'fire'
  | 'road_block'
  | 'building_collapse'
  | 'tsunami'
  | 'landslide'
  | 'gas_leak'
  | 'danger'

export type IssuerType = 0 | 1  // 0: 一般ユーザー  1: 公的機関

export interface RawPacket {
  id:         string
  category:   Category
  severity:   1 | 2 | 3 | 4 | 5
  lat:        number
  lng:        number
  timestamp:  number
  issuerType: IssuerType
  note?:      string
  pubkey:     string
  signature:  string
}
