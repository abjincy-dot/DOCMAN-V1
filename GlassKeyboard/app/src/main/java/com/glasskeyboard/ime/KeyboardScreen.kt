package com.glasskeyboard.ime

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.waitForUpOrCancellation
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Backspace
import androidx.compose.material.icons.automirrored.outlined.KeyboardReturn
import androidx.compose.material.icons.outlined.EmojiEmotions
import androidx.compose.material.icons.outlined.GridView
import androidx.compose.material.icons.outlined.KeyboardHide
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.zIndex
import com.glasskeyboard.data.SymbolSlots
import kotlin.math.floor
import kotlin.math.roundToInt

private val KeyShape = RoundedCornerShape(12.dp)
private val RowHeight = 54.dp
private val PopupCell = 42.dp

/** Base colour plus the theme's soft coloured glows behind the keys. */
internal fun Modifier.glassBackground(theme: KeyboardTheme) = drawBehind {
    drawRect(theme.base)
    theme.glows.forEach { g ->
        drawRect(
            Brush.radialGradient(
                listOf(g.color.copy(alpha = g.alpha), Color.Transparent),
                center = Offset(size.width * g.x, size.height * g.y),
                radius = size.width * g.radius,
            )
        )
    }
}

@Composable
fun KeyboardScreen(
    state: KeyboardState,
    slots: SymbolSlots,
    actions: KeyboardActions,
    theme: KeyboardTheme = Themes.Aurora,
) = CompositionLocalProvider(LocalKeyboardTheme provides theme) {
    Box(
        Modifier
            .fillMaxWidth()
            .background(Glass.outer)
            .navigationBarsPadding()
            .padding(6.dp)
    ) {
        Column(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(22.dp))
                .glassBackground(theme)
                .border(1.dp, Glass.border, RoundedCornerShape(22.dp))
                .padding(horizontal = 3.dp, vertical = 4.dp)
        ) {
            TopBar(state, actions)
            when (state.page) {
                Page.LETTERS -> KeyRows(Layouts.englishLetters, state, actions)
                Page.SYMBOLS -> KeyRows(Layouts.symbols, state, actions)
                Page.EMOJI -> EmojiGrid(actions)
            }
            BottomRow(state, slots, actions)
        }
    }
}

@Composable
private fun TopBar(state: KeyboardState, actions: KeyboardActions) {
    Row(
        Modifier
            .fillMaxWidth()
            .height(46.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        BarIcon(Icons.Outlined.GridView, "Settings", actions::onOpenSettings)
        Row(Modifier.weight(1f).fillMaxHeight(), verticalAlignment = Alignment.CenterVertically) {
            val words = state.suggestions
            if (state.suggestionsEnabled) {
                for (i in 0 until 3) {
                    if (i > 0) Box(Modifier.width(1.dp).height(24.dp).background(Glass.hint.copy(alpha = 0.4f)))
                    val word = words.getOrNull(i)
                    Box(
                        Modifier
                            .weight(1f)
                            .fillMaxHeight()
                            .then(if (word != null) Modifier.clickable { actions.onSuggestion(word) } else Modifier),
                        contentAlignment = Alignment.Center,
                    ) {
                        if (word != null) {
                            Text(word, color = Glass.text, fontSize = 18.sp, maxLines = 1)
                        }
                    }
                }
            }
        }
        BarIcon(Icons.Outlined.KeyboardHide, "Hide keyboard", actions::onHide)
    }
}

@Composable
private fun BarIcon(icon: ImageVector, description: String, onClick: () -> Unit) {
    Box(
        Modifier
            .size(46.dp)
            .clip(RoundedCornerShape(10.dp))
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, description, tint = Glass.accentIcon, modifier = Modifier.size(28.dp))
    }
}

@Composable
private fun KeyRows(rows: List<List<Key>>, state: KeyboardState, actions: KeyboardActions) {
    rows.forEach { row ->
        Row(Modifier.fillMaxWidth().height(RowHeight)) {
            row.forEach { key -> KeyView(key, state, actions) }
        }
    }
}

@Composable
private fun RowScope.KeyView(key: Key, state: KeyboardState, actions: KeyboardActions) {
    val mod = Modifier.weight(key.weight)
    when (key.type) {
        KeyType.CHAR -> {
            val upper = state.shift != ShiftState.OFF && state.page == Page.LETTERS
            fun cased(s: String) = if (upper) s.uppercase() else s
            CharKey(
                label = cased(key.label),
                alternates = key.alternates.map(::cased),
                onCommit = actions::onText,
                modifier = mod,
            )
        }
        KeyType.SHIFT -> TapKey(mod, background = if (state.shift == ShiftState.OFF) Glass.modKey else Glass.pressed, onTap = actions::onShift) {
            Text(
                if (state.shift == ShiftState.LOCKED) "⇪" else "⇧",
                color = Glass.text,
                fontSize = 24.sp,
                fontWeight = if (state.shift == ShiftState.OFF) FontWeight.Normal else FontWeight.Bold,
            )
        }
        KeyType.BACKSPACE -> RepeatKey(mod, onRepeat = actions::onBackspace) {
            Icon(Icons.AutoMirrored.Outlined.Backspace, "Delete", tint = Glass.text)
        }
        KeyType.SPACER -> Spacer(mod)
        else -> Spacer(mod)
    }
}

/** Shared glass key surface. */
@Composable
private fun KeySurface(
    modifier: Modifier,
    pressed: Boolean,
    background: Color = Glass.key,
    content: @Composable () -> Unit,
) {
    Box(
        modifier
            .fillMaxHeight()
            .padding(horizontal = 3.dp, vertical = 4.dp)
            .clip(KeyShape)
            .background(if (pressed) Glass.pressed else background)
            .border(1.dp, Glass.border, KeyShape),
        contentAlignment = Alignment.Center,
    ) { content() }
}

/** Simple tap key with optional long-press. */
@Composable
private fun TapKey(
    modifier: Modifier,
    background: Color = Glass.modKey,
    onLongPress: (() -> Unit)? = null,
    onTap: () -> Unit,
    content: @Composable () -> Unit,
) {
    var pressed by remember { mutableStateOf(false) }
    val haptic = LocalHapticFeedback.current
    val tap by rememberUpdatedState(onTap)
    val longPress by rememberUpdatedState(onLongPress)
    KeySurface(
        modifier.pointerInput(Unit) {
            detectTapGestures(
                onPress = {
                    pressed = true
                    haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                    tryAwaitRelease()
                    pressed = false
                },
                onLongPress = if (onLongPress != null) { _ -> longPress?.invoke() } else null,
                onTap = { tap() },
            )
        },
        pressed = pressed,
        background = background,
        content = content,
    )
}

/** Fires once on press, then repeats while held (used for backspace). */
@Composable
private fun RepeatKey(modifier: Modifier, onRepeat: () -> Unit, content: @Composable () -> Unit) {
    var pressed by remember { mutableStateOf(false) }
    val haptic = LocalHapticFeedback.current
    val action by rememberUpdatedState(onRepeat)
    KeySurface(
        modifier.pointerInput(Unit) {
            awaitEachGesture {
                awaitFirstDown()
                pressed = true
                haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                action()
                var released = withTimeoutOrNull(400) { waitForUpOrCancellation(); true } ?: false
                while (!released) {
                    action()
                    released = withTimeoutOrNull(55) { waitForUpOrCancellation(); true } ?: false
                }
                pressed = false
            }
        },
        pressed = pressed,
        background = Glass.modKey,
        content = content,
    )
}

/**
 * A letter key. Tap types [label]. Long-press opens a popup with [alternates]
 * (accents); slide sideways to choose, lift to type it.
 */
@Composable
private fun CharKey(
    label: String,
    alternates: List<String>,
    onCommit: (String) -> Unit,
    modifier: Modifier,
) {
    var pressed by remember { mutableStateOf(false) }
    var popupOpen by remember { mutableStateOf(false) }
    var selected by remember { mutableIntStateOf(0) }
    var keyLeft by remember { mutableFloatStateOf(0f) }
    var keyWidth by remember { mutableFloatStateOf(0f) }
    var rootWidth by remember { mutableFloatStateOf(0f) }

    val haptic = LocalHapticFeedback.current
    val density = LocalDensity.current
    val cellPx = with(density) { PopupCell.toPx() }
    val currentLabel by rememberUpdatedState(label)
    val currentAlternates by rememberUpdatedState(alternates)
    val commit by rememberUpdatedState(onCommit)

    // Keys on the right half open their popup leftwards, with the nearest accent first.
    val opensLeft = keyLeft + keyWidth / 2 > rootWidth / 2
    val shown = if (opensLeft) alternates.reversed() else alternates
    val popupWidthPx = cellPx * shown.size
    val popupLeftPx = if (opensLeft) keyWidth - popupWidthPx else 0f

    Box(
        modifier
            .fillMaxHeight()
            .zIndex(if (popupOpen) 1f else 0f)
            .onGloballyPositioned { coords ->
                keyLeft = coords.positionInRoot().x
                keyWidth = coords.size.width.toFloat()
                var root = coords
                while (root.parentLayoutCoordinates != null) root = root.parentLayoutCoordinates!!
                rootWidth = root.size.width.toFloat()
            }
            .pointerInput(Unit) {
                awaitEachGesture {
                    val down = awaitFirstDown()
                    pressed = true
                    haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                    val alts = currentAlternates
                    // null = long-press timeout, true = released, false = cancelled
                    val tapResult: Boolean? = if (alts.isEmpty()) {
                        waitForUpOrCancellation() != null
                    } else {
                        withTimeoutOrNull(viewConfiguration.longPressTimeoutMillis) {
                            waitForUpOrCancellation() != null
                        }
                    }
                    when (tapResult) {
                        true -> commit(currentLabel)
                        false -> Unit
                        null -> {
                            val left = keyLeft + keyWidth / 2 > rootWidth / 2
                            val options = if (left) alts.reversed() else alts
                            val popupLeft = if (left) keyWidth - cellPx * options.size else 0f
                            fun indexAt(x: Float) =
                                floor((x - popupLeft) / cellPx).toInt().coerceIn(0, options.lastIndex)
                            selected = if (left) options.lastIndex else 0
                            popupOpen = true
                            haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                            while (true) {
                                val event = awaitPointerEvent()
                                val change = event.changes.firstOrNull { it.id == down.id } ?: break
                                if (!change.pressed) {
                                    commit(options[selected])
                                    break
                                }
                                val idx = indexAt(change.position.x)
                                if (idx != selected) {
                                    selected = idx
                                    haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                }
                                change.consume()
                            }
                            popupOpen = false
                        }
                    }
                    pressed = false
                }
            }
    ) {
        KeySurface(Modifier.fillMaxWidth(), pressed = pressed) {
            Text(label, color = Glass.text, fontSize = 24.sp)
        }
        alternates.firstOrNull()?.let { hint ->
            Text(
                hint,
                color = Glass.hint,
                fontSize = 11.sp,
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(top = 6.dp, end = 10.dp),
            )
        }
        if (popupOpen) {
            Row(
                Modifier
                    .wrapContentSize(align = Alignment.TopStart, unbounded = true)
                    .offset { IntOffset(popupLeftPx.roundToInt(), -(cellPx * 1.2f).roundToInt()) }
                    .clip(RoundedCornerShape(14.dp))
                    .background(Glass.popup)
                    .border(1.dp, Glass.border, RoundedCornerShape(14.dp)),
                horizontalArrangement = Arrangement.Start,
            ) {
                shown.forEachIndexed { i, ch ->
                    Box(
                        Modifier
                            .size(PopupCell, PopupCell * 1.15f)
                            .padding(3.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .background(if (i == selected) Glass.accent else Color.Transparent),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(ch, color = if (i == selected) Glass.onAccent else Glass.text, fontSize = 22.sp)
                    }
                }
            }
        }
    }
}

@Composable
private fun EmojiGrid(actions: KeyboardActions) {
    LazyVerticalGrid(
        columns = GridCells.Fixed(8),
        modifier = Modifier
            .fillMaxWidth()
            .height(RowHeight * 3),
    ) {
        items(Layouts.emoji) { e ->
            Box(
                Modifier
                    .height(RowHeight)
                    .fillMaxSize()
                    .clip(KeyShape)
                    .clickable { actions.onText(e) },
                contentAlignment = Alignment.Center,
            ) { Text(e, fontSize = 26.sp) }
        }
    }
}

/** 123 · emoji · , · [symbol slots] · space · [symbol slots] · . · enter */
@Composable
private fun BottomRow(state: KeyboardState, slots: SymbolSlots, actions: KeyboardActions) {
    val s = slots.slots
    val emptySlots = s.count { it == null }
    Row(Modifier.fillMaxWidth().height(RowHeight)) {
        if (state.page == Page.LETTERS) {
            TapKey(Modifier.weight(1.2f), onTap = { actions.onPage(Page.SYMBOLS) }) {
                Text("123", color = Glass.text, fontSize = 18.sp)
            }
        } else {
            TapKey(Modifier.weight(1.2f), onTap = { actions.onPage(Page.LETTERS) }) {
                Text("ABC", color = Glass.text, fontSize = 18.sp)
            }
        }
        TapKey(
            Modifier.weight(1f),
            onTap = { actions.onPage(if (state.page == Page.EMOJI) Page.LETTERS else Page.EMOJI) },
        ) {
            Icon(Icons.Outlined.EmojiEmotions, "Emoji", tint = Glass.text)
        }
        CharTap(",", actions)
        s.getOrNull(0)?.let { CharTap(it, actions) }
        s.getOrNull(1)?.let { CharTap(it, actions) }
        TapKey(
            Modifier.weight(2.2f + 0.5f * emptySlots),
            background = Glass.key,
            onLongPress = actions::onSpaceLongPress,
            onTap = actions::onSpace,
        ) {
            Text(state.languageLabel, color = Glass.text, fontSize = 17.sp)
        }
        s.getOrNull(2)?.let { CharTap(it, actions) }
        s.getOrNull(3)?.let { CharTap(it, actions) }
        CharTap(".", actions)
        TapKey(Modifier.weight(1.6f), background = Glass.accent, onTap = actions::onEnter) {
            Icon(Icons.AutoMirrored.Outlined.KeyboardReturn, "Enter", tint = Glass.onAccent)
        }
    }
}

@Composable
private fun RowScope.CharTap(symbol: String, actions: KeyboardActions) {
    TapKey(Modifier.weight(1f), background = Glass.key, onTap = { actions.onText(symbol) }) {
        Text(symbol, color = Glass.text, fontSize = 20.sp)
    }
}
