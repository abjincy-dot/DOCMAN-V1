package com.glasskeyboard.data

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.floatPreferencesKey
import androidx.datastore.preferences.core.longPreferencesKey
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

/** Typing preferences: vibration strength, keyboard height and word learning. */
class TypingStore(private val context: Context) {
    private val oldVibrationOnKey = booleanPreferencesKey("vibration")
    private val strengthKey = floatPreferencesKey("vibration_strength")
    private val learningKey = booleanPreferencesKey("learn_words")
    private val heightKey = floatPreferencesKey("keyboard_height")
    private val clearedKey = longPreferencesKey("learned_cleared_at")

    /** 0 = off, 1 = strongest. Someone who had switched vibration off before keeps it off. */
    val vibrationStrength: Flow<Float> = context.dataStore.data.map { prefs ->
        prefs[strengthKey] ?: if (prefs[oldVibrationOnKey] == false) 0f else DEFAULT_STRENGTH
    }

    /** Keyboard height as a fraction of normal (1.0). */
    val keyboardHeight: Flow<Float> = context.dataStore.data.map { it[heightKey] ?: 1f }
    val learning: Flow<Boolean> = context.dataStore.data.map { it[learningKey] ?: true }

    /** Changes whenever the user asks to forget learned words; the keyboard clears its copy then. */
    val learnedClearedAt: Flow<Long> = context.dataStore.data.map { it[clearedKey] ?: 0L }

    suspend fun setVibrationStrength(value: Float) {
        context.dataStore.edit { it[strengthKey] = value }
    }

    suspend fun setKeyboardHeight(scale: Float) {
        context.dataStore.edit { it[heightKey] = scale }
    }

    suspend fun setLearning(on: Boolean) {
        context.dataStore.edit { it[learningKey] = on }
    }

    suspend fun clearLearned() {
        context.dataStore.edit { it[clearedKey] = System.currentTimeMillis() }
    }

    private companion object {
        const val DEFAULT_STRENGTH = 0.25f
    }
}
