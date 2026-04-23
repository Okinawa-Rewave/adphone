import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';
import GemmaModule from './src/native/GemmaModule';

const DEFAULT_MODEL_PATH = '/sdcard/gemma-3n-E4B-it-int4.litertlm';

const App = () => {
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();
  const camera = useRef<Camera>(null);

  const [isModelInitialized, setIsModelInitialized] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string>('');
  const [cameraActive, setCameraActive] = useState(false);

  useEffect(() => {
    const setup = async () => {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert('Permission Error', 'Camera permission is required to use this app.');
          return;
        }
      }

      if (!hasPermission) {
        const granted = await requestPermission();
        if (!granted) {
          Alert.alert('Error', 'Camera permission is required');
          return;
        }
      }

      setCameraActive(true);

      try {
        console.log('Initializing Gemma model...');
        const success = await GemmaModule.initializeModel(DEFAULT_MODEL_PATH);
        if (success) {
          setIsModelInitialized(true);
          console.log('Gemma model initialized successfully!');
        }
      } catch (error) {
        console.warn('Failed to initialize model:', error);
        setAnalysisResult('モデル初期化失敗: ' + (error instanceof Error ? error.message : '不明なエラー'));
      }
    };

    setup();
  }, [hasPermission, requestPermission]);

  const takePhoto = async () => {
    if (!camera.current || !isModelInitialized || isProcessing) return;

    try {
      setIsProcessing(true);
      setAnalysisResult('Gemma 3で画像を解析中...');

      const photo = await camera.current.takePhoto({
        flash: 'off',
      });

      // 日本語で回答するプロンプト
      const prompt = "<start_of_turn>user\n<image>\nあなたは建物被害調査の専門家です。この建物画像を見て崩壊度を判定してください。\n\n崩壊度1: 外壁のひび割れや窓ガラス破損など軽微な損傷\n崩壊度2: 壁の崩落・屋根の部分損壊など中程度の損傷\n崩壊度3: 建物の大規模崩壊・倒壊・使用不能な状態\n\n「崩壊度: X」とだけ答えてください。<end_of_turn>\n<start_of_turn>model\n";
      const response = await GemmaModule.generateResponseWithImage(prompt, photo.path);

      setAnalysisResult(response);
    } catch (error) {
      console.error('Analysis failed:', error);
      setAnalysisResult('エラー: ' + (error instanceof Error ? error.message : '不明なエラー'));
    } finally {
      setIsProcessing(false);
    }
  };

  const testTextInference = async () => {
    if (!isModelInitialized || isProcessing) return;

    try {
      setIsProcessing(true);
      setAnalysisResult('考え中...');

      const prompt = "<start_of_turn>user\nあなたは誰ですか？日本語で簡潔に答えてください。<end_of_turn>\n<start_of_turn>model\n";
      const response = await GemmaModule.generateResponse(prompt);

      setAnalysisResult(response);
    } catch (error) {
      console.error('Text inference failed:', error);
      setAnalysisResult('エラー: ' + (error instanceof Error ? error.message : '不明なエラー'));
    } finally {
      setIsProcessing(false);
    }
  };

  if (device == null) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>カメラデバイスが見つかりません</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.cameraContainer}>
        {cameraActive && (
          <Camera
            ref={camera}
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={true}
            photo={true}
          />
        )}
      </View>

      <View style={styles.resultContainer}>
        <ScrollView style={styles.scrollArea}>
          <Text style={styles.resultHeader}>Gemma 3 解析結果：</Text>
          {isProcessing ? (
            <ActivityIndicator size="small" color="#0000ff" />
          ) : (
            <Text style={styles.resultText}>
              {analysisResult || (isModelInitialized ? '準備完了！' : '初期化中...')}
            </Text>
          )}
        </ScrollView>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.shutterButton, (!isModelInitialized || isProcessing) && styles.disabledButton, { marginBottom: 10, backgroundColor: '#34C759' }]}
          onPress={testTextInference}
          disabled={!isModelInitialized || isProcessing}
        >
          <Text style={styles.buttonText}>{isProcessing ? '処理中...' : 'テキストチャット'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.shutterButton, (!isModelInitialized || isProcessing) && styles.disabledButton]}
          onPress={takePhoto}
          disabled={!isModelInitialized || isProcessing}
        >
          <Text style={styles.buttonText}>{isProcessing ? '解析中...' : '撮影して解析'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  errorText: { color: '#fff', fontSize: 18 },
  cameraContainer: { flex: 2, width: '100%', overflow: 'hidden' },
  resultContainer: { width: '100%', flex: 1, backgroundColor: '#fff', padding: 15, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  scrollArea: { flex: 1 },
  resultHeader: { fontWeight: 'bold', fontSize: 16, marginBottom: 8, color: '#333' },
  resultText: { fontSize: 14, color: '#444', lineHeight: 20 },
  buttonContainer: { width: '100%', backgroundColor: '#fff', paddingBottom: 30, paddingHorizontal: 20, alignItems: 'center' },
  shutterButton: { backgroundColor: '#007AFF', paddingVertical: 15, paddingHorizontal: 30, borderRadius: 30, elevation: 5 },
  disabledButton: { backgroundColor: '#ccc' },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});

export default App;
