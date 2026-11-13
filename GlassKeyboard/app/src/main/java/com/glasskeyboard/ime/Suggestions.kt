package com.glasskeyboard.ime

/**
 * Very small starter suggestion engine: prefix match against a built-in list of common
 * English words, ordered by rough frequency. Replace with a real dictionary later.
 */
object Suggestions {
    val defaults = listOf("I", "The", "I'm")

    private val words: List<String> = """
        the and to of a in is it you that for on was with he she we they this be are have
        not but at what so if my your all can will just do there from about out up one
        hello hi hey thanks thank please sorry okay yes no maybe sure great good nice love
        today tomorrow yesterday tonight morning evening night week weekend month year
        time home work school family friend friends mum dad brother sister baby
        when where why how who which what's that's don't can't won't I'm I'll it's
        going coming call text later soon now here there see meet send know think
        want need like get got make take come back really very much well also
        London weather lunch dinner breakfast coffee tea water food money car bus train
        Monday Tuesday Wednesday Thursday Friday Saturday Sunday
    """.trim().split(Regex("\\s+"))

    fun forPrefix(prefix: String, limit: Int = 3): List<String> {
        if (prefix.isEmpty()) return defaults
        val lower = prefix.lowercase()
        val matches = words.asSequence()
            .filter { it.lowercase().startsWith(lower) && it.length > prefix.length }
            .distinctBy { it.lowercase() }
            .take(limit - 1)
            .map { if (prefix.first().isUpperCase()) it.replaceFirstChar(Char::uppercase) else it }
            .toList()
        // First slot always echoes what was typed, like most keyboards.
        return listOf(prefix) + matches
    }
}
