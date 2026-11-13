package com.glasskeyboard.ime

/** One key on the keyboard. [alternates] appear on long-press; the first one is drawn as a small hint. */
data class Key(
    val label: String,
    val type: KeyType = KeyType.CHAR,
    val alternates: List<String> = emptyList(),
    val weight: Float = 1f,
)

enum class KeyType { CHAR, SHIFT, BACKSPACE, SYMBOLS, LETTERS, EMOJI, SPACE, ENTER, SPACER }

enum class Page { LETTERS, SYMBOLS, EMOJI }

object Layouts {
    private fun c(label: String, vararg alt: String) = Key(label, alternates = alt.toList())

    /** English (UK) QWERTY with a number row, matching the user's current keyboard. */
    val englishLetters: List<List<Key>> = listOf(
        "1234567890".map { c(it.toString()) },
        "qwertyuiop".map { c(it.toString()) },
        listOf(Key("", KeyType.SPACER, weight = 0.5f)) +
            "asdfghjkl".map { c(it.toString()) } +
            Key("", KeyType.SPACER, weight = 0.5f),
        listOf(Key("⇧", KeyType.SHIFT, weight = 1.5f)) +
            "zxcvbnm".map { c(it.toString()) } +
            Key("⌫", KeyType.BACKSPACE, weight = 1.5f),
    )

    val symbols: List<List<Key>> = listOf(
        "1234567890".map { c(it.toString()) },
        listOf("-", "/", ":", ";", "(", ")", "£", "&", "@", "\"").map { c(it) },
        listOf(Key("*", weight = 1.5f)) +
            listOf(".", ",", "?", "!", "'", "%", "+").map { c(it) } +
            Key("⌫", KeyType.BACKSPACE, weight = 1.5f),
    )

    val emoji: List<String> = listOf(
        "😀", "😂", "🥹", "😍", "😘", "😊", "😉", "😎", "🤔", "😴",
        "😢", "😭", "😡", "🥳", "🤩", "😅", "🙃", "😇", "🤗", "🙄",
        "👍", "👎", "👏", "🙏", "💪", "👋", "🤝", "✌️", "👌", "🤞",
        "❤️", "🧡", "💛", "💚", "💙", "💜", "🔥", "✨", "🎉", "💯",
    )
}
