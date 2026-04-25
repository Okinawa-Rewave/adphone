import { NativeModules } from 'react-native';

const { GemmaModule } = NativeModules;

interface GemmaModuleType {
  initializeModel(modelPath: string): Promise<boolean>;
  generateResponse(prompt: string): Promise<string>;
  generateResponseWithImage(prompt: string, imagePath: string): Promise<string>;
}

export default GemmaModule as GemmaModuleType;
