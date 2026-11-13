package com.glasskeyboard.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

/** Remembers which keyboard theme is selected (by theme id). `null` means the default. */
class ThemeStore(private val context: Context) {
    private val key = stringPreferencesKey("theme_id")

    val themeId: Flow<String?> = context.dataStore.data.map { it[key] }

    suspend fun setTheme(id: String) {
        context.dataStore.edit { it[key] = id }
    }
}
