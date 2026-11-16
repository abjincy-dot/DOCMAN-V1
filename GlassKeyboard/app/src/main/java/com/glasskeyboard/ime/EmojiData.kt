package com.glasskeyboard.ime

import android.content.Context
import android.graphics.Paint

data class EmojiGroup(val name: String, val icon: String, val emojis: List<String>)

/** Loads the full emoji list from `assets/emoji.txt`, grouped like a normal keyboard. */
object EmojiData {
    const val RECENT = "Recent"

    private val icons = mapOf(
        RECENT to "🕘",
        "Smileys & People" to "😀",
        "Animals & Nature" to "🐻",
        "Food & Drink" to "🍔",
        "Travel & Places" to "🚗",
        "Activities" to "⚽",
        "Objects" to "💡",
        "Symbols" to "🔣",
        "Flags" to "🏁",
    )

    fun iconFor(group: String) = icons[group] ?: "•"

    /** Parses the asset text. Pure function so tests can use it without a device. */
    fun parse(text: String): List<EmojiGroup> {
        val groups = mutableListOf<EmojiGroup>()
        var name: String? = null
        text.lineSequence().forEach { line ->
            when {
                line.startsWith("#") || line.isBlank() -> Unit
                line.startsWith("@") -> name = line.drop(1)
                else -> name?.let { n ->
                    groups += EmojiGroup(n, iconFor(n), line.split(' ').filter { it.isNotEmpty() })
                }
            }
        }
        return groups
    }

    /** Loads all groups, dropping emojis this phone's font cannot draw (they would show as empty boxes). */
    fun load(context: Context): List<EmojiGroup> {
        val text = context.assets.open("emoji.txt").bufferedReader().use { it.readText() }
        val paint = Paint()
        return parse(text).map { g -> g.copy(emojis = g.emojis.filter(paint::hasGlyph)) }
            .filter { it.emojis.isNotEmpty() }
    }
}
