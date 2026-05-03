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

class BuildingDamageModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "BuildingDamage"

    private val interpreter: Interpreter by lazy {
        val afd = reactContext.assets.openFd("best_float32.tflite")
        val channel = FileInputStream(afd.fileDescriptor).channel
        val model = channel.map(FileChannel.MapMode.READ_ONLY, afd.startOffset, afd.declaredLength)
        Interpreter(model)
    }

    @ReactMethod
    fun classifyFromUri(uri: String, promise: Promise) {
        try {
            val bitmap = loadBitmap(uri)
            val inputShape = interpreter.getInputTensor(0).shape() // [1, H, W, 3]
            val h = inputShape[1]
            val w = inputShape[2]
            val resized = Bitmap.createScaledBitmap(bitmap, w, h, true)
            val inputBuffer = bitmapToBuffer(resized, w, h)

            val outShape = interpreter.getOutputTensor(0).shape() // [1, 3]
            val outputBuffer = Array(1) { FloatArray(outShape[1]) }
            interpreter.run(inputBuffer, outputBuffer)

            val scores = outputBuffer[0]
            val levels = arrayOf("Lv1", "Lv2", "Lv3")
            var maxIdx = 0
            for (i in scores.indices) {
                if (scores[i] > scores[maxIdx]) maxIdx = i
            }

            val scoresArray = Arguments.createArray()
            for (s in scores) scoresArray.pushDouble(s.toDouble())

            val result = Arguments.createMap()
            result.putString("level", levels[maxIdx])
            result.putArray("scores", scoresArray)
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("CLASSIFICATION_ERROR", e.message, e)
        }
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
