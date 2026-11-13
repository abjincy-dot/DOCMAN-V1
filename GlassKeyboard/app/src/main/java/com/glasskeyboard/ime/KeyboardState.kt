package com.glasskeyboard.ime

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue

enum class ShiftState { OFF, ON, LOCKED }

/** UI state the Compose keyboard observes. Mutated only by [GlassKeyboardService]. */
class KeyboardState {
    var page by mutableStateOf(Page.LETTERS)
    var shift by mutableStateOf(ShiftState.OFF)
    var suggestions by mutableStateOf(Suggestions.defaults)
    var suggestionsEnabled by mutableStateOf(true)
    var languageLabel by mutableStateOf("space")
}

/** Everything a key press can ask the service to do. */
interface KeyboardActions {
    fun onText(text: String)
    fun onBackspace()
    fun onShift()
    fun onSpace()
    fun onSpaceLongPress()
    fun onEnter()
    fun onSuggestion(word: String)
    fun onPage(page: Page)
    fun onOpenSettings()
    fun onHide()
}
