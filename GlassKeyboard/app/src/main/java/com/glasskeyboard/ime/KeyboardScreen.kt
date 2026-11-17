package com.glasskeyboard.ime

import androidx.compose.foundation.Canvas
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
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.zIndex
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.rememberLazyGridState
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.compositeOver
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.graphics.luminance
import kotlinx.coroutines.launch
import com.glasskeyboard.data.SymbolSlots
import kotlin.math.floor
import kotlin.math.roundToInt

private val KeyShape = RoundedCornerShape(12.dp)
/** Keyboard height setting: 1.0 = normal. Rows and the top bar scale with it. */
private val LocalHeightScale = staticCompositionLocalOf { 1f }
private val RowHeight: Dp @Composable get() = 54.dp * LocalHeightScale.current
private val PopupCell = 42.dp
private val PebbleShape = RoundedCornerShape(percent = 40)

/** Which colour set a key uses (see [KeyboardTheme]). */
private enum class KeyRole { LETTER, MOD, FUNC, SPACE, ENTER }

private val LocalKeyStyle = staticCompositionLocalOf { KeyStyle.DEFAULT }

/** Called on every key press (and long-press step) so the service can vibrate if enabled. */
private val LocalKeyFeedback = staticCompositionLocalOf<() -> Unit> { {} }

/** Background glows are drawn at this fraction of their theme strength, for a softer look. */
private const val GlowSoftness = 0.6f

/** Text / icon colour for the key currently being drawn. */
private val LocalKeyText = compositionLocalOf { Color.White }
private val KeyText: Color @Composable get() = LocalKeyText.current

private fun Color.darken(f: Float) = lerp(this, Color.Black, f)
private fun Color.lighten(f: Float) = lerp(this, Color.White, f)

/** Base colour plus the theme's soft coloured glows behind the keys. */
internal fun Modifier.glassBackground(theme: KeyboardTheme) = drawBehind {
    drawRect(theme.base)
    theme.glows.forEach { g ->
        drawRect(
            Brush.radialGradient(
                listOf(g.color.copy(alpha = g.alpha * GlowSoftness), Color.Transparent),
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
    style: KeyStyle = KeyStyle.DEFAULT,
    heightScale: Float = 1f,
) = CompositionLocalProvider(
    LocalHeightScale provides heightScale.coerceIn(KeyboardHeight.MIN, KeyboardHeight.MAX),
    LocalKeyboardTheme provides theme,
    LocalKeyStyle provides style,
    LocalKeyFeedback provides actions::onKeyDown,
) {
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
                Page.EMOJI -> EmojiPanel(state, actions)
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
            .height(maxOf(36.dp, 46.dp * LocalHeightScale.current)),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        DotsMenuButton(actions::onOpenSettings)
        Row(Modifier.weight(1f).fillMaxHeight(), verticalAlignment = Alignment.CenterVertically) {
            val words = state.suggestions
            if (state.suggestionsEnabled) {
                for (i in 0 until 3) {
                    if (i > 0) Box(Modifier.width(1.dp).height(24.dp).background(Glass.barText.copy(alpha = 0.3f)))
                    val word = words.getOrNull(i)
                    Box(
                        Modifier
                            .weight(1f)
                            .fillMaxHeight()
                            .then(if (word != null) Modifier.clickable { actions.onSuggestion(word) } else Modifier),
                        contentAlignment = Alignment.Center,
                    ) {
                        if (word != null) {
                            Text(
                                word,
                                color = Glass.barText,
                                fontSize = 18.sp,
                                fontWeight = if (i == 1) FontWeight.SemiBold else FontWeight.Normal,
                                maxLines = 1,
                            )
                        }
                    }
                }
            }
        }
        BarIcon(Icons.Outlined.KeyboardHide, "Hide keyboard", actions::onHide)
    }
}

/** Menu button drawn as a small grid of dots (3 rows x 6 columns). Opens settings. */
@Composable
private fun DotsMenuButton(onClick: () -> Unit) {
    val color = Glass.accentIcon
    Box(
        Modifier
            .size(width = 56.dp, height = 46.dp)
            .clip(RoundedCornerShape(10.dp))
            .clickable(onClickLabel = "Settings", onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Canvas(Modifier.size(width = 34.dp, height = 16.dp)) {
            val cols = 6
            val rows = 3
            val r = 1.5.dp.toPx()
            val dx = (size.width - 2 * r) / (cols - 1)
            val dy = (size.height - 2 * r) / (rows - 1)
            for (row in 0 until rows) for (col in 0 until cols) {
                drawCircle(color, radius = r, center = Offset(r + col * dx, r + row * dy))
            }
        }
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
        KeyType.SHIFT -> TapKey(mod, role = KeyRole.MOD, active = state.shift != ShiftState.OFF, onTap = actions::onShift) {
            Text(
                if (state.shift == ShiftState.LOCKED) "⇪" else "⇧",
                color = KeyText,
                fontSize = 24.sp,
                fontWeight = if (state.shift == ShiftState.OFF) FontWeight.Normal else FontWeight.Bold,
            )
        }
        KeyType.BACKSPACE -> RepeatKey(mod, onRepeat = actions::onBackspace) {
            Icon(Icons.AutoMirrored.Outlined.Backspace, "Delete", tint = KeyText)
        }
        KeyType.SPACER -> Spacer(mod)
        else -> Spacer(mod)
    }
}

/** Draws one key in the current [KeyStyle], coloured by its [role]. [active] = shift is on. */
@Composable
private fun KeySurface(
    modifier: Modifier,
    pressed: Boolean,
    role: KeyRole = KeyRole.LETTER,
    active: Boolean = false,
    content: @Composable () -> Unit,
) {
    val t = Glass
    val (face, text) = when (role) {
        KeyRole.LETTER -> t.letter to t.letterText
        KeyRole.MOD -> t.mod to t.modText
        KeyRole.FUNC -> t.func to t.funcText
        KeyRole.SPACE -> t.space to t.spaceText
        KeyRole.ENTER -> t.enter to t.enterText
    }
    CompositionLocalProvider(LocalKeyText provides text) {
        when (LocalKeyStyle.current) {
            KeyStyle.GLASS -> Box(
                modifier
                    .fillMaxHeight()
                    .padding(horizontal = 3.dp, vertical = 4.dp)
                    .clip(KeyShape)
                    .background(if (pressed || active) t.pressed.compositeOver(face) else face)
                    .border(1.dp, t.border, KeyShape),
                contentAlignment = Alignment.Center,
            ) { content() }

            KeyStyle.PEBBLE -> if (t.smooth) {
                SmoothKey(modifier, face.compositeOver(t.base), pressed, active, content)
            } else {
                // Raised rounded key: a darker "lip" underneath, a gradient face and a soft gloss on top.
                val solid = face.compositeOver(t.base)
                val top = when {
                    pressed -> solid.lighten(0.14f)
                    active -> solid.lighten(0.22f)
                    else -> solid
                }
                Box(
                    modifier
                        .fillMaxHeight()
                        .padding(horizontal = 2.5.dp, vertical = 3.dp)
                ) {
                    Box(
                        Modifier
                            .matchParentSize()
                            .offset(y = 1.5.dp)
                            .clip(PebbleShape)
                            .background(Color.Black.copy(alpha = if (solid.luminance() > 0.7f) 0.12f else 0.22f))
                    )
                    // Light keys get a softer edge so they don't look outlined.
                    val lip = solid.darken(if (solid.luminance() > 0.7f) 0.16f else 0.38f)
                    Box(Modifier.matchParentSize().clip(PebbleShape).background(lip))
                    Box(
                        Modifier
                            .matchParentSize()
                            .padding(top = if (pressed) 3.dp else 0.dp, bottom = if (pressed) 1.dp else 4.dp)
                            .clip(PebbleShape)
                            .background(Brush.verticalGradient(listOf(top.lighten(0.10f), top, top.darken(0.06f))))
                            .drawBehind {
                                drawRoundRect(
                                    brush = Brush.verticalGradient(
                                        listOf(Color.White.copy(alpha = 0.26f), Color.White.copy(alpha = 0f)),
                                        startY = 0f,
                                        endY = size.height * 0.55f,
                                    ),
                                    topLeft = Offset(size.width * 0.08f, size.height * 0.04f),
                                    size = Size(size.width * 0.84f, size.height * 0.5f),
                                    cornerRadius = CornerRadius(size.height * 0.25f),
                                )
                            },
                        contentAlignment = Alignment.Center,
                    ) { content() }
                }
            }
        }
    }
}

private val SmoothShape = RoundedCornerShape(percent = 50)

/**
 * Smooth raised key (themes with `smooth = true`): a domed matte top sitting on a light grey base,
 * with only a faint shadow. No shine band and no dark edge.
 */
@Composable
private fun SmoothKey(
    modifier: Modifier,
    solid: Color,
    pressed: Boolean,
    active: Boolean,
    content: @Composable () -> Unit,
) {
    val top = when {
        pressed -> solid.darken(0.05f)
        active -> lerp(solid, Color(0xFF5B8DEF), 0.18f)
        else -> solid
    }
    // How far the top sits above its base; pressing pushes it down.
    val lift = if (pressed) 1.5.dp else 4.5.dp
    Box(
        modifier
            .fillMaxHeight()
            .padding(horizontal = 1.5.dp, vertical = 2.5.dp)
    ) {
        // Faint soft shadow on the background.
        Box(
            Modifier
                .matchParentSize()
                .offset(y = 1.5.dp)
                .clip(SmoothShape)
                .background(Color.Black.copy(alpha = 0.06f))
        )
        // The key's side / base: light grey, slightly darker towards the bottom.
        Box(
            Modifier
                .matchParentSize()
                .clip(SmoothShape)
                .background(Brush.verticalGradient(listOf(solid.darken(0.10f), solid.darken(0.20f))))
        )
        // The domed top: brightest a little above the centre, gently shaded towards the edges.
        Box(
            Modifier
                .matchParentSize()
                .padding(top = 4.5.dp - lift, bottom = lift)
                .clip(SmoothShape)
                .drawBehind {
                    drawRect(
                        Brush.radialGradient(
                            listOf(top.lighten(0.35f), top, top.darken(0.07f)),
                            center = Offset(size.width / 2, size.height * 0.38f),
                            radius = maxOf(size.width, size.height) * 0.72f,
                        )
                    )
                }
                .border(0.6.dp, Color.Black.copy(alpha = 0.05f), SmoothShape),
            contentAlignment = Alignment.Center,
        ) { content() }
    }
}

/** Simple tap key with optional long-press. */
@Composable
private fun TapKey(
    modifier: Modifier,
    role: KeyRole = KeyRole.FUNC,
    active: Boolean = false,
    onLongPress: (() -> Unit)? = null,
    onTap: () -> Unit,
    content: @Composable () -> Unit,
) {
    var pressed by remember { mutableStateOf(false) }
    val feedback = LocalKeyFeedback.current
    val tap by rememberUpdatedState(onTap)
    val longPress by rememberUpdatedState(onLongPress)
    KeySurface(
        modifier.pointerInput(Unit) {
            detectTapGestures(
                onPress = {
                    pressed = true
                    feedback()
                    tryAwaitRelease()
                    pressed = false
                },
                onLongPress = if (onLongPress != null) { _ -> longPress?.invoke() } else null,
                onTap = { tap() },
            )
        },
        pressed = pressed,
        role = role,
        active = active,
        content = content,
    )
}

/** Fires once on press, then repeats while held (used for backspace). */
@Composable
private fun RepeatKey(modifier: Modifier, onRepeat: () -> Unit, content: @Composable () -> Unit) {
    var pressed by remember { mutableStateOf(false) }
    val feedback = LocalKeyFeedback.current
    val action by rememberUpdatedState(onRepeat)
    KeySurface(
        modifier.pointerInput(Unit) {
            awaitEachGesture {
                awaitFirstDown()
                pressed = true
                feedback()
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
        role = KeyRole.MOD,
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

    val feedback = LocalKeyFeedback.current
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
                    feedback()
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
                            feedback()
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
                                    feedback()
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
        KeySurface(Modifier.fillMaxWidth(), pressed = pressed, role = KeyRole.LETTER) {
            Text(label, color = KeyText, fontSize = 24.sp)
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

/** Full emoji picker: one scrolling grid with a category bar (and delete key) underneath. */
@Composable
private fun EmojiPanel(state: KeyboardState, actions: KeyboardActions) {
    val groups = remember(state.emojiGroups, state.recentEmoji) {
        buildList {
            if (state.recentEmoji.isNotEmpty()) {
                add(EmojiGroup(EmojiData.RECENT, EmojiData.iconFor(EmojiData.RECENT), state.recentEmoji))
            }
            addAll(state.emojiGroups)
        }
    }
    // Grid index where each group's header sits.
    val starts = remember(groups) {
        var i = 0
        groups.map { g -> i.also { i += 1 + g.emojis.size } }
    }
    val grid = rememberLazyGridState()
    val scope = rememberCoroutineScope()
    val current by remember(starts) {
        derivedStateOf { starts.indexOfLast { it <= grid.firstVisibleItemIndex }.coerceAtLeast(0) }
    }

    Column(Modifier.fillMaxWidth().height(RowHeight * 4)) {
        LazyVerticalGrid(
            columns = GridCells.Fixed(8),
            state = grid,
            modifier = Modifier.fillMaxWidth().weight(1f),
        ) {
            groups.forEach { g ->
                item(key = "header_${g.name}", span = { GridItemSpan(maxLineSpan) }) {
                    Text(
                        g.name,
                        color = Glass.barText.copy(alpha = 0.7f),
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(start = 8.dp, top = 8.dp, bottom = 4.dp),
                    )
                }
                items(g.emojis, key = { "${g.name}_$it" }) { e ->
                    Box(
                        Modifier
                            .height(44.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .clickable { actions.onEmoji(e) },
                        contentAlignment = Alignment.Center,
                    ) { Text(e, fontSize = 26.sp) }
                }
            }
        }
        Row(
            Modifier.fillMaxWidth().height(44.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            groups.forEachIndexed { i, g ->
                Box(
                    Modifier
                        .weight(1f)
                        .fillMaxHeight()
                        .padding(3.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(if (i == current) Glass.accent.copy(alpha = 0.35f) else Color.Transparent)
                        .clickable { scope.launch { grid.scrollToItem(starts[i]) } },
                    contentAlignment = Alignment.Center,
                ) { Text(g.icon, fontSize = 18.sp) }
            }
            RepeatKey(Modifier.weight(1.4f), onRepeat = actions::onBackspace) {
                Icon(Icons.AutoMirrored.Outlined.Backspace, "Delete", tint = KeyText)
            }
        }
    }
}

/** 123 · emoji · [symbol slots] · space · [symbol slots] · . · enter. Long-press "." for , ? ! and more. */
@Composable
private fun BottomRow(state: KeyboardState, slots: SymbolSlots, actions: KeyboardActions) {
    val s = slots.slots
    val filledSlots = s.count { it != null }
    Row(Modifier.fillMaxWidth().height(RowHeight)) {
        if (state.page == Page.LETTERS) {
            TapKey(Modifier.weight(1.9f), onTap = { actions.onPage(Page.SYMBOLS) }) {
                Text("123", color = KeyText, fontSize = 19.sp, fontWeight = FontWeight.Medium)
            }
        } else {
            TapKey(Modifier.weight(1.9f), onTap = { actions.onPage(Page.LETTERS) }) {
                Text("ABC", color = KeyText, fontSize = 19.sp, fontWeight = FontWeight.Medium)
            }
        }
        TapKey(
            Modifier.weight(1.1f),
            onTap = { actions.onPage(if (state.page == Page.EMOJI) Page.LETTERS else Page.EMOJI) },
        ) {
            Icon(Icons.Outlined.EmojiEmotions, "Emoji", tint = KeyText, modifier = Modifier.size(28.dp))
        }
        s.getOrNull(0)?.let { CharTap(it, actions) }
        s.getOrNull(1)?.let { CharTap(it, actions) }
        TapKey(
            Modifier.weight((4.1f - 0.6f * filledSlots).coerceAtLeast(2f)),
            role = KeyRole.SPACE,
            onLongPress = actions::onSpaceLongPress,
            onTap = actions::onSpace,
        ) {
            Text(state.languageLabel, color = KeyText, fontSize = 18.sp, fontWeight = FontWeight.Medium)
        }
        s.getOrNull(2)?.let { CharTap(it, actions) }
        s.getOrNull(3)?.let { CharTap(it, actions) }
        CharKey(
            label = ".",
            alternates = listOf(",", "?", "!", "'", "\"", ":", ";", "-"),
            onCommit = actions::onText,
            modifier = Modifier.weight(1.1f),
        )
        TapKey(Modifier.weight(1.8f), role = KeyRole.ENTER, onTap = actions::onEnter) {
            Icon(Icons.AutoMirrored.Outlined.KeyboardReturn, "Enter", tint = KeyText, modifier = Modifier.size(28.dp))
        }
    }
}

@Composable
private fun RowScope.CharTap(symbol: String, actions: KeyboardActions) {
    TapKey(Modifier.weight(1f), role = KeyRole.LETTER, onTap = { actions.onText(symbol) }) {
        Text(symbol, color = KeyText, fontSize = 20.sp)
    }
}
