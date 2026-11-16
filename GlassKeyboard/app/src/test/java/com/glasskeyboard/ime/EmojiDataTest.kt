package com.glasskeyboard.ime

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class EmojiDataTest {
    private val groups = EmojiData.parse(File("src/main/assets/emoji.txt").readText())

    @Test fun hasAllCategories() {
        assertEquals(
            listOf(
                "Smileys & People", "Animals & Nature", "Food & Drink", "Travel & Places",
                "Activities", "Objects", "Symbols", "Flags",
            ),
            groups.map { it.name },
        )
    }

    @Test fun hasFullEmojiSet() {
        assertTrue(groups.sumOf { it.emojis.size } > 1800)
        assertTrue("😂" in groups.first().emojis)
        assertTrue("🇮🇳" in groups.last().emojis)
    }

    @Test fun everyCategoryHasAnIcon() {
        groups.forEach { assertTrue(it.name, EmojiData.iconFor(it.name) != "•") }
    }
}
