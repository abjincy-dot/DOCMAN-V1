package com.glasskeyboard.ime

import android.graphics.Bitmap
import android.graphics.Canvas
import android.view.ViewGroup
import androidx.activity.ComponentActivity
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.padding
import androidx.compose.ui.unit.dp
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import com.glasskeyboard.data.SymbolSlots
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * Renders the keyboard to build/screenshots/ so the design can be checked without a device.
 * Run: ./gradlew :app:testDebugUnitTest --tests '*KeyboardScreenshotTest*'
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [34], qualifiers = "w411dp-h891dp-xxhdpi")
class KeyboardScreenshotTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    private val noOp = object : KeyboardActions {
        override fun onText(text: String) {}
        override fun onBackspace() {}
        override fun onShift() {}
        override fun onSpace() {}
        override fun onSpaceLongPress() {}
        override fun onEnter() {}
        override fun onSuggestion(word: String) {}
        override fun onPage(page: Page) {}
        override fun onOpenSettings() {}
        override fun onHide() {}
    }

    private fun snap(name: String, state: KeyboardState) {
        compose.setContent { KeyboardScreen(state, SymbolSlots.DEFAULT, noOp) }
        save(name)
    }

    private fun save(name: String) {
        compose.waitForIdle()
        // Draw the view directly; captureToImage() can time out under Robolectric.
        val view = compose.activity.findViewById<ViewGroup>(android.R.id.content).getChildAt(0)
        val bitmap = Bitmap.createBitmap(view.width, view.height, Bitmap.Config.ARGB_8888)
        view.draw(Canvas(bitmap))
        val dir = File("build/screenshots").apply { mkdirs() }
        File(dir, "$name.png").outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }

    @Test fun letters() = snap("keyboard_letters", KeyboardState())

    @Test fun symbols() = snap("keyboard_symbols", KeyboardState().apply { page = Page.SYMBOLS })

    @Test fun themePicker() {
        compose.setContent {
            androidx.compose.foundation.layout.Box(
                androidx.compose.ui.Modifier
                    .background(Themes.Aurora.outer)
                    .padding(20.dp)
            ) { com.glasskeyboard.ui.ThemePicker(Themes.Ocean) {} }
        }
        save("settings_theme_picker")
    }

    @Test fun allThemes() {
        var theme by mutableStateOf(Themes.all.first())
        compose.setContent { KeyboardScreen(KeyboardState(), SymbolSlots.DEFAULT, noOp, theme) }
        Themes.all.forEach {
            theme = it
            save("theme_${it.id}")
        }
    }
}
