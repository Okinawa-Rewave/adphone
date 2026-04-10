/**
 * trustmap.ts — TrustMapEngine のアプリ全体シングルトン
 * このモジュールを import することで、どこからでも同一エンジンを参照できる。
 */
import { TrustMapEngine } from '../trustmap-scoring/src/index';

const verifyFn = async (_pubkey: string, _payload: Uint8Array, _sig: string) => true;

export const trustMapEngine = new TrustMapEngine(verifyFn);
