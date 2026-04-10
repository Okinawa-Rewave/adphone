// my-app/android/app/src/main/java/com/ic221210/myapp/PeopleDetectorModule.kt
package com.ic221210.myapp

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Log
import com.facebook.react.bridge.*
import org.tensorflow.lite.Interpreter
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.max
import kotlin.math.min

class PeopleDetectorModule(
  private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

  companion object {
    private const val TAG = "PeopleDetector"
    private const val TEST_TAG = "PEOPLE_DETECTOR_TEST"

    // my-app/assets/model_float32.tflite を同梱している前提
    private const val MODEL_ASSET_PATH = "model_float32.tflite"

    private const val INPUT_SIZE = 640
    private const val NUM_BOXES = 8400

    // まずは「0件」を潰しやすい値（後で上げる）
    private const val CONF_THRESHOLD = 0.15f
    private const val NMS_THRESHOLD = 0.50f
  }

  private var interpreter: Interpreter? = null

  override fun getName(): String = "PeopleDetector"

  // =====================================================
  // JS から呼ばれる本命メソッド（URI入力）
  // =====================================================
  @ReactMethod
  fun detectFromUri(uriString: String, promise: Promise) {
    Log.e(TEST_TAG, "detectFromUri called uri=$uriString")

    try {
      val tflite = getInterpreter()

      val uri = Uri.parse(uriString)
      val bitmap = reactContext.contentResolver.openInputStream(uri)?.use {
        BitmapFactory.decodeStream(it)
      } ?: throw IllegalArgumentException("Cannot decode image: $uriString")

      val input = bitmapToInputBuffer(bitmap)

      val output = Array(1) { Array(5) { FloatArray(NUM_BOXES) } }
      tflite.run(input, output)

      // デバッグ：最大conf
      var maxConf = 0f
      for (i in 0 until NUM_BOXES) {
        maxConf = max(maxConf, output[0][4][i])
      }
      Log.d(TAG, "maxConf=$maxConf")

      val boxes = mutableListOf<Box>()
      for (i in 0 until NUM_BOXES) {
        val score = output[0][4][i]
        if (score < CONF_THRESHOLD) continue

        val cx = output[0][0][i]
        val cy = output[0][1][i]
        val w  = output[0][2][i]
        val h  = output[0][3][i]

        // bbox が 0..1 で来るモデルと、0..640 で来るモデル両対応
        val isNorm =
          (cx in 0f..1.2f && cy in 0f..1.2f && w in 0f..1.2f && h in 0f..1.2f)
        val scale = if (isNorm) INPUT_SIZE.toFloat() else 1f

        val cxp = cx * scale
        val cyp = cy * scale
        val wp  = w  * scale
        val hp  = h  * scale

        val x1 = (cxp - wp / 2f).coerceIn(0f, INPUT_SIZE.toFloat())
        val y1 = (cyp - hp / 2f).coerceIn(0f, INPUT_SIZE.toFloat())
        val x2 = (cxp + wp / 2f).coerceIn(0f, INPUT_SIZE.toFloat())
        val y2 = (cyp + hp / 2f).coerceIn(0f, INPUT_SIZE.toFloat())

        // つぶれた box を除外
        if (x2 - x1 < 2f || y2 - y1 < 2f) continue

        boxes.add(Box(x1, y1, x2, y2, score))
      }

      val finalBoxes = nms(boxes, NMS_THRESHOLD)

      val results = Arguments.createArray()
      for (b in finalBoxes) {
        val map = Arguments.createMap()
        map.putDouble("x1", b.x1.toDouble())
        map.putDouble("y1", b.y1.toDouble())
        map.putDouble("x2", b.x2.toDouble())
        map.putDouble("y2", b.y2.toDouble())
        map.putDouble("score", b.score.toDouble())
        results.pushMap(map)
      }

      promise.resolve(results)

    } catch (e: Exception) {
      Log.e(TAG, "detectFromUri failed", e)
      promise.reject("DETECT_ERROR", e)
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
  // TFLite (lazy init, Expoでも確実に読むため openFd は使わない)
  // =====================================================
  private fun getInterpreter(): Interpreter {
    val cached = interpreter
    if (cached != null) return cached

    Log.e(TEST_TAG, "Loading TFLite model from asset: $MODEL_ASSET_PATH")

    val modelBuffer = loadModelBytes(MODEL_ASSET_PATH)
    val created = Interpreter(modelBuffer)
    interpreter = created

    Log.e(TEST_TAG, "TFLite model loaded")
    return created
  }

  private fun loadModelBytes(assetPath: String): ByteBuffer {
    // openFd() は「圧縮されていないasset」前提で、Expoでは失敗しがち
    val bytes = reactContext.assets.open(assetPath).use { it.readBytes() }
    val buffer = ByteBuffer.allocateDirect(bytes.size)
    buffer.order(ByteOrder.nativeOrder())
    buffer.put(bytes)
    buffer.rewind()
    return buffer
  }

  // =====================================================
  // NMS
  // =====================================================
  data class Box(
    val x1: Float,
    val y1: Float,
    val x2: Float,
    val y2: Float,
    val score: Float
  )

  private fun iou(a: Box, b: Box): Float {
    val xx1 = max(a.x1, b.x1)
    val yy1 = max(a.y1, b.y1)
    val xx2 = min(a.x2, b.x2)
    val yy2 = min(a.y2, b.y2)

    val w = max(0f, xx2 - xx1)
    val h = max(0f, yy2 - yy1)
    val inter = w * h

    val areaA = max(0f, a.x2 - a.x1) * max(0f, a.y2 - a.y1)
    val areaB = max(0f, b.x2 - b.x1) * max(0f, b.y2 - b.y1)
    val union = areaA + areaB - inter

    return if (union > 0f) inter / union else 0f
  }

  private fun nms(boxes: List<Box>, threshold: Float): List<Box> {
    val sorted = boxes.sortedByDescending { it.score }.toMutableList()
    val result = mutableListOf<Box>()

    while (sorted.isNotEmpty()) {
      val first = sorted.removeAt(0)
      result.add(first)

      val it = sorted.iterator()
      while (it.hasNext()) {
        val b = it.next()
        if (iou(first, b) > threshold) it.remove()
      }
    }
    return result
  }
}
