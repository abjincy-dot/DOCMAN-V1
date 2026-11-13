package com.glasskeyboard.data

import android.content.Context
import androidx.datastore.preferences.preferencesDataStore

/** One settings file shared by all stores, so the app and the keyboard see the same values. */
internal val Context.dataStore by preferencesDataStore(name = "keyboard_settings")
