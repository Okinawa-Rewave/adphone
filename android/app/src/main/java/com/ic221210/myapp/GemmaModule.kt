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

    private fun logMemory(tag: String) {
        val rt = Runtime.getRuntime()
        val usedMB = (rt.totalMemory() - rt.freeMemory()) / 1_048_576
        val maxMB  = rt.maxMemory() / 1_048_576
        android.util.Log.d("GemmaModule", "[$tag] メモリ: ${usedMB}MB 使用 / ${maxMB}MB 上限")
    }

    @ReactMethod
    fun initializeModel(modelPath: String, promise: Promise) {
        if (llmInference != null) {
            android.util.Log.d("GemmaModule", "[init] 既に初期化済み → スキップ")
            promise.resolve(true)
            return
        }
        scope.launch {
            try {
                val modelFile = File(modelPath)
                if (!modelFile.exists()) {
                    android.util.Log.e("GemmaModule", "[init] モデルファイルが見つかりません: $modelPath")
                    promise.reject("MODEL_NOT_FOUND", "Model file not found at: $modelPath")
                    return@launch
                }
                val fileSizeMB = modelFile.length() / 1_048_576
                android.util.Log.i("GemmaModule", "[init] モデル読み込み開始 (${fileSizeMB}MB): $modelPath")
                logMemory("init 開始前")
                val t0 = System.currentTimeMillis()

                // GPU優先・CPU自動フォールバック
                val inference = try {
                    val gpuOptions = LlmInference.LlmInferenceOptions.builder()
                        .setModelPath(modelPath)
                        .setMaxTokens(256)
                        .setMaxNumImages(1)
                        .setPreferredBackend(LlmInference.Backend.GPU)
                        .build()
                    android.util.Log.d("GemmaModule", "[init] GPU バックエンドで試行中...")
                    LlmInference.createFromOptions(reactApplicationContext, gpuOptions)
                } catch (e: Exception) {
                    android.util.Log.w("GemmaModule", "[init] GPU 失敗 → CPU にフォールバック: ${e.message}")
                    val cpuOptions = LlmInference.LlmInferenceOptions.builder()
                        .setModelPath(modelPath)
                        .setMaxTokens(256)
                        .setMaxNumImages(1)
                        .build()
                    LlmInference.createFromOptions(reactApplicationContext, cpuOptions)
                }

                llmInference = inference
                val elapsed = System.currentTimeMillis() - t0
                android.util.Log.i("GemmaModule", "[init] 初期化完了 (${elapsed}ms)")
                logMemory("init 完了後")
                promise.resolve(true)
            } catch (e: Exception) {
                android.util.Log.e("GemmaModule", "[init] 初期化失敗: ${e.message}")
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

    // VLM用: モデルトークンを除去するが改行は保持する（【状況説明】など複数行の解析結果を活用するため）
    private fun cleanVlmResult(rawResult: String): String {
        var cleaned = rawResult.split("<end_of_turn>")[0]
        cleaned = cleaned.split("<eos>")[0]
        cleaned = cleaned.split("<start_of_turn>")[0]
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
            val t0 = System.currentTimeMillis()
            android.util.Log.i("GemmaModule", "[vlm] 解析開始")
            logMemory("vlm 開始前")
            try {
                val inference = llmInference ?: throw Exception("Model not initialized.")
                val cleanPath = if (imagePath.startsWith("file://")) imagePath.removePrefix("file://") else imagePath
                val file = File(cleanPath)
                if (!file.exists()) {
                    android.util.Log.e("GemmaModule", "[vlm] 画像ファイルが見つかりません: $cleanPath")
                    promise.reject("IMAGE_NOT_FOUND", "Image not found at: $cleanPath")
                    return@launch
                }

                android.util.Log.d("GemmaModule", "[vlm 1/4] 画像デコード中: $cleanPath")
                val rawBitmap = BitmapFactory.decodeFile(cleanPath)
                    ?: throw Exception("Failed to decode image.")
                android.util.Log.d("GemmaModule", "[vlm 1/4] 元サイズ: ${rawBitmap.width}x${rawBitmap.height}")

                val bitmap = resizeBitmap(rawBitmap, 256)
                if (bitmap !== rawBitmap) rawBitmap.recycle()
                android.util.Log.d("GemmaModule", "[vlm 1/4] リサイズ後: ${bitmap.width}x${bitmap.height}")
                val mpImage = BitmapImageBuilder(bitmap).build()
                // bitmap は session.addImage() が使用中のため recycle しない（GC に任せる）

                android.util.Log.d("GemmaModule", "[vlm 2/4] セッション作成中...")
                logMemory("vlm セッション作成前")
                val tSession = System.currentTimeMillis()
                val sessionOptions = LlmInferenceSession.LlmInferenceSessionOptions.builder()
                    .setGraphOptions(
                        GraphOptions.builder()
                            .setEnableVisionModality(true)
                            .build()
                    )
                    .build()
                val session = LlmInferenceSession.createFromOptions(inference, sessionOptions)
                android.util.Log.d("GemmaModule", "[vlm 2/4] セッション作成完了 (${System.currentTimeMillis() - tSession}ms)")

                android.util.Log.d("GemmaModule", "[vlm 3/4] 推論実行中...")
                val tInfer = System.currentTimeMillis()
                val result = try {
                    session.addQueryChunk(prompt)
                    session.addImage(mpImage)
                    session.generateResponse()
                } finally {
                    session.close()
                }
                android.util.Log.d("GemmaModule", "[vlm 3/4] 推論完了 (${System.currentTimeMillis() - tInfer}ms)")
                android.util.Log.i("GemmaModule", "[vlm 4/4] 生結果: \"${result.take(200)}\"")

                val cleaned = cleanVlmResult(result)
                android.util.Log.i("GemmaModule", "[vlm 4/4] クリーン結果: \"$cleaned\"")
                android.util.Log.i("GemmaModule", "[vlm] 解析完了 合計${System.currentTimeMillis() - t0}ms")
                logMemory("vlm 完了後")
                promise.resolve(cleaned)
            } catch (e: Throwable) {
                android.util.Log.e("GemmaModule", "[vlm] 解析失敗 (${System.currentTimeMillis() - t0}ms): ${e::class.simpleName} - ${e.message}")
                promise.reject("VLM_ERROR", "E4B VLM Error: ${e.message}")
            }
        }
    }
}
