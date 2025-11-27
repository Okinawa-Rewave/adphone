// react-native-ble-plx から BLE 管理クラスとデバイス型をインポート
import { BleManager, Device } from 'react-native-ble-plx';
import { Buffer } from 'buffer'; // Base64デコード用

const manager = new BleManager();

const TARGET_DEVICE_NAME = 'ESP32-GPS-3';

let connectedDevice: Device | null = null;

// 受信した座標を呼び出し側に渡すコールバックの型
type LocationCallback = (lat: number, lon: number) => void;

/**
 * BLE デバイスをスキャンして接続する処理
 * @param onLocationReceived 座標データ受信用のコールバック関数（任意）
 */
type ConnectOptions = {
  onLocationReceived?: (lat: number, lon: number) => void;
};
export async function connectToDevice(options?: ConnectOptions): Promise<void> {
  const { onLocationReceived } = options || {};
  return new Promise((resolve, reject) => {
    manager.startDeviceScan(null, null, async (error, device) => {
      if (error) {
        manager.stopDeviceScan();
        reject(error);
        return;
      }

      if (!device) return;

      if (device.name === TARGET_DEVICE_NAME) {
        manager.stopDeviceScan();
        try {
          const connected = await device.connect();
          connectedDevice = connected;
          console.log('接続成功:', connected.name);

          // サービス・キャラクタリスティックUUIDはESP32に合わせる
          const SERVICE_UUID = '32345678-1234-1234-1234-1234567890ab';
          const CHAR_UUID = 'cbcd1234-5678-90ab-cdef-1234567890ab';

          // 通知を受け取る設定
          await connected.discoverAllServicesAndCharacteristics();
          await connected.monitorCharacteristicForService(
            SERVICE_UUID,
            CHAR_UUID,
            (error, characteristic) => {
              if (error || !characteristic?.value) return;

              if (onLocationReceived) {
                try {
                  // Base64 → string
                  const decoded = Buffer.from(characteristic.value, 'base64').toString('utf-8');
                  // カンマ区切りで lat, lon
                  const [latStr, lonStr] = decoded.split(',');
                  const lat = parseFloat(latStr);
                  const lon = parseFloat(lonStr);
                  if (!isNaN(lat) && !isNaN(lon)) {
                    onLocationReceived(lat, lon);
                  }
                } catch (err) {
                  console.error('座標デコードエラー:', err);
                }
              }
            }
          );

          resolve();
        } catch (err) {
          reject(err);
        }
      }
    });
  });
}

/**
 * BLE デバイス切断
 */
export async function disconnectDevice(): Promise<void> {
  if (connectedDevice) {
    try {
      await connectedDevice.cancelConnection();
      console.log('切断完了');
      connectedDevice = null;
    } catch (error) {
      console.error('切断失敗:', error);
    }
  } else {
    console.log('切断対象デバイスなし');
  }
}
