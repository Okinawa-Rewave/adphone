import { CameraView, useCameraPermissions, Camera } from 'expo-camera';
import React, { useState } from 'react';
import { Button, StyleSheet, Text, View, Alert } from 'react-native';

type Props = {
  onScanSuccess: (data: string) => void;
  onClose: () => void;
};

export default function QrScannerModal({ onScanSuccess, onClose }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  // カメラパーミッションのチェック
  if (!permission) {
    return <View style={styles.container}><Text>カメラへのアクセス許可をリクエスト中...</Text></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={{ textAlign: 'center' }}>
          QRコードをスキャンするにはカメラへのアクセスが必要です。
        </Text>
        <Button onPress={requestPermission} title="許可を付与" />
        <Button onPress={onClose} title="閉じる" color="red" />
      </View>
    );
  }

  // QRコード読み取り時の処理
  const handleBarCodeScanned = ({ type, data }: { type: string, data: string }) => {
    if (scanned) return;

    setScanned(true); // スキャン済みとしてフラグを立てる
    
    // データがJSON形式の緯度/経度であることを期待する
    // 例: "26.528,128.032"
    onScanSuccess(data);
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        // 💡 facing="back" に修正 (文字列定数を使用)
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
            barcodeTypes: ["qr"],
        }}
      >
        <View style={styles.overlay}>
          <Text style={styles.text}>宝の座標QRコードを読み取ってください</Text>
          <View style={styles.scannerFrame} />
        </View>
        <View style={styles.buttonContainer}>
          <Button title="閉じる" onPress={onClose} color="red" />
          {scanned && (
            <Button title="再スキャン" onPress={() => setScanned(false)} color="orange" />
          )}
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
    justifyContent: 'space-between',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  scannerFrame: {
    width: 250,
    height: 250,
    borderWidth: 5,
    borderColor: 'lime',
    borderRadius: 10,
    backgroundColor: 'transparent',
    opacity: 0.7,
  },
  text: {
    fontSize: 18,
    color: 'white',
    marginBottom: 50,
    textAlign: 'center',
  },
  buttonContainer: {
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(0,0,0,0.8)',
  }
});
