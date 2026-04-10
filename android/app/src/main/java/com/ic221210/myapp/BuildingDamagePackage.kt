// android/app/src/main/java/com/ic221210/myapp/BuildingDamagePackage.kt
package com.ic221210.myapp

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class BuildingDamagePackage : ReactPackage {

  override fun createNativeModules(
    reactContext: ReactApplicationContext
  ) = listOf(
    BuildingDamageModule(reactContext)
  )

  override fun createViewManagers(
    reactContext: ReactApplicationContext
  ): List<ViewManager<*, *>> = emptyList()
}
