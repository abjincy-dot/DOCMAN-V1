package com.glasskeyboard.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

/** Remembers the selected keyboard theme and key style (by id). `null` means the default. */
class ThemeStore(private val context: Context) {
    private val themeKey = stringPreferencesKey("theme_id")
    private val styleKey = stringPreferencesKey("key_style")

    val themeId: Flow<String?> = context.dataStore.data.map { it[themeKey] }
    val keyStyle: Flow<String?> = context.dataStore.data.map { it[styleKey] }

    suspend fun setTheme(id: String) {
        context.dataStore.edit { it[themeKey] = id }
    }

    suspend fun setKeyStyle(id: String) {
        context.dataStore.edit { it[styleKey] = id }
    }
}
