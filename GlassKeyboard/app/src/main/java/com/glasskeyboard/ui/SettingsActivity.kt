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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.glasskeyboard.data.SymbolKeysStore
import com.glasskeyboard.data.SymbolSlots
import com.glasskeyboard.ime.Glass
import kotlinx.coroutines.launch

/** Launcher screen: enable the keyboard, edit the symbol keys, and try it out. */
class SettingsActivity : ComponentActivity() {

    private var enabled by mutableStateOf(false)
    private var selected by mutableStateOf(false)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val store = SymbolKeysStore(applicationContext)
        setContent {
            MaterialTheme(colorScheme = darkColorScheme(primary = Glass.accent, background = Glass.outer)) {
                SettingsScreen(
                    enabled = enabled,
                    selected = selected,
                    store = store,
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
    onEnable: () -> Unit,
    onSelect: () -> Unit,
) {
    val slots by store.slots.collectAsState(initial = SymbolSlots.DEFAULT)
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
        FixedKey(",")
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
