package com.glasskeyboard.ime

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class PredictorTest {
    private val words = File("src/main/assets/words_en.txt").readLines()
        .filterNot { it.startsWith("#") }.flatMap { it.split(' ') }.filter { it.isNotBlank() }

    private fun fresh() = Predictor(words)

    @Test fun startOfMessageShowsStarters() {
        assertEquals(Predictor.START, fresh().suggest(null, "", capitalize = true))
    }

    @Test fun typedWordStaysFirstAndBestGuessIsInTheMiddle() {
        val s = fresh().suggest(null, "hel", capitalize = false)
        assertEquals("hel", s[0])
        assertEquals("hello", s[1])
    }

    @Test fun missingApostropheIsFixed() {
        assertEquals("don't", fresh().suggest(null, "dont", capitalize = false)[1])
    }

    @Test fun predictsNextWordAfterSpace() {
        assertEquals("you", fresh().suggest("thank", "", capitalize = false)[1])
        assertEquals("morning", fresh().suggest("good", "", capitalize = false)[1])
    }

    @Test fun capitalisesAtStartOfSentence() {
        assertTrue(fresh().suggest(null, "Tha", capitalize = true).contains("Thanks"))
    }

    @Test fun learnsYourWordsAndPairs() {
        val p = fresh()
        repeat(3) { p.learn("see", "ya") }
        assertEquals("ya", p.suggest("see", "", capitalize = false)[1])
        repeat(3) { p.learn(null, "Kochi") }
        assertEquals("Kochi", p.suggest(null, "Ko", capitalize = false)[1])
    }

    @Test fun learnedDataSurvivesSaveAndLoad() {
        val p = fresh()
        repeat(3) { p.learn("see", "ya") }
        val restored = fresh().apply { restore(p.serialize()) }
        assertEquals("ya", restored.suggest("see", "", capitalize = false)[1])
    }

    @Test fun clearForgetsLearnedWords() {
        val p = fresh()
        repeat(3) { p.learn("see", "ya") }
        p.clearLearned()
        assertEquals("you", p.suggest("see", "", capitalize = false)[1])
    }
}
