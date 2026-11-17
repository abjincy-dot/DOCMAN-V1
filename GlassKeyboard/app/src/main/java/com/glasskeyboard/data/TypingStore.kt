package com.glasskeyboard.data

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

/** Typing preferences: vibration and word learning. */
class TypingStore(private val context: Context) {
    private val vibrationKey = booleanPreferencesKey("vibration")
    private val learningKey = booleanPreferencesKey("learn_words")
    private val clearedKey = longPreferencesKey("learned_cleared_at")

    val vibration: Flow<Boolean> = context.dataStore.data.map { it[vibrationKey] ?: true }
    val learning: Flow<Boolean> = context.dataStore.data.map { it[learningKey] ?: true }

    /** Changes whenever the user asks to forget learned words; the keyboard clears its copy then. */
    val learnedClearedAt: Flow<Long> = context.dataStore.data.map { it[clearedKey] ?: 0L }

    suspend fun setVibration(on: Boolean) {
        context.dataStore.edit { it[vibrationKey] = on }
    }

    suspend fun setLearning(on: Boolean) {
        context.dataStore.edit { it[learningKey] = on }
    }

    suspend fun clearLearned() {
        context.dataStore.edit { it[clearedKey] = System.currentTimeMillis() }
    }
}
