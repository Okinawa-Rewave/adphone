package com.ic221210.myapp

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
        // Already initialized — skip costly re-init
        if (llmInference != null) {
            promise.resolve(true)
            return
        }
        scope.launch {
            try {
                val modelFile = File(modelPath)
                if (!modelFile.exists()) {
                    promise.reject("MODEL_NOT_FOUND", "Model file not found at: $modelPath")
                    return@launch
                }

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
                val inference = llmInference ?: throw Exception("Model not initialized.")
                val cleanPath = if (imagePath.startsWith("file://")) imagePath.removePrefix("file://") else imagePath
                val file = File(cleanPath)
                if (!file.exists()) {
                    promise.reject("IMAGE_NOT_FOUND", "Image not found at: $cleanPath")
                    return@launch
                }

                val rawBitmap = BitmapFactory.decodeFile(cleanPath)
                    ?: throw Exception("Failed to decode image.")

                val bitmap = resizeBitmap(rawBitmap, 256)
                val mpImage = BitmapImageBuilder(bitmap).build()

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

                val result = session.generateResponse()
                promise.resolve(cleanResult(result))
            } catch (e: Exception) {
                promise.reject("VLM_ERROR", "E4B VLM Error: ${e.message}")
            }
        }
    }
}
