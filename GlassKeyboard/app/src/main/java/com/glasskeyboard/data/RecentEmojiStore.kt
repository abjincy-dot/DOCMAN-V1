package com.glasskeyboard.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

/** The most recently used emojis, newest first. Stored only on the phone. */
class RecentEmojiStore(private val context: Context) {
    private val key = stringPreferencesKey("recent_emoji")

    val recent: Flow<List<String>> = context.dataStore.data.map { prefs ->
        prefs[key]?.split(' ')?.filter { it.isNotEmpty() }.orEmpty()
    }

    suspend fun add(emoji: String) {
        context.dataStore.edit { prefs ->
            val current = prefs[key]?.split(' ')?.filter { it.isNotEmpty() }.orEmpty()
            prefs[key] = (listOf(emoji) + (current - emoji)).take(MAX).joinToString(" ")
        }
    }

    private companion object {
        const val MAX = 32
    }
}
