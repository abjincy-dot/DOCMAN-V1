package com.glasskeyboard.ime

import android.inputmethodservice.InputMethodService
import android.text.InputType
import android.view.inputmethod.EditorInfo
import android.widget.EditText
import androidx.activity.ComponentActivity
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.shadows.ShadowLooper

/**
 * Drives the real keyboard service against a real text field and checks that the suggestion bar
 * follows what is typed, without relying on the app reporting cursor moves.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class ServiceSuggestionsTest {

    private fun startTyping(): Pair<GlassKeyboardService, EditText> {
        val service = Robolectric.buildService(GlassKeyboardService::class.java).create().get()
        val activity = Robolectric.buildActivity(ComponentActivity::class.java).setup().get()
        val field = EditText(activity).also {
            // Like a normal message box: capitalise the start of sentences.
            it.inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_SENTENCES
            activity.setContentView(it)
        }
        val info = EditorInfo().apply {
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_SENTENCES
        }
        val connection = field.onCreateInputConnection(info)
        (service.onCreateInputMethodInterface() as InputMethodService.InputMethodImpl).startInput(connection, info)
        service.onStartInputView(info, false)
        // Wait for the word list to load in the background.
        repeat(200) {
            if (service.predictionsReady) return service to field
            Thread.sleep(10)
            ShadowLooper.idleMainLooper()
        }
        error("word list did not load")
    }

    private fun GlassKeyboardService.type(text: String) = text.forEach {
        if (it == ' ') onSpace() else onText(it.toString())
    }

    @Test fun suggestionsUpdateWhileTyping() {
        val (service, field) = startTyping()
        assertEquals(Predictor.START, service.state.suggestions)

        service.type("hel")
        assertEquals("Hel", field.text.toString()) // first letter capitalised automatically
        assertEquals("Hel", service.state.suggestions[0])
        assertEquals("Hello", service.state.suggestions[1])
    }

    @Test fun nextWordAppearsAfterSpace() {
        val (service, _) = startTyping()
        service.type("thank ")
        assertEquals("you", service.state.suggestions[1])
    }

    @Test fun tappingASuggestionReplacesTheWord() {
        val (service, field) = startTyping()
        service.type("hel")
        service.onSuggestion(service.state.suggestions[1])
        assertEquals("Hello ", field.text.toString())
        assertTrue(service.state.suggestions.isNotEmpty())
    }
}
