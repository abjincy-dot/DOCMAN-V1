package com.glasskeyboard.ime

/** Allowed keyboard height range, as a fraction of the normal height. */
object KeyboardHeight {
    const val MIN = 0.75f
    const val MAX = 1.0f
    const val DEFAULT = 1f
    /** Slider positions between MIN and MAX (5% apart). */
    const val STEPS = 4
}
