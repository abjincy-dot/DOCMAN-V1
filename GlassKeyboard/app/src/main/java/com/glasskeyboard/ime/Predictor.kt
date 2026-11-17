package com.glasskeyboard.ime

/**
 * Word predictions for the suggestion bar.
 *
 * - While typing a word: completes it from the built-in word list, preferring words you use often
 *   and words that usually follow the previous word.
 * - After a space: predicts the next word from what you usually type next, then a built-in table.
 * - [learn] records words and word pairs you type. That data stays on the phone ([serialize]).
 *
 * Results are in display order: the best guess is in the middle slot.
 */
class Predictor(words: List<String>) {
    /** lower-case word -> rank (0 = most common) */
    private val rank = HashMap<String, Int>()
    /** lower-case word -> how it should be written, e.g. "i'm" -> "I'm" */
    private val written = HashMap<String, String>()
    /** apostrophe-free form -> word, e.g. "dont" -> "don't" */
    private val contractions = HashMap<String, String>()
    private val sorted: List<String>

    private val userWords = HashMap<String, Int>()
    private val userPairs = HashMap<String, HashMap<String, Int>>()

    /** True when there is learned data not yet saved. */
    var dirty = false
        private set

    init {
        words.forEach { w ->
            val key = w.lowercase()
            if (key !in rank) {
                rank[key] = rank.size
                written[key] = w
                if ('\'' in key) contractions[key.replace("'", "")] = key
            }
        }
        sorted = rank.keys.sortedBy { rank[it] }
    }

    fun suggest(previous: String?, current: String, capitalize: Boolean): List<String> {
        val prev = previous?.lowercase()
        val result = if (current.isEmpty()) {
            if (prev == null) START else nextWords(prev).let { listOf(it[1], it[0], it[2]) }
        } else {
            val best = completions(prev, current, 2)
            listOf(current) + best
        }
        return result.map { w ->
            when {
                w == current -> w
                capitalize -> w.replaceFirstChar(Char::uppercaseChar)
                else -> w
            }
        }
    }

    /** Up to [limit] words starting with [prefix] (longer than it), best first. */
    fun completions(prev: String?, prefix: String, limit: Int): List<String> {
        val lower = prefix.lowercase()
        val followers = prev?.let { followerScores(it) }.orEmpty()
        val candidates = LinkedHashSet<String>()
        contractions[lower]?.let { candidates += it }
        userWords.keys.filter { it.startsWith(lower) && it.length > lower.length }.forEach { candidates += it }
        sorted.asSequence().filter { it.startsWith(lower) && it.length > lower.length }.take(40).forEach { candidates += it }
        return candidates
            .sortedByDescending { score(it, followers) + if (contractions[lower] == it) 10_000.0 else 0.0 }
            .take(limit)
            .map { written[it] ?: it }
    }

    /** Exactly three next-word guesses after [prev], best first. */
    fun nextWords(prev: String): List<String> {
        val scores = followerScores(prev)
        val ranked = scores.entries.sortedByDescending { it.value }.map { it.key }
        return (ranked + FALLBACK).distinct().take(3).map { written[it] ?: it }
    }

    private fun followerScores(prev: String): Map<String, Double> {
        val out = HashMap<String, Double>()
        BUILT_IN_NEXT[prev]?.forEachIndexed { i, w -> out[w] = 50.0 - i }
        userPairs[prev]?.forEach { (w, n) -> out[w] = (out[w] ?: 0.0) + 100.0 * n }
        return out
    }

    private fun score(word: String, followers: Map<String, Double>): Double {
        val common = rank[word]?.let { 1000.0 / (it + 10) } ?: 0.0
        val mine = (userWords[word] ?: 0) * 20.0
        return common + mine + (followers[word] ?: 0.0)
    }

    fun learn(previous: String?, word: String) {
        val w = word.lowercase().trim('\'')
        if (w.isEmpty() || w.length > 30 || w.any { !it.isLetter() && it != '\'' }) return
        userWords[w] = (userWords[w] ?: 0) + 1
        if (w !in written) written[w] = word
        previous?.lowercase()?.let { p ->
            val m = userPairs.getOrPut(p) { HashMap() }
            m[w] = (m[w] ?: 0) + 1
        }
        trim()
        dirty = true
    }

    fun clearLearned() {
        userWords.clear()
        userPairs.clear()
        dirty = true
    }

    /** Learned data as text: "w<TAB>word<TAB>count" and "p<TAB>prev<TAB>next<TAB>count" lines. */
    fun serialize(): String = buildString {
        userWords.forEach { (w, n) -> append("w\t").append(w).append('\t').append(n).append('\n') }
        userPairs.forEach { (p, m) -> m.forEach { (w, n) -> append("p\t$p\t$w\t$n\n") } }
    }.also { dirty = false }

    fun restore(text: String) {
        text.lineSequence().forEach { line ->
            val f = line.split('\t')
            when {
                f.size == 3 && f[0] == "w" -> f[2].toIntOrNull()?.let { userWords[f[1]] = it }
                f.size == 4 && f[0] == "p" -> f[3].toIntOrNull()?.let { userPairs.getOrPut(f[1]) { HashMap() }[f[2]] = it }
            }
        }
    }

    private fun trim() {
        if (userWords.size > MAX_WORDS) {
            userWords.entries.sortedBy { it.value }.take(userWords.size - MAX_WORDS).forEach { userWords.remove(it.key) }
        }
        if (userPairs.size > MAX_PAIRS) {
            userPairs.entries.sortedBy { e -> e.value.values.sum() }.take(userPairs.size - MAX_PAIRS)
                .forEach { userPairs.remove(it.key) }
        }
    }

    companion object {
        private const val MAX_WORDS = 5000
        private const val MAX_PAIRS = 2000

        /** Shown at the start of a message or sentence. */
        val START = listOf("I", "The", "I'm")

        private val FALLBACK = listOf("the", "to", "and", "i", "you", "a")

        /** Common next words, best first. Keys and values are lower case. */
        private val BUILT_IN_NEXT: Map<String, List<String>> = mapOf(
            "i" to listOf("am", "have", "will", "think", "love", "don't", "can", "was", "know", "just"),
            "i'm" to listOf("going", "so", "not", "sorry", "fine", "good", "here", "home", "on"),
            "i'll" to listOf("be", "call", "send", "see", "let", "do"),
            "you" to listOf("are", "can", "have", "know", "too", "want", "guys"),
            "you're" to listOf("welcome", "right", "so", "the", "not"),
            "thank" to listOf("you", "god"),
            "thanks" to listOf("for", "so", "a"),
            "how" to listOf("are", "is", "about", "much", "many", "was"),
            "how's" to listOf("it", "your", "the"),
            "what" to listOf("is", "are", "do", "time", "about", "happened"),
            "what's" to listOf("up", "the", "your"),
            "where" to listOf("are", "is", "do"),
            "when" to listOf("are", "is", "will", "you"),
            "good" to listOf("morning", "night", "luck", "job", "day"),
            "see" to listOf("you", "the", "it"),
            "on" to listOf("my", "the", "it"),
            "my" to listOf("way", "god", "friend", "phone", "mom", "love"),
            "are" to listOf("you", "we", "they", "going"),
            "it's" to listOf("a", "not", "so", "okay", "fine", "been"),
            "let's" to listOf("go", "do", "meet", "see"),
            "let" to listOf("me", "us", "you"),
            "in" to listOf("the", "a", "my"),
            "to" to listOf("the", "be", "go", "see", "do", "get", "me"),
            "at" to listOf("the", "home", "work"),
            "the" to listOf("way", "best", "same", "other", "first", "morning"),
            "going" to listOf("to", "home", "out"),
            "want" to listOf("to", "you", "a"),
            "need" to listOf("to", "a", "help"),
            "have" to listOf("a", "to", "you", "been", "fun"),
            "will" to listOf("be", "do", "you", "call", "see"),
            "can" to listOf("you", "i", "we", "be"),
            "do" to listOf("you", "it", "not"),
            "don't" to listOf("know", "worry", "have", "want"),
            "love" to listOf("you", "it", "this"),
            "miss" to listOf("you", "it"),
            "call" to listOf("me", "you", "it"),
            "talk" to listOf("to", "later", "soon"),
            "happy" to listOf("birthday", "new", "to"),
            "please" to listOf("let", "call", "send"),
            "for" to listOf("the", "a", "me", "you"),
            "of" to listOf("the", "course", "my"),
            "take" to listOf("care", "a", "it"),
            "get" to listOf("back", "home", "the"),
            "come" to listOf("back", "home", "on"),
            "very" to listOf("much", "good", "nice"),
            "so" to listOf("much", "good", "happy", "sorry"),
            "and" to listOf("the", "i", "you"),
            "but" to listOf("i", "the", "it"),
            "is" to listOf("it", "the", "a", "not"),
            "it" to listOf("is", "was", "will"),
            "we" to listOf("are", "can", "will", "have"),
            "that" to listOf("is", "was", "you"),
            "that's" to listOf("great", "good", "fine", "it", "why"),
            "this" to listOf("is", "morning", "week"),
            "just" to listOf("now", "a", "got"),
        )
    }
}
