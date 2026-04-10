package com.ic221210.myapp

import android.os.Build
import android.os.Bundle
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Log
import java.nio.ByteBuffer
import java.nio.ByteOrder

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

import expo.modules.ReactActivityDelegateWrapper
import expo.modules.splashscreen.SplashScreenManager

import org.tensorflow.lite.Interpreter

class MainActivity : ReactActivity() {

  override fun onCreate(savedInstanceState: Bundle?) {
    // Expo splash screen (★1回だけ)
    SplashScreenManager.registerOnActivity(this)

    // Expo 推奨：savedInstanceState は null
    super.onCreate(null)

    // ★ TFLite テスト実行（ログ確認用）
    runYoloTest()
  }

  /**
   * Bitmap → TFLite 用 ByteBuffer
   * YOLO (1, 640, 640, 3) float32 入力
   */
  private fun bitmapToByteBuffer(bitmap: Bitmap): ByteBuffer {
    val inputSize = 640
    val buffer =
      ByteBuffer.allocateDirect(1 * inputSize * inputSize * 3 * 4)
    buffer.order(ByteOrder.nativeOrder())

    val resized =
      Bitmap.createScaledBitmap(bitmap, inputSize, inputSize, true)

    val intValues = IntArray(inputSize * inputSize)
    resized.getPixels(
      intValues,
      0,
      inputSize,
      0,
      0,
      inputSize,
      inputSize
    )

    var pixelIndex = 0
    for (y in 0 until inputSize) {
      for (x in 0 until inputSize) {
        val pixel = intValues[pixelIndex++]

        buffer.putFloat(((pixel shr 16) and 0xFF) / 255.0f) // R
        buffer.putFloat(((pixel shr 8) and 0xFF) / 255.0f)  // G
        buffer.putFloat((pixel and 0xFF) / 255.0f)          // B
      }
    }

    buffer.rewind()
    return buffer
  }

  /**
   * TFLite YOLO テスト実行
   * assets/model_float32.tflite
   * assets/test.jpg
   */
  private fun runYoloTest() {
    try {
      val assetManager = assets

      // ① モデル読み込み
      val modelBuffer = assetManager.open("model_float32.tflite").use { input ->
        val bytes = ByteArray(input.available())
        input.read(bytes)
        ByteBuffer.allocateDirect(bytes.size).apply {
          order(ByteOrder.nativeOrder())
          put(bytes)
          rewind()
        }
      }

      val interpreter = Interpreter(modelBuffer)

      // ② テスト画像読み込み
      val bitmap = assetManager.open("test.jpg").use {
        BitmapFactory.decodeStream(it)
      }

      // ③ 前処理
      val input = bitmapToByteBuffer(bitmap)

      // ④ 出力バッファ [1, 5, 8400]
      val output = Array(1) { Array(5) { FloatArray(8400) } }

      // ⑤ 推論
      interpreter.run(input, output)

      // ⑥ 結果確認
      var count = 0
      for (i in 0 until 8400) {
        if (output[0][4][i] > 0.5f) count++
      }

      Log.d("YOLO_TEST", "Detected objects = $count")

    } catch (e: Exception) {
      Log.e("YOLO_TEST", "YOLO test failed", e)
    }
  }

  override fun getMainComponentName(): String = "main"

  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return ReactActivityDelegateWrapper(
      this,
      BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
      object : DefaultReactActivityDelegate(
        this,
        mainComponentName,
        fabricEnabled
      ) {}
    )
  }

  override fun invokeDefaultOnBackPressed() {
    if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
      if (!moveTaskToBack(false)) {
        super.invokeDefaultOnBackPressed()
      }
      return
    }
    super.invokeDefaultOnBackPressed()
  }
}
