package com.ic221210.myapp

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import com.facebook.react.bridge.*
import org.tensorflow.lite.Interpreter
import java.io.FileInputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.channels.FileChannel
import kotlin.math.max
import kotlin.math.min

class PeopleDetectorModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "PeopleDetector"

    private val interpreter: Interpreter by lazy {
        val afd = reactContext.assets.openFd("model_float32.tflite")
        val channel = FileInputStream(afd.fileDescriptor).channel
        val model = channel.map(FileChannel.MapMode.READ_ONLY, afd.startOffset, afd.declaredLength)
        Interpreter(model)
    }

    @ReactMethod
    fun detectFromUri(uri: String, promise: Promise) {
        try {
            val bitmap = loadBitmap(uri)
            val inputShape = interpreter.getInputTensor(0).shape() // [1, H, W, 3]
            val h = inputShape[1]
            val w = inputShape[2]
            val resized = Bitmap.createScaledBitmap(bitmap, w, h, true)
            val inputBuffer = bitmapToBuffer(resized, w, h)

            val outShape = interpreter.getOutputTensor(0).shape()
            // Handle [1, fields, anchors] or [1, anchors, fields]
            // YOLO standard: [1, 5, 8400] → outShape[1] < outShape[2]
            val fieldsFirst = outShape[1] <= outShape[2]
            val rawOutput = Array(1) { Array(outShape[1]) { FloatArray(outShape[2]) } }
            interpreter.run(inputBuffer, rawOutput)

            val numAnchors = if (fieldsFirst) outShape[2] else outShape[1]
            val numFields = if (fieldsFirst) outShape[1] else outShape[2]

            val detections = mutableListOf<FloatArray>()
            val CONF_THRESHOLD = 0.3f

            for (i in 0 until numAnchors) {
                val cx: Float
                val cy: Float
                val bw: Float
                val bh: Float
                var score = 0f

                if (fieldsFirst) {
                    // rawOutput[0][field][anchor]
                    cx = rawOutput[0][0][i]; cy = rawOutput[0][1][i]
                    bw = rawOutput[0][2][i]; bh = rawOutput[0][3][i]
                    for (c in 4 until numFields) {
                        if (rawOutput[0][c][i] > score) score = rawOutput[0][c][i]
                    }
                } else {
                    // rawOutput[0][anchor][field]
                    cx = rawOutput[0][i][0]; cy = rawOutput[0][i][1]
                    bw = rawOutput[0][i][2]; bh = rawOutput[0][i][3]
                    for (c in 4 until numFields) {
                        if (rawOutput[0][i][c] > score) score = rawOutput[0][i][c]
                    }
                }

                if (score < CONF_THRESHOLD) continue
                detections.add(floatArrayOf(cx - bw / 2, cy - bh / 2, cx + bw / 2, cy + bh / 2, score))
            }

            val nmsResult = nms(detections, 0.45f)
            val result = Arguments.createArray()
            for (det in nmsResult) {
                val map = Arguments.createMap()
                map.putDouble("x1", det[0].toDouble())
                map.putDouble("y1", det[1].toDouble())
                map.putDouble("x2", det[2].toDouble())
                map.putDouble("y2", det[3].toDouble())
                map.putDouble("score", det[4].toDouble())
                result.pushMap(map)
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("DETECTION_ERROR", e.message, e)
        }
    }

    private fun nms(boxes: List<FloatArray>, iouThreshold: Float): List<FloatArray> {
        val sorted = boxes.sortedByDescending { it[4] }
        val suppressed = BooleanArray(sorted.size)
        val result = mutableListOf<FloatArray>()
        for (i in sorted.indices) {
            if (suppressed[i]) continue
            result.add(sorted[i])
            for (j in i + 1 until sorted.size) {
                if (!suppressed[j] && iou(sorted[i], sorted[j]) > iouThreshold)
                    suppressed[j] = true
            }
        }
        return result
    }

    private fun iou(a: FloatArray, b: FloatArray): Float {
        val ix1 = max(a[0], b[0]); val iy1 = max(a[1], b[1])
        val ix2 = min(a[2], b[2]); val iy2 = min(a[3], b[3])
        val inter = max(0f, ix2 - ix1) * max(0f, iy2 - iy1)
        val areaA = (a[2] - a[0]) * (a[3] - a[1])
        val areaB = (b[2] - b[0]) * (b[3] - b[1])
        return inter / (areaA + areaB - inter + 1e-6f)
    }

    private fun loadBitmap(uri: String): Bitmap =
        reactContext.contentResolver.openInputStream(Uri.parse(uri))!!.use {
            BitmapFactory.decodeStream(it)
        }

    private fun bitmapToBuffer(bitmap: Bitmap, w: Int, h: Int): ByteBuffer {
        val buffer = ByteBuffer.allocateDirect(h * w * 3 * 4)
        buffer.order(ByteOrder.nativeOrder())
        val pixels = IntArray(w * h)
        bitmap.getPixels(pixels, 0, w, 0, 0, w, h)
        for (pixel in pixels) {
            buffer.putFloat(((pixel shr 16) and 0xFF) / 255.0f)
            buffer.putFloat(((pixel shr 8) and 0xFF) / 255.0f)
            buffer.putFloat((pixel and 0xFF) / 255.0f)
        }
        buffer.rewind()
        return buffer
    }
}
