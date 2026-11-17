package com.glasskeyboard.ime

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager

/** Key-press vibration strength: 0 = off, 1 = strongest. */
object VibrationStrength {
    const val DEFAULT = 0.25f
    /** Slider positions between 0 and 1 (10% apart). */
    const val STEPS = 9
}

/** Short, smooth key-press vibration whose strength follows a 0..1 value. */
class KeyVibrator(context: Context) {
    private val vibrator: Vibrator? =
        if (Build.VERSION.SDK_INT >= 31) context.getSystemService(VibratorManager::class.java)?.defaultVibrator
        else @Suppress("DEPRECATION") context.getSystemService(Vibrator::class.java)

    private val hasPrimitives: Boolean =
        Build.VERSION.SDK_INT >= 30 && vibrator?.areAllPrimitivesSupported(
            VibrationEffect.Composition.PRIMITIVE_TICK,
            VibrationEffect.Composition.PRIMITIVE_CLICK,
        ) == true

    fun tick(strength: Float) {
        val s = strength.coerceIn(0f, 1f)
        if (s <= 0f) return
        val v = vibrator?.takeIf { it.hasVibrator() } ?: return
        val effect = when {
            // Smoothest: the phone's tuned haptic "tick" for the lower half, a soft "click" above it.
            hasPrimitives && Build.VERSION.SDK_INT >= 30 -> {
                val (primitive, scale) = if (s <= 0.5f) {
                    VibrationEffect.Composition.PRIMITIVE_TICK to (s * 2f).coerceAtLeast(0.08f)
                } else {
                    VibrationEffect.Composition.PRIMITIVE_CLICK to (0.25f + (s - 0.5f) * 1.5f)
                }
                VibrationEffect.startComposition().addPrimitive(primitive, scale).compose()
            }
            // Next best: a very short pulse at an exact strength.
            v.hasAmplitudeControl() ->
                VibrationEffect.createOneShot(3L + (s * 9f).toLong(), (8 + s * 200f).toInt().coerceIn(1, 255))
            // Phones without strength control: pick the closest built-in effect.
            Build.VERSION.SDK_INT >= 29 -> VibrationEffect.createPredefined(
                when {
                    s < 0.4f -> VibrationEffect.EFFECT_TICK
                    s < 0.8f -> VibrationEffect.EFFECT_CLICK
                    else -> VibrationEffect.EFFECT_HEAVY_CLICK
                }
            )
            else -> VibrationEffect.createOneShot(3L + (s * 12f).toLong(), VibrationEffect.DEFAULT_AMPLITUDE)
        }
        v.vibrate(effect)
    }
}
