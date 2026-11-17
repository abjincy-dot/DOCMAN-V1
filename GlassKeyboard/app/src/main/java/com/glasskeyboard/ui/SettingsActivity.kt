package com.glasskeyboard.ui

import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.view.inputmethod.InputMethodManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.compositeOver
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.glasskeyboard.data.SymbolKeysStore
import com.glasskeyboard.data.SymbolSlots
import com.glasskeyboard.data.ThemeStore
import com.glasskeyboard.data.TypingStore
import com.glasskeyboard.ime.KeyStyle
import com.glasskeyboard.ime.KeyboardHeight
import com.glasskeyboard.ime.KeyVibrator
import com.glasskeyboard.ime.VibrationLevel
import com.glasskeyboard.ime.KeyboardTheme
import com.glasskeyboard.ime.Themes
import com.glasskeyboard.ime.glassBackground
import com.glasskeyboard.ime.Glass
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

/** Launcher screen: enable the keyboard, edit the symbol keys, and try it out. */
class SettingsActivity : ComponentActivity() {

    private var enabled by mutableStateOf(false)
    private var selected by mutableStateOf(false)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val store = SymbolKeysStore(applicationContext)
        val themeStore = ThemeStore(applicationContext)
        val typingStore = TypingStore(applicationContext)
        setContent {
            MaterialTheme(colorScheme = darkColorScheme(primary = Glass.accent, background = Glass.outer)) {
                SettingsScreen(
                    enabled = enabled,
                    selected = selected,
                    store = store,
                    themeStore = themeStore,
                    typingStore = typingStore,
                    onEnable = { startActivity(Intent(Settings.ACTION_INPUT_METHOD_SETTINGS)) },
                    onSelect = { getSystemService(InputMethodManager::class.java).showInputMethodPicker() },
                )
            }
        }
    }

    override fun onResume() {
        super.onResume()
        refreshStatus()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        // The input-method picker is a dialog, so we only notice the choice when focus returns.
        if (hasFocus) refreshStatus()
    }

    private fun refreshStatus() {
        val imm = getSystemService(InputMethodManager::class.java)
        enabled = imm.enabledInputMethodList.any { it.packageName == packageName }
        val current = Settings.Secure.getString(contentResolver, Settings.Secure.DEFAULT_INPUT_METHOD).orEmpty()
        selected = current.startsWith("$packageName/")
    }
}

@Composable
private fun SettingsScreen(
    enabled: Boolean,
    selected: Boolean,
    store: SymbolKeysStore,
    themeStore: ThemeStore,
    typingStore: TypingStore,
    onEnable: () -> Unit,
    onSelect: () -> Unit,
) {
    val slots by store.slots.collectAsState(initial = SymbolSlots.DEFAULT)
    val themeId by themeStore.themeId.collectAsState(initial = null)
    val styleId by themeStore.keyStyle.collectAsState(initial = null)
    val style = KeyStyle.byId(styleId)
    val scope = rememberCoroutineScope()
    var editing by remember { mutableStateOf<Int?>(null) }
    var testText by remember { mutableStateOf("") }

    Column(
        Modifier
            .fillMaxSize()
            .background(Glass.outer)
            .safeDrawingPadding()
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text("Glass Keyboard", color = Color.White, fontSize = 28.sp, fontWeight = FontWeight.Bold)

        StepCard(1, "Enable Glass Keyboard", "Turn it on in your phone's keyboard settings.", enabled, "Open settings", onEnable)
        StepCard(2, "Switch to Glass Keyboard", "Pick it as your current keyboard.", selected, "Choose keyboard", onSelect)

        SectionHeader("▢", "KEY STYLE")
        KeyStylePicker(selected = style, theme = Themes.byId(themeId)) { picked ->
            scope.launch { themeStore.setKeyStyle(picked.id) }
        }

        SectionHeader("◐", "THEMES")
        ThemePicker(selected = Themes.byId(themeId), style = style) { theme ->
            scope.launch { themeStore.setTheme(theme.id) }
        }

        SectionHeader("≋", "TYPING")
        val vibration by typingStore.vibration.collectAsState(initial = true)
        val levelId by typingStore.vibrationLevel.collectAsState(initial = null)
        val learning by typingStore.learning.collectAsState(initial = true)
        val context = androidx.compose.ui.platform.LocalContext.current
        val keyVibrator = remember { KeyVibrator(context) }
        TypingSettings(
            vibration = vibration,
            level = VibrationLevel.byId(levelId),
            learning = learning,
            onVibration = { scope.launch { typingStore.setVibration(it) } },
            onLevel = { picked ->
                keyVibrator.tick(picked) // let the user feel the new strength
                scope.launch { typingStore.setVibrationLevel(picked.id) }
            },
            onLearning = { scope.launch { typingStore.setLearning(it) } },
            onClearLearned = { scope.launch { typingStore.clearLearned() } },
        )

        SectionHeader("↕", "KEYBOARD HEIGHT")
        val savedHeight by typingStore.keyboardHeight.collectAsState(initial = KeyboardHeight.DEFAULT)
        KeyboardHeightSetting(savedHeight) { scope.launch { typingStore.setKeyboardHeight(it) } }

        SectionHeader("@", "SYMBOL KEYS")
        Text(
            "Tap a slot to add or change a key next to the space bar.",
            color = Glass.hint,
            fontSize = 14.sp,
        )
        SymbolSlotEditor(slots) { editing = it }

        SectionHeader("✎", "TRY IT")
        OutlinedTextField(
            value = testText,
            onValueChange = { testText = it },
            modifier = Modifier.fillMaxWidth(),
            placeholder = { Text("Type something here…") },
            minLines = 3,
        )
    }

    editing?.let { index ->
        SymbolPicker(
            current = slots.slots[index],
            onPick = { value ->
                scope.launch { store.setSlot(index, value) }
                editing = null
            },
            onDismiss = { editing = null },
        )
    }
}

@Composable
private fun StepCard(
    number: Int,
    title: String,
    body: String,
    done: Boolean,
    action: String,
    onClick: () -> Unit,
) {
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(Color.White.copy(alpha = 0.06f))
            .border(1.dp, Glass.border, RoundedCornerShape(18.dp))
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier
                .size(32.dp)
                .clip(CircleShape)
                .background(if (done) Color(0xFF2E9E6B) else Glass.accent),
            contentAlignment = Alignment.Center,
        ) {
            Text(if (done) "✓" else "$number", color = Color.White, fontWeight = FontWeight.Bold)
        }
        Column(Modifier.weight(1f).padding(horizontal = 12.dp)) {
            Text(title, color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
            Text(body, color = Glass.hint, fontSize = 13.sp)
        }
        if (!done) {
            Button(onClick = onClick, colors = ButtonDefaults.buttonColors(containerColor = Glass.accent)) {
                Text(action)
            }
        }
    }
}

@Composable
private fun SectionHeader(icon: String, title: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(
            Modifier
                .size(30.dp)
                .clip(CircleShape)
                .background(Glass.accent.copy(alpha = 0.3f)),
            contentAlignment = Alignment.Center,
        ) { Text(icon, color = Glass.accentIcon, fontSize = 15.sp) }
        Spacer(Modifier.size(10.dp))
        Text(title, color = Color.White.copy(alpha = 0.75f), fontSize = 16.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.5.sp)
    }
}

/** Preview of the bottom row: , [slot] [slot] space [slot] [slot] . */
@Composable
private fun SymbolSlotEditor(slots: SymbolSlots, onEdit: (Int) -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(32.dp))
            .background(Color.White.copy(alpha = 0.05f))
            .border(1.dp, Glass.border, RoundedCornerShape(32.dp))
            .padding(horizontal = 10.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Slot(slots.slots[0]) { onEdit(0) }
        Slot(slots.slots[1]) { onEdit(1) }
        Box(
            Modifier
                .weight(3f)
                .height(52.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(Color.White.copy(alpha = 0.08f)),
            contentAlignment = Alignment.Center,
        ) { Text("space", color = Glass.hint) }
        Slot(slots.slots[2]) { onEdit(2) }
        Slot(slots.slots[3]) { onEdit(3) }
        FixedKey(".")
    }
}

@Composable
private fun RowScope.FixedKey(label: String) {
    Box(
        Modifier
            .weight(1f)
            .height(52.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(Color.White.copy(alpha = 0.08f)),
        contentAlignment = Alignment.Center,
    ) { Text(label, color = Glass.hint, fontSize = 18.sp) }
}

@Composable
private fun RowScope.Slot(value: String?, onClick: () -> Unit) {
    val shape = RoundedCornerShape(12.dp)
    Box(
        Modifier
            .weight(1f)
            .height(52.dp)
            .clip(shape)
            .then(
                if (value != null) Modifier.background(Glass.accent)
                else Modifier.drawBehind {
                    drawRoundRect(
                        color = Color.White.copy(alpha = 0.35f),
                        cornerRadius = CornerRadius(12.dp.toPx()),
                        style = Stroke(
                            width = 1.5.dp.toPx(),
                            pathEffect = PathEffect.dashPathEffect(floatArrayOf(8f, 8f)),
                        ),
                    )
                }
            )
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(value ?: "+", color = if (value != null) Color.White else Glass.hint, fontSize = 20.sp, fontWeight = FontWeight.SemiBold)
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun SymbolPicker(current: String?, onPick: (String?) -> Unit, onDismiss: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Choose a symbol") },
        text = {
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                SymbolSlots.CHOICES.forEach { symbol ->
                    Box(
                        Modifier
                            .size(48.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(if (symbol == current) Glass.accent else Color.White.copy(alpha = 0.1f))
                            .clickable { onPick(symbol) },
                        contentAlignment = Alignment.Center,
                    ) { Text(symbol, color = Color.White, fontSize = 18.sp) }
                }
            }
        },
        confirmButton = {
            if (current != null) TextButton(onClick = { onPick(null) }) { Text("Remove") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}

/** Highlight colour for a selected card: the theme accent, unless it is too dark to see here. */
private fun KeyboardTheme.highlight() = if (accent.luminance() < 0.15f) Color.White else accent
private fun KeyboardTheme.onHighlight() = if (accent.luminance() < 0.15f) Color.Black else onAccent

/** Glass vs 3D, each shown as a few keys in the current theme. */
@Composable
private fun KeyStylePicker(selected: KeyStyle, theme: KeyboardTheme, onSelect: (KeyStyle) -> Unit) {
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        KeyStyle.entries.forEach { style ->
            val isSelected = style == selected
            val shape = RoundedCornerShape(18.dp)
            Column(
                Modifier
                    .weight(1f)
                    .clip(shape)
                    .background(Color.White.copy(alpha = 0.05f))
                    .border(if (isSelected) 2.5.dp else 1.dp, if (isSelected) theme.highlight() else Glass.border, shape)
                    .clickable { onSelect(style) }
                    .padding(8.dp),
            ) {
                Row(
                    Modifier
                        .fillMaxWidth()
                        .height(56.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .glassBackground(theme)
                        .padding(horizontal = 6.dp, vertical = 10.dp),
                    horizontalArrangement = Arrangement.spacedBy(5.dp),
                ) {
                    MiniKey(theme, style, theme.letter, Modifier.weight(1f))
                    MiniKey(theme, style, theme.letter, Modifier.weight(1f))
                    MiniKey(theme, style, theme.mod, Modifier.weight(1f))
                    MiniKey(theme, style, theme.enter, Modifier.weight(1.4f))
                }
                CardLabel(style.label, isSelected, theme)
            }
        }
    }
}

@Composable
private fun CardLabel(text: String, selected: Boolean, theme: KeyboardTheme) {
    Row(
        Modifier.fillMaxWidth().padding(start = 4.dp, top = 8.dp, end = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text,
            color = Color.White,
            fontSize = 15.sp,
            fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
            modifier = Modifier.weight(1f),
        )
        if (selected) {
            Box(
                Modifier.size(20.dp).clip(CircleShape).background(theme.highlight()),
                contentAlignment = Alignment.Center,
            ) { Text("✓", color = theme.onHighlight(), fontSize = 12.sp, fontWeight = FontWeight.Bold) }
        }
    }
}

/** Two-column grid of theme cards. */
@Composable
internal fun ThemePicker(
    selected: KeyboardTheme,
    style: KeyStyle = KeyStyle.DEFAULT,
    onSelect: (KeyboardTheme) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Themes.all.chunked(2).forEach { pair ->
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                pair.forEach { theme ->
                    ThemeCard(theme, style, theme.id == selected.id, Modifier.weight(1f)) { onSelect(theme) }
                }
                if (pair.size == 1) Spacer(Modifier.weight(1f))
            }
        }
    }
}

/** A miniature keyboard drawn in the theme's colours, with its name underneath. */
@Composable
private fun ThemeCard(
    theme: KeyboardTheme,
    style: KeyStyle,
    selected: Boolean,
    modifier: Modifier,
    onClick: () -> Unit,
) {
    val shape = RoundedCornerShape(18.dp)
    Column(
        modifier
            .clip(shape)
            .background(Color.White.copy(alpha = 0.05f))
            .border(if (selected) 2.5.dp else 1.dp, if (selected) theme.highlight() else Glass.border, shape)
            .clickable(onClick = onClick)
            .padding(8.dp),
    ) {
        Column(
            Modifier
                .fillMaxWidth()
                .height(104.dp)
                .clip(RoundedCornerShape(12.dp))
                .glassBackground(theme)
                .padding(6.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            MiniRow {
                repeat(10) { MiniKey(theme, style, theme.letter, Modifier.weight(1f)) }
            }
            MiniRow {
                Spacer(Modifier.weight(0.5f))
                repeat(9) { MiniKey(theme, style, theme.letter, Modifier.weight(1f)) }
                Spacer(Modifier.weight(0.5f))
            }
            MiniRow {
                MiniKey(theme, style, theme.mod, Modifier.weight(1.5f))
                repeat(7) { MiniKey(theme, style, theme.letter, Modifier.weight(1f)) }
                MiniKey(theme, style, theme.mod, Modifier.weight(1.5f))
            }
            MiniRow {
                MiniKey(theme, style, theme.func, Modifier.weight(1.4f))
                MiniKey(theme, style, theme.space, Modifier.weight(5f))
                MiniKey(theme, style, theme.enter, Modifier.weight(1.6f))
            }
        }
        CardLabel(theme.name, selected, theme)
    }
}

@Composable
private fun ColumnScope.MiniRow(content: @Composable RowScope.() -> Unit) {
    Row(Modifier.weight(1f).fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(3.dp), content = content)
}

/** One tiny key: flat glass, or a rounded 3D key with a darker lip underneath. */
@Composable
private fun MiniKey(theme: KeyboardTheme, style: KeyStyle, color: Color, modifier: Modifier) {
    when (style) {
        KeyStyle.GLASS -> Box(
            modifier
                .fillMaxSize()
                .clip(RoundedCornerShape(4.dp))
                .background(color)
                .border(0.5.dp, theme.border, RoundedCornerShape(4.dp)),
        )
        KeyStyle.PEBBLE -> if (theme.smooth) {
            Box(
                modifier
                    .fillMaxSize()
                    .padding(bottom = 1.dp)
                    .clip(RoundedCornerShape(percent = 50))
                    .background(color.compositeOver(theme.base))
                    .border(0.5.dp, Color.Black.copy(alpha = 0.10f), RoundedCornerShape(percent = 50)),
            )
        } else {
            val solid = color.compositeOver(theme.base)
            val shape = RoundedCornerShape(percent = 40)
            Box(
                modifier
                    .fillMaxSize()
                    .clip(shape)
                    .background(lerp(solid, Color.Black, if (solid.luminance() > 0.7f) 0.16f else 0.38f))
                    .padding(bottom = 1.5.dp)
                    .clip(shape)
                    .background(Brush.verticalGradient(listOf(lerp(solid, Color.White, 0.18f), solid))),
            )
        }
    }
}

/** Vibration and word-learning switches. */
@Composable
internal fun TypingSettings(
    vibration: Boolean,
    level: VibrationLevel,
    learning: Boolean,
    onVibration: (Boolean) -> Unit,
    onLevel: (VibrationLevel) -> Unit,
    onLearning: (Boolean) -> Unit,
    onClearLearned: () -> Unit,
) {
    var cleared by remember { mutableStateOf(false) }
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(Color.White.copy(alpha = 0.06f))
            .border(1.dp, Glass.border, RoundedCornerShape(18.dp))
            .padding(horizontal = 16.dp, vertical = 6.dp),
    ) {
        SwitchRow("Smooth vibration", "A soft tick each time you press a key.", vibration, onVibration)
        if (vibration) {
            Text("Strength", color = Glass.hint, fontSize = 13.sp)
            Row(
                Modifier.fillMaxWidth().padding(top = 8.dp, bottom = 14.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                VibrationLevel.entries.forEach { l ->
                    val selected = l == level
                    Box(
                        Modifier
                            .weight(1f)
                            .height(40.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(if (selected) Glass.accent else Color.White.copy(alpha = 0.08f))
                            .clickable { onLevel(l) },
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            l.label,
                            color = Color.White,
                            fontSize = 14.sp,
                            fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal,
                        )
                    }
                }
            }
        }
        Box(Modifier.fillMaxWidth().height(1.dp).background(Glass.border))
        SwitchRow(
            "Learn my words",
            "Remembers words you type so predictions get better. Stays on this phone; never in password fields.",
            learning,
            onLearning,
        )
        TextButton(
            onClick = {
                onClearLearned()
                cleared = true
            },
            enabled = !cleared,
        ) { Text(if (cleared) "Learned words cleared" else "Clear learned words") }
    }
}

@Composable
private fun SwitchRow(title: String, body: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .clickable { onChange(!checked) }
            .padding(vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f).padding(end = 12.dp)) {
            Text(title, color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
            Text(body, color = Glass.hint, fontSize = 13.sp)
        }
        Switch(
            checked = checked,
            onCheckedChange = onChange,
            colors = SwitchDefaults.colors(checkedTrackColor = Glass.accent),
        )
    }
}

/** Slider for the keyboard height (75% to 115% of normal), saved when the finger lifts. */
@Composable
internal fun KeyboardHeightSetting(saved: Float, onSave: (Float) -> Unit) {
    var value by remember(saved) { mutableStateOf(saved) }
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(Color.White.copy(alpha = 0.06f))
            .border(1.dp, Glass.border, RoundedCornerShape(18.dp))
            .padding(horizontal = 16.dp, vertical = 12.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("Height", color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
            Text("${(value * 100).roundToInt()}%", color = Glass.accentIcon, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
        }
        Slider(
            value = value,
            onValueChange = { value = it },
            onValueChangeFinished = { onSave(value) },
            valueRange = KeyboardHeight.MIN..KeyboardHeight.MAX,
            steps = KeyboardHeight.STEPS,
            colors = SliderDefaults.colors(thumbColor = Glass.accent, activeTrackColor = Glass.accent),
        )
        Row {
            Text("Shorter", color = Glass.hint, fontSize = 13.sp, modifier = Modifier.weight(1f))
            if (value != KeyboardHeight.DEFAULT) {
                Text(
                    "Reset",
                    color = Glass.accentIcon,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.clickable {
                        value = KeyboardHeight.DEFAULT
                        onSave(KeyboardHeight.DEFAULT)
                    }.padding(horizontal = 12.dp),
                )
            }
            Text("Taller", color = Glass.hint, fontSize = 13.sp)
        }
    }
}
