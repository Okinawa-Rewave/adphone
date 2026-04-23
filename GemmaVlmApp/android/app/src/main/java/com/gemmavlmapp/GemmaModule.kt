package com.gemmavlmapp

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.google.mediapipe.tasks.genai.llminference.LlmInference
import com.google.mediapipe.tasks.genai.llminference.LlmInferenceSession
import com.google.mediapipe.tasks.genai.llminference.GraphOptions
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.framework.image.MPImage
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import java.io.File
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class GemmaModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    private var llmInference: LlmInference? = null
    private val scope = CoroutineScope(Dispatchers.IO)

    override fun getName(): String {
        return "GemmaModule"
    }

    @ReactMethod
    fun initializeModel(modelPath: String, promise: Promise) {
        scope.launch {
            try {
                val modelFile = File(modelPath)
                if (!modelFile.exists()) {
                    promise.reject("MODEL_NOT_FOUND", "Model file not found at: $modelPath")
                    return@launch
                }

                // まずGPUで試み、失敗したらCPUにフォールバック
                val inference = try {
                    val gpuOptions = LlmInference.LlmInferenceOptions.builder()
                        .setModelPath(modelPath)
                        .setMaxTokens(512)
                        .setMaxNumImages(1)
                        .setPreferredBackend(LlmInference.Backend.GPU)
                        .build()
                    android.util.Log.d("GemmaModule", "Trying GPU backend...")
                    LlmInference.createFromOptions(reactApplicationContext, gpuOptions)
                } catch (e: Exception) {
                    android.util.Log.w("GemmaModule", "GPU failed, falling back to CPU: ${e.message}")
                    val cpuOptions = LlmInference.LlmInferenceOptions.builder()
                        .setModelPath(modelPath)
                        .setMaxTokens(512)
                        .setMaxNumImages(1)
                        .build()
                    LlmInference.createFromOptions(reactApplicationContext, cpuOptions)
                }

                llmInference = inference
                promise.resolve(true)
            } catch (e: Exception) {
                promise.reject("INIT_ERROR", "Gemma Init Failed: ${e.message}")
            }
        }
    }

    private fun cleanResult(rawResult: String): String {
        var cleaned = rawResult.split("<end_of_turn>")[0]
        cleaned = cleaned.split("<eos>")[0]
        cleaned = cleaned.split("<start_of_turn>")[0]
        cleaned = cleaned.lines()
            .map { it.trim() }
            .filter { it.isNotEmpty() }
            .firstOrNull() ?: ""
        return cleaned.trim()
    }

    private fun resizeBitmap(bitmap: Bitmap, maxSize: Int = 512): Bitmap {
        val width = bitmap.width
        val height = bitmap.height
        if (width <= maxSize && height <= maxSize) return bitmap

        val ratio = minOf(maxSize.toFloat() / width, maxSize.toFloat() / height)
        val newWidth = (width * ratio).toInt()
        val newHeight = (height * ratio).toInt()
        android.util.Log.d("GemmaModule", "resizing: ${width}x${height} -> ${newWidth}x${newHeight}")
        return Bitmap.createScaledBitmap(bitmap, newWidth, newHeight, true)
    }

    @ReactMethod
    fun generateResponse(prompt: String, promise: Promise) {
        scope.launch {
            try {
                val inference = llmInference ?: throw Exception("Model not initialized.")
                val result = inference.generateResponse(prompt)
                promise.resolve(cleanResult(result))
            } catch (e: Exception) {
                promise.reject("INFERENCE_ERROR", "${e.message}")
            }
        }
    }

    @ReactMethod
    fun generateResponseWithImage(prompt: String, imagePath: String, promise: Promise) {
        scope.launch {
            try {
                android.util.Log.d("GemmaModule", "=== generateResponseWithImage called ===")

                val inference = llmInference ?: throw Exception("Model not initialized.")

                val file = File(imagePath)
                if (!file.exists()) {
                    promise.reject("IMAGE_NOT_FOUND", "Image not found at: $imagePath")
                    return@launch
                }

                val rawBitmap = BitmapFactory.decodeFile(imagePath)
                    ?: throw Exception("Failed to decode image.")

                val bitmap = resizeBitmap(rawBitmap, 256)
                val mpImage = BitmapImageBuilder(bitmap).build()
                android.util.Log.d("GemmaModule", "image ready: ${bitmap.width}x${bitmap.height}")

                val sessionOptions = LlmInferenceSession.LlmInferenceSessionOptions.builder()
                    .setGraphOptions(
                        GraphOptions.builder()
                            .setEnableVisionModality(true)
                            .build()
                    )
                    .build()
                val session = LlmInferenceSession.createFromOptions(inference, sessionOptions)

                session.addQueryChunk(prompt)
                session.addImage(mpImage)

                android.util.Log.d("GemmaModule", "generating response...")
                val result = session.generateResponse()
                android.util.Log.d("GemmaModule", "response: $result")

                promise.resolve(cleanResult(result))
            } catch (e: Exception) {
                android.util.Log.e("GemmaModule", "ERROR: ${e.message}", e)
                promise.reject("VLM_ERROR", "E4B VLM Error: ${e.message}")
            }
        }
    }
}
