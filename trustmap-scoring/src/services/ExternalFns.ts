// Android開発者が実装して渡す関数の型定義
export type VerifyFn = (
    pubkey:  string,
    payload: Uint8Array,
    sig:     string
  ) => Promise<boolean>
