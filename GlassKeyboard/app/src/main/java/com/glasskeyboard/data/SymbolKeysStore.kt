package com.glasskeyboard.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

/**
 * The four optional "symbol key" slots in the bottom row:
 * [left outer, left inner] space [right inner, right outer]. `null` = empty slot.
 */
data class SymbolSlots(val slots: List<String?>) {
    companion object {
        val DEFAULT = SymbolSlots(listOf(null, null, null, null))
        val CHOICES = listOf("@", "$", "€", "£", "#", "&", "?", "!", "-", "_", "/", ":", ";", "'")
    }
}

class SymbolKeysStore(private val context: Context) {
    private val key = stringPreferencesKey("symbol_slots")

    val slots: Flow<SymbolSlots> = context.dataStore.data.map { prefs ->
        prefs[key]?.let(::decode) ?: SymbolSlots.DEFAULT
    }

    suspend fun setSlot(index: Int, value: String?) {
        context.dataStore.edit { prefs ->
            val current = prefs[key]?.let(::decode) ?: SymbolSlots.DEFAULT
            val updated = current.slots.toMutableList().also { it[index] = value }
            prefs[key] = encode(SymbolSlots(updated))
        }
    }

    // Unit separator never appears in a symbol, so it is a safe delimiter.
    private fun encode(s: SymbolSlots) = s.slots.joinToString("\u001F") { it ?: "" }
    private fun decode(raw: String) =
        SymbolSlots(raw.split("\u001F").map { it.ifEmpty { null } }.let { list ->
            List(4) { i -> list.getOrNull(i) }
        })
}
