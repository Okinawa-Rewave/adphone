// android/app/src/main/java/com/ic221210/myapp/BuildingDamageModule.kt
package com.ic221210.myapp

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Log
import com.facebook.react.bridge.*
import org.tensorflow.lite.Interpreter
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.exp

class BuildingDamageModule(
  private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

  companion object {
    private const val TAG = "BuildingDamage"
    private const val MODEL_ASSET_PATH = "building_damage_float32.tflite"
    private const val INPUT_SIZE = 640
    private const val NUM_CLASSES = 3
    private val CLASS_NAMES = arrayOf("Lv1", "Lv2", "Lv3")
  }

  private var interpreter: Interpreter? = null

  override fun getName(): String = "BuildingDamage"

  // =====================================================
  // JS から呼ばれるメソッド（URI入力）
  // =====================================================
  @ReactMethod
  fun classifyFromUri(uriString: String, promise: Promise) {
    Log.d(TAG, "classifyFromUri called uri=$uriString")

    try {
      val tflite = getInterpreter()

      val uri = Uri.parse(uriString)
      val bitmap = reactContext.contentResolver.openInputStream(uri)?.use {
        BitmapFactory.decodeStream(it)
      } ?: throw IllegalArgumentException("Cannot decode image: $uriString")

      val input = bitmapToInputBuffer(bitmap)

      // YOLOv11 cls TFLite 出力: [1, NUM_CLASSES]
      val output = Array(1) { FloatArray(NUM_CLASSES) }
      tflite.run(input, output)

      val rawScores = output[0]
      Log.d(TAG, "raw scores: ${rawScores.toList()}")

      // softmax で確率に変換（Ultralyticsがexport時にsoftmax済みの場合も再適用で安全）
      val scores = softmax(rawScores)
      Log.d(TAG, "softmax scores: ${scores.toList()}")

      // argmax でレベル判定
      val bestIdx = scores.indices.maxByOrNull { scores[it] } ?: 0
      val level = CLASS_NAMES[bestIdx]

      val result = Arguments.createMap()
      result.putString("level", level)

      val scoresArray = Arguments.createArray()
      scores.forEach { scoresArray.pushDouble(it.toDouble()) }
      result.putArray("scores", scoresArray)

      promise.resolve(result)

    } catch (e: Exception) {
      Log.e(TAG, "classifyFromUri failed", e)
      promise.reject("CLASSIFY_ERROR", e)
    }
  }

  // =====================================================
  // Bitmap → TFLite input (1, 640, 640, 3) float32 [0..1]
  // =====================================================
  private fun bitmapToInputBuffer(bitmap: Bitmap): ByteBuffer {
    val resized = Bitmap.createScaledBitmap(bitmap, INPUT_SIZE, INPUT_SIZE, true)
    val pixels = IntArray(INPUT_SIZE * INPUT_SIZE)
    resized.getPixels(pixels, 0, INPUT_SIZE, 0, 0, INPUT_SIZE, INPUT_SIZE)

    val buffer = ByteBuffer.allocateDirect(4 * INPUT_SIZE * INPUT_SIZE * 3)
    buffer.order(ByteOrder.nativeOrder())

    var idx = 0
    for (y in 0 until INPUT_SIZE) {
      for (x in 0 until INPUT_SIZE) {
        val v = pixels[idx++]
        buffer.putFloat(((v shr 16) and 0xFF) / 255f) // R
        buffer.putFloat(((v shr 8) and 0xFF) / 255f)  // G
        buffer.putFloat((v and 0xFF) / 255f)          // B
      }
    }
    buffer.rewind()
    return buffer
  }

  // =====================================================
  // Softmax
  // =====================================================
  private fun softmax(logits: FloatArray): FloatArray {
    val maxVal = logits.maxOrNull() ?: 0f
    val exps = logits.map { exp((it - maxVal).toDouble()).toFloat() }
    val sum = exps.sum()
    return exps.map { it / sum }.toFloatArray()
  }

  // =====================================================
  // TFLite (lazy init)
  // =====================================================
  private fun getInterpreter(): Interpreter {
    val cached = interpreter
    if (cached != null) return cached

    Log.d(TAG, "Loading TFLite model from asset: $MODEL_ASSET_PATH")

    val modelBuffer = loadModelBytes(MODEL_ASSET_PATH)
    val created = Interpreter(modelBuffer)
    interpreter = created

    Log.d(TAG, "TFLite model loaded")
    return created
  }

  private fun loadModelBytes(assetPath: String): ByteBuffer {
    val bytes = reactContext.assets.open(assetPath).use { it.readBytes() }
    val buffer = ByteBuffer.allocateDirect(bytes.size)
    buffer.order(ByteOrder.nativeOrder())
    buffer.put(bytes)
    buffer.rewind()
    return buffer
  }
}
