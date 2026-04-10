// android/app/src/main/java/com/ic221210/myapp/PeopleDetectorPackage.kt
package com.ic221210.myapp

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager   // ← ★これが必要

class PeopleDetectorPackage : ReactPackage {

  override fun createNativeModules(
    reactContext: ReactApplicationContext
  ) = listOf(
    PeopleDetectorModule(reactContext)
  )

  override fun createViewManagers(
    reactContext: ReactApplicationContext
  ): List<ViewManager<*, *>> = emptyList()
}
