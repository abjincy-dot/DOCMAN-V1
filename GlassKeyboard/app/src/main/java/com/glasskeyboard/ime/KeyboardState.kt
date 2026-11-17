package com.glasskeyboard.ime

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue

enum class ShiftState { OFF, ON, LOCKED }

/** UI state the Compose keyboard observes. Mutated only by [GlassKeyboardService]. */
class KeyboardState {
    var page by mutableStateOf(Page.LETTERS)
    var shift by mutableStateOf(ShiftState.OFF)
    var suggestions by mutableStateOf(Predictor.START)
    var suggestionsEnabled by mutableStateOf(true)
    var languageLabel by mutableStateOf("space")
    var emojiGroups by mutableStateOf<List<EmojiGroup>>(emptyList())
    var recentEmoji by mutableStateOf<List<String>>(emptyList())
}

/** Everything a key press can ask the service to do. */
interface KeyboardActions {
    fun onText(text: String)
    /** A key was pressed: give vibration feedback if it is turned on. */
    fun onKeyDown()
    fun onEmoji(emoji: String)
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
