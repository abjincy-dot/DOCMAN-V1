package com.glasskeyboard.ime

import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

/** A soft coloured light behind the keys. Position and radius are fractions of the keyboard width/height. */
data class Glow(val color: Color, val x: Float, val y: Float, val radius: Float, val alpha: Float)

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

    val all = listOf(Aurora, Ocean, Sunset, Forest, Neon, Midnight, Sakura, Frost)

    fun byId(id: String?) = all.firstOrNull { it.id == id } ?: Aurora
}

val LocalKeyboardTheme = staticCompositionLocalOf { Themes.Aurora }

/** The active keyboard theme. Read inside composables, e.g. `Glass.accent`. */
val Glass: KeyboardTheme
    @Composable @ReadOnlyComposable get() = LocalKeyboardTheme.current
