package com.glasskeyboard.ime

import android.content.Intent
import android.inputmethodservice.InputMethodService
import android.os.Build
import android.os.SystemClock
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.text.InputType
import android.view.KeyEvent
import android.view.View
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.platform.ComposeView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.LifecycleRegistry
import androidx.lifecycle.ViewModelStore
import androidx.lifecycle.ViewModelStoreOwner
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.setViewTreeLifecycleOwner
import androidx.lifecycle.setViewTreeViewModelStoreOwner
import androidx.savedstate.SavedStateRegistry
import androidx.savedstate.SavedStateRegistryController
import androidx.savedstate.SavedStateRegistryOwner
import androidx.savedstate.setViewTreeSavedStateRegistryOwner
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.withContext
import java.io.File
import com.glasskeyboard.data.RecentEmojiStore
import com.glasskeyboard.data.SymbolKeysStore
import com.glasskeyboard.data.SymbolSlots
import com.glasskeyboard.data.ThemeStore
import com.glasskeyboard.data.TypingStore
import com.glasskeyboard.ui.SettingsActivity

/**
 * The keyboard itself. An InputMethodService is not an Activity, so to host Jetpack Compose
 * we provide the lifecycle / view-model / saved-state owners Compose expects.
 */
class GlassKeyboardService : InputMethodService(),
    LifecycleOwner, ViewModelStoreOwner, SavedStateRegistryOwner, KeyboardActions {

    private val lifecycleRegistry = LifecycleRegistry(this)
    private val store = ViewModelStore()
    private val savedStateController = SavedStateRegistryController.create(this)

    override val lifecycle: Lifecycle get() = lifecycleRegistry
    override val viewModelStore: ViewModelStore get() = store
    override val savedStateRegistry: SavedStateRegistry get() = savedStateController.savedStateRegistry

    private val state = KeyboardState()
    private lateinit var symbolKeys: SymbolKeysStore
    private lateinit var themeStore: ThemeStore
    private lateinit var recentEmoji: RecentEmojiStore
    private lateinit var typing: TypingStore
    private var predictor: Predictor? = null
    private var vibrationOn = true
    private var learningOn = true
    private val learnedFile by lazy { File(noBackupFilesDir, "learned_words.tsv") }
    private val vibrator: Vibrator? by lazy {
        if (Build.VERSION.SDK_INT >= 31) getSystemService(VibratorManager::class.java)?.defaultVibrator
        else @Suppress("DEPRECATION") getSystemService(Vibrator::class.java)
    }
    private var lastShiftTap = 0L

    override fun onCreate() {
        super.onCreate()
        savedStateController.performRestore(null)
        lifecycleRegistry.handleLifecycleEvent(Lifecycle.Event.ON_RESUME)
        symbolKeys = SymbolKeysStore(this)
        themeStore = ThemeStore(this)
        recentEmoji = RecentEmojiStore(this)
        typing = TypingStore(this)
        lifecycleScope.launch {
            predictor = withContext(Dispatchers.IO) {
                val words = assets.open("words_en.txt").bufferedReader().useLines { lines ->
                    lines.filterNot { it.startsWith("#") }.flatMap { it.split(' ') }.filter { it.isNotBlank() }.toList()
                }
                Predictor(words).also { p -> if (learnedFile.exists()) p.restore(learnedFile.readText()) }
            }
            refresh()
        }
        lifecycleScope.launch { typing.vibration.collect { vibrationOn = it } }
        lifecycleScope.launch { typing.learning.collect { learningOn = it } }
        lifecycleScope.launch {
            // Skip the current value; react only when the user taps "Clear learned words".
            typing.learnedClearedAt.drop(1).collect {
                predictor?.clearLearned()
                saveLearned()
            }
        }
        lifecycleScope.launch {
            state.emojiGroups = withContext(Dispatchers.Default) { EmojiData.load(this@GlassKeyboardService) }
        }
        lifecycleScope.launch {
            recentEmoji.recent.collect { state.recentEmoji = it }
        }
    }

    override fun onCreateInputView(): View {
        window.window?.decorView?.let { attachOwners(it) }
        return ComposeView(this).apply {
            attachOwners(this)
            setContent {
                val slots by symbolKeys.slots.collectAsState(initial = SymbolSlots.DEFAULT)
                val themeId by themeStore.themeId.collectAsState(initial = null)
                val styleId by themeStore.keyStyle.collectAsState(initial = null)
                KeyboardScreen(
                    state = state,
                    slots = slots,
                    actions = this@GlassKeyboardService,
                    theme = Themes.byId(themeId),
                    style = KeyStyle.byId(styleId),
                )
            }
        }
    }

    private fun attachOwners(view: View) {
        view.setViewTreeLifecycleOwner(this)
        view.setViewTreeViewModelStoreOwner(this)
        view.setViewTreeSavedStateRegistryOwner(this)
    }

    override fun onStartInputView(info: EditorInfo, restarting: Boolean) {
        super.onStartInputView(info, restarting)
        val cls = info.inputType and InputType.TYPE_MASK_CLASS
        val variation = info.inputType and InputType.TYPE_MASK_VARIATION
        val isPassword = (cls == InputType.TYPE_CLASS_TEXT && variation in PASSWORD_VARIATIONS) ||
            (cls == InputType.TYPE_CLASS_NUMBER && variation == InputType.TYPE_NUMBER_VARIATION_PASSWORD)
        val noSuggestions = info.inputType and InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS != 0

        // Never learn from or suggest in password fields.
        state.suggestionsEnabled = !isPassword && !noSuggestions && cls == InputType.TYPE_CLASS_TEXT
        state.page = when (cls) {
            InputType.TYPE_CLASS_NUMBER, InputType.TYPE_CLASS_PHONE, InputType.TYPE_CLASS_DATETIME -> Page.SYMBOLS
            else -> Page.LETTERS
        }
        state.shift = ShiftState.OFF
        refresh()
    }

    override fun onUpdateSelection(
        oldSelStart: Int, oldSelEnd: Int, newSelStart: Int, newSelEnd: Int,
        candidatesStart: Int, candidatesEnd: Int,
    ) {
        super.onUpdateSelection(oldSelStart, oldSelEnd, newSelStart, newSelEnd, candidatesStart, candidatesEnd)
        refresh()
    }

    /** Recompute automatic capitalisation and predictions from the text around the cursor. */
    private fun refresh() {
        val info = currentInputEditorInfo
        val ic = currentInputConnection
        if (info != null && ic != null && state.shift != ShiftState.LOCKED &&
            info.inputType and InputType.TYPE_MASK_CLASS == InputType.TYPE_CLASS_TEXT
        ) {
            state.shift = if (ic.getCursorCapsMode(info.inputType) != 0) ShiftState.ON else ShiftState.OFF
        }
        if (!state.suggestionsEnabled) {
            state.suggestions = emptyList()
            return
        }
        val (previous, current) = wordsBeforeCursor()
        val capitalize = if (current.isNotEmpty()) current[0].isUpperCase() else state.shift == ShiftState.ON
        state.suggestions = predictor?.suggest(previous, current, capitalize) ?: Predictor.START
    }

    /** The word before the one being typed (null at the start of a sentence) and the word being typed. */
    private fun wordsBeforeCursor(): Pair<String?, String> {
        val before = currentInputConnection?.getTextBeforeCursor(80, 0)?.toString().orEmpty()
        val current = before.takeLastWhile(::isWordChar)
        val rest = before.dropLast(current.length).trimEnd()
        val previous = if (rest.isEmpty() || rest.last() in ".!?\n") null
        else rest.takeLastWhile(::isWordChar).ifEmpty { null }
        return previous to current
    }

    private fun isWordChar(c: Char) = c.isLetter() || c == '\''

    /** Remember the word just finished, if learning is on and this isn't a private field. */
    private fun learnCurrentWord() {
        if (!learningOn || !state.suggestionsEnabled) return
        val (previous, current) = wordsBeforeCursor()
        if (current.isNotEmpty()) predictor?.learn(previous, current)
    }

    private fun saveLearned() {
        val p = predictor ?: return
        if (!p.dirty) return
        val text = p.serialize()
        lifecycleScope.launch(Dispatchers.IO) { learnedFile.writeText(text) }
    }

    override fun onFinishInputView(finishingInput: Boolean) {
        super.onFinishInputView(finishingInput)
        saveLearned()
    }

    // ---- KeyboardActions ----

    override fun onKeyDown() {
        if (!vibrationOn) return
        val v = vibrator?.takeIf { it.hasVibrator() } ?: return
        // A short, soft tick rather than a buzz.
        val effect = if (Build.VERSION.SDK_INT >= 29) {
            VibrationEffect.createPredefined(VibrationEffect.EFFECT_TICK)
        } else {
            VibrationEffect.createOneShot(8, if (v.hasAmplitudeControl()) 50 else VibrationEffect.DEFAULT_AMPLITUDE)
        }
        v.vibrate(effect)
    }

    override fun onText(text: String) {
        val ic = currentInputConnection ?: return
        if (text.length == 1 && !text[0].isLetterOrDigit() && text[0] != '\'') learnCurrentWord()
        val out = if (state.shift != ShiftState.OFF && text.length == 1 && text[0].isLetter()) text.uppercase() else text
        ic.commitText(out, 1)
        if (state.shift == ShiftState.ON) state.shift = ShiftState.OFF
    }

    override fun onEmoji(emoji: String) {
        currentInputConnection?.commitText(emoji, 1)
        lifecycleScope.launch { recentEmoji.add(emoji) }
    }

    override fun onBackspace() {
        val ic = currentInputConnection ?: return
        if (!ic.getSelectedText(0).isNullOrEmpty()) ic.commitText("", 1)
        else sendDownUpKeyEvents(KeyEvent.KEYCODE_DEL)
    }

    override fun onShift() {
        val now = SystemClock.uptimeMillis()
        state.shift = when (state.shift) {
            ShiftState.OFF -> ShiftState.ON
            ShiftState.ON -> if (now - lastShiftTap < DOUBLE_TAP_MS) ShiftState.LOCKED else ShiftState.OFF
            ShiftState.LOCKED -> ShiftState.OFF
        }
        lastShiftTap = now
    }

    override fun onSpace() {
        val ic = currentInputConnection ?: return
        learnCurrentWord()
        val before = ic.getTextBeforeCursor(2, 0)?.toString().orEmpty()
        // Double-space after a word types ". " like most mobile keyboards.
        if (state.suggestionsEnabled && before.length == 2 && before[1] == ' ' && before[0].isLetterOrDigit()) {
            ic.beginBatchEdit()
            ic.deleteSurroundingText(1, 0)
            ic.commitText(". ", 1)
            ic.endBatchEdit()
        } else {
            ic.commitText(" ", 1)
        }
    }

    override fun onSpaceLongPress() {
        getSystemService(InputMethodManager::class.java)?.showInputMethodPicker()
    }

    override fun onEnter() {
        val ic = currentInputConnection ?: return
        val info = currentInputEditorInfo
        val action = (info?.imeOptions ?: 0) and EditorInfo.IME_MASK_ACTION
        val noEnterAction = (info?.imeOptions ?: 0) and EditorInfo.IME_FLAG_NO_ENTER_ACTION != 0
        if (!noEnterAction && action != EditorInfo.IME_ACTION_NONE && action != EditorInfo.IME_ACTION_UNSPECIFIED) {
            ic.performEditorAction(action)
        } else {
            sendDownUpKeyEvents(KeyEvent.KEYCODE_ENTER)
        }
    }

    override fun onSuggestion(word: String) {
        val ic = currentInputConnection ?: return
        val (previous, current) = wordsBeforeCursor()
        if (learningOn && state.suggestionsEnabled) predictor?.learn(previous, word)
        ic.beginBatchEdit()
        ic.deleteSurroundingText(current.length, 0)
        ic.commitText("$word ", 1)
        ic.endBatchEdit()
    }

    override fun onPage(page: Page) {
        state.page = page
    }

    override fun onOpenSettings() {
        startActivity(Intent(this, SettingsActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    override fun onHide() {
        requestHideSelf(0)
    }

    override fun onDestroy() {
        predictor?.takeIf { it.dirty }?.let { learnedFile.writeText(it.serialize()) }
        lifecycleRegistry.handleLifecycleEvent(Lifecycle.Event.ON_DESTROY)
        store.clear()
        super.onDestroy()
    }

    private companion object {
        const val DOUBLE_TAP_MS = 350L
        val PASSWORD_VARIATIONS = setOf(
            InputType.TYPE_TEXT_VARIATION_PASSWORD,
            InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD,
            InputType.TYPE_TEXT_VARIATION_WEB_PASSWORD,
        )
    }
}
