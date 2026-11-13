package com.glasskeyboard.ime

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SuggestionsTest {
    @Test fun emptyPrefixShowsDefaults() {
        assertEquals(listOf("I", "The", "I'm"), Suggestions.forPrefix(""))
    }

    @Test fun firstSuggestionEchoesTypedWord() {
        assertEquals("tha", Suggestions.forPrefix("tha").first())
    }

    @Test fun completesEnglishWords() {
        assertTrue("thanks" in Suggestions.forPrefix("tha"))
    }

    @Test fun keepsCapitalisation() {
        assertTrue(Suggestions.forPrefix("Hel").contains("Hello"))
    }
}
