package com.glasskeyboard.ime

import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

/** A soft coloured light behind the keys. Position and radius are fractions of the keyboard width/height. */
data class Glow(val color: Color, val x: Float, val y: Float, val radius: Float, val alpha: Float)

/** How keys are drawn: flat see-through glass, or raised rounded 3D keys. */
enum class KeyStyle(val id: String, val label: String) {
    GLASS("glass", "Glass"),
    PEBBLE("3d", "3D");

    companion object {
        val DEFAULT = PEBBLE
        fun byId(id: String?) = entries.firstOrNull { it.id == id } ?: DEFAULT
    }
}

/**
 * Colours for one keyboard theme. The per-key colours (letter, mod, func, space, enter) default to
 * the shared glass colours, so simple themes only set the basics; multicolour themes override them.
 */
data class KeyboardTheme(
    val id: String,
    val name: String,
    val outer: Color,
    val base: Color,
    val glows: List<Glow>,
    val key: Color,
    val modKey: Color,
    val pressed: Color,
    val border: Color,
    val text: Color,
    val hint: Color,
    val accent: Color,
    val onAccent: Color,
    val accentIcon: Color,
    val popup: Color,
    /** Letter, number and punctuation keys. */
    val letter: Color = key,
    /** Shift and backspace. */
    val mod: Color = modKey,
    /** 123 / ABC and emoji keys. */
    val func: Color = modKey,
    val space: Color = key,
    val enter: Color = accent,
    val letterText: Color = text,
    val modText: Color = text,
    val funcText: Color = text,
    val spaceText: Color = text,
    val enterText: Color = onAccent,
    /** Suggestion words in the top bar (they sit on the background, not on a key). */
    val barText: Color = text,
)

private fun darkGlass(
    id: String, name: String, outer: Long, base: Long, accent: Long, accentIcon: Long, popup: Long,
    glows: List<Glow>, keyAlpha: Float = 0.10f,
) = KeyboardTheme(
    id = id, name = name,
    outer = Color(outer), base = Color(base), glows = glows,
    key = Color.White.copy(alpha = keyAlpha),
    modKey = Color.White.copy(alpha = keyAlpha + 0.07f),
    pressed = Color.White.copy(alpha = 0.32f),
    border = Color.White.copy(alpha = 0.16f),
    text = Color.White,
    hint = Color.White.copy(alpha = 0.65f),
    accent = Color(accent), onAccent = Color.White,
    accentIcon = Color(accentIcon), popup = Color(popup),
)

private fun lightGlass(
    id: String, name: String, outer: Long, base: Long, text: Long, accent: Long, accentIcon: Long,
    glows: List<Glow>,
) = KeyboardTheme(
    id = id, name = name,
    outer = Color(outer), base = Color(base), glows = glows,
    key = Color.White.copy(alpha = 0.55f),
    modKey = Color.White.copy(alpha = 0.32f),
    pressed = Color.White.copy(alpha = 0.9f),
    border = Color.White.copy(alpha = 0.7f),
    text = Color(text),
    hint = Color(text).copy(alpha = 0.55f),
    accent = Color(accent), onAccent = Color.White,
    accentIcon = Color(accentIcon), popup = Color.White,
)

object Themes {
    val Aurora = darkGlass(
        "aurora", "Aurora", 0xFF0E0B1F, 0xFF241B4A, 0xFF5B4FD6, 0xFF8E83FF, 0xFF2E2650,
        listOf(
            Glow(Color(0xFFE8613C), 0.78f, 0.15f, 0.55f, 0.85f),
            Glow(Color(0xFF2C7FD8), 0.10f, 0.80f, 0.45f, 0.80f),
            Glow(Color(0xFF8A3FD1), 0.55f, 1.00f, 0.50f, 0.60f),
        ),
    )
    val Ocean = darkGlass(
        "ocean", "Ocean", 0xFF04111C, 0xFF07263A, 0xFF0FA3B1, 0xFF5EE6EB, 0xFF0B3348,
        listOf(
            Glow(Color(0xFF00C2D1), 0.85f, 0.10f, 0.55f, 0.70f),
            Glow(Color(0xFF1B4DDB), 0.05f, 0.90f, 0.55f, 0.75f),
            Glow(Color(0xFF2DE1C2), 0.45f, 0.55f, 0.35f, 0.25f),
        ),
    )
    val Sunset = darkGlass(
        "sunset", "Sunset", 0xFF1A0710, 0xFF3A0E2A, 0xFFFF6A3D, 0xFFFFA06B, 0xFF4A1530,
        listOf(
            Glow(Color(0xFFFFB13B), 0.15f, 0.05f, 0.55f, 0.80f),
            Glow(Color(0xFFFF3D7F), 0.85f, 0.45f, 0.55f, 0.75f),
            Glow(Color(0xFF7B2FBE), 0.30f, 1.00f, 0.50f, 0.70f),
        ),
    )
    val Forest = darkGlass(
        "forest", "Forest", 0xFF06120C, 0xFF0D2A1C, 0xFF2FA866, 0xFF7BE3A4, 0xFF123A27,
        listOf(
            Glow(Color(0xFF3BD18A), 0.20f, 0.10f, 0.50f, 0.55f),
            Glow(Color(0xFFB7E34B), 0.90f, 0.85f, 0.45f, 0.45f),
            Glow(Color(0xFF0E7A6B), 0.60f, 0.40f, 0.45f, 0.50f),
        ),
    )
    val Neon = darkGlass(
        "neon", "Neon", 0xFF000000, 0xFF07060D, 0xFFFF2BD6, 0xFF2BF3FF, 0xFF1A1030,
        listOf(
            Glow(Color(0xFFFF2BD6), 0.00f, 0.00f, 0.55f, 0.55f),
            Glow(Color(0xFF2BF3FF), 1.00f, 1.00f, 0.55f, 0.55f),
        ),
        keyAlpha = 0.07f,
    )
    val Midnight = darkGlass(
        "midnight", "Midnight", 0xFF08080C, 0xFF16161F, 0xFF6C63FF, 0xFFA9A4FF, 0xFF24243A,
        listOf(Glow(Color(0xFF3A3A6A), 0.50f, 0.00f, 0.70f, 0.50f)),
    )
    val Sakura = lightGlass(
        "sakura", "Sakura", 0xFFF6E6EC, 0xFFF9D9E5, 0xFF4A2234, 0xFFE0567F, 0xFFD2416E,
        listOf(
            Glow(Color(0xFFFFFFFF), 0.20f, 0.10f, 0.55f, 0.80f),
            Glow(Color(0xFFF59AB8), 0.90f, 0.70f, 0.55f, 0.70f),
            Glow(Color(0xFFC9B3F5), 0.35f, 1.00f, 0.45f, 0.60f),
        ),
    )
    val Frost = lightGlass(
        "frost", "Frost", 0xFFE6EEF7, 0xFFD6E4F5, 0xFF1C2A3C, 0xFF3D7BE8, 0xFF2F68D0,
        listOf(
            Glow(Color(0xFFFFFFFF), 0.80f, 0.10f, 0.55f, 0.90f),
            Glow(Color(0xFF9CC6FF), 0.10f, 0.80f, 0.55f, 0.75f),
            Glow(Color(0xFFBFE9F2), 0.60f, 1.00f, 0.45f, 0.70f),
        ),
    )

    /** Deep navy keys with a gold Enter key. */
    val Navy = KeyboardTheme(
        id = "navy", name = "Navy",
        outer = Color(0xFF0B0D16), base = Color(0xFF151C36),
        glows = listOf(Glow(Color(0xFF2E4C9A), 0.5f, 0.0f, 0.7f, 0.35f)),
        key = Color(0xFF2D3C70), modKey = Color(0xFF2D3C70),
        pressed = Color.White.copy(alpha = 0.30f), border = Color.White.copy(alpha = 0.12f),
        text = Color(0xFFDCE2F5), hint = Color.White.copy(alpha = 0.55f),
        accent = Color(0xFFE9B949), onAccent = Color(0xFF3A2A05),
        accentIcon = Color(0xFFB9C3E6), popup = Color(0xFF24305A),
    )

    /** Playful multicolour: blue letters, red shift / delete / space, orange 123 / emoji, yellow Enter. */
    val Crayon = KeyboardTheme(
        id = "crayon", name = "Crayon",
        outer = Color(0xFF1B1B1F), base = Color(0xFF26262C),
        glows = listOf(
            Glow(Color(0xFFD7303D), 0.10f, 0.0f, 0.45f, 0.18f),
            Glow(Color(0xFF3D6FD6), 0.90f, 1.0f, 0.50f, 0.20f),
        ),
        key = Color(0xFF3D6FD6), modKey = Color(0xFFD7303D),
        pressed = Color.White.copy(alpha = 0.30f), border = Color.White.copy(alpha = 0.14f),
        text = Color.White, hint = Color.White.copy(alpha = 0.6f),
        accent = Color(0xFFF3C01C), onAccent = Color(0xFF4A2C00),
        accentIcon = Color(0xFFF3C01C), popup = Color(0xFF2F3F7A),
        func = Color(0xFFB4561F), funcText = Color(0xFFFBE3CF),
        space = Color(0xFFD7303D), spaceText = Color(0xFFFFDDE0),
    )

    /** Glossy black keys on a soft lavender-grey background. */
    val Onyx = KeyboardTheme(
        id = "onyx", name = "Onyx",
        outer = Color(0xFFF0EFF7), base = Color(0xFFE2E1F1),
        glows = listOf(Glow(Color.White, 0.5f, 0.0f, 0.7f, 0.6f)),
        key = Color(0xFF2C2C32), modKey = Color(0xFF2C2C32),
        pressed = Color.White.copy(alpha = 0.25f), border = Color.Black.copy(alpha = 0.10f),
        text = Color(0xFFF4F4F6), hint = Color.White.copy(alpha = 0.6f),
        accent = Color(0xFF2C2C32), onAccent = Color.White,
        accentIcon = Color(0xFF55555F), popup = Color(0xFF2C2C32),
        barText = Color(0xFF2C2C32),
    )

    val all = listOf(Navy, Crayon, Onyx, Aurora, Ocean, Sunset, Forest, Neon, Midnight, Sakura, Frost)

    fun byId(id: String?) = all.firstOrNull { it.id == id } ?: Aurora
}

val LocalKeyboardTheme = staticCompositionLocalOf { Themes.Aurora }

/** The active keyboard theme. Read inside composables, e.g. `Glass.accent`. */
val Glass: KeyboardTheme
    @Composable @ReadOnlyComposable get() = LocalKeyboardTheme.current
