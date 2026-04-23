import { NativeModules } from 'react-native';

const { GemmaModule } = NativeModules;

interface GemmaModuleType {
  /**
   * モデルファイルを初期化します。
   * @param modelPath 端末内のモデルファイル(.bin または .task)へのフルパス
   */
  initializeModel(modelPath: string): Promise<boolean>;

  /**
   * テキストプロンプトに対してレスポンスを生成します。
   * @param prompt 入力テキスト
   */
  generateResponse(prompt: string): Promise<string>;

  /**
   * 画像とテキストプロンプトを組み合わせてレスポンスを生成します。
   * @param prompt 入力テキスト
   * @param imagePath 画像ファイルのパス
   */
  generateResponseWithImage(prompt: string, imagePath: string): Promise<string>;
}

export default GemmaModule as GemmaModuleType;
