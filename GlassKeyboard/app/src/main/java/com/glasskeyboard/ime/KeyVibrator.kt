package com.glasskeyboard.ime

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager

/** How strong the key-press vibration is. */
enum class VibrationLevel(val id: String, val label: String, val millis: Long, val amplitude: Int) {
    LIGHT("light", "Light", 10, 45),
    MEDIUM("medium", "Medium", 14, 110),
    STRONG("strong", "Strong", 20, 220);

    companion object {
        val DEFAULT = LIGHT
        fun byId(id: String?) = entries.firstOrNull { it.id == id } ?: DEFAULT
    }
}

/** Short, smooth key-press vibration at a chosen [VibrationLevel]. */
class KeyVibrator(context: Context) {
    private val vibrator: Vibrator? =
        if (Build.VERSION.SDK_INT >= 31) context.getSystemService(VibratorManager::class.java)?.defaultVibrator
        else @Suppress("DEPRECATION") context.getSystemService(Vibrator::class.java)

    fun tick(level: VibrationLevel) {
        val v = vibrator?.takeIf { it.hasVibrator() } ?: return
        val effect = when {
            // Best case: a short pulse at an exact strength.
            v.hasAmplitudeControl() -> VibrationEffect.createOneShot(level.millis, level.amplitude)
            // Phones without strength control: use the system's built-in tick / click / heavy click.
            Build.VERSION.SDK_INT >= 29 -> VibrationEffect.createPredefined(
                when (level) {
                    VibrationLevel.LIGHT -> VibrationEffect.EFFECT_TICK
                    VibrationLevel.MEDIUM -> VibrationEffect.EFFECT_CLICK
                    VibrationLevel.STRONG -> VibrationEffect.EFFECT_HEAVY_CLICK
                }
            )
            else -> VibrationEffect.createOneShot(level.millis, VibrationEffect.DEFAULT_AMPLITUDE)
        }
        v.vibrate(effect)
    }
}
