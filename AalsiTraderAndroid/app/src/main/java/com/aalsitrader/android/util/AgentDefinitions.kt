package com.aalsitrader.android.util

import androidx.compose.ui.graphics.Color
import com.aalsitrader.android.model.AgentStatus
import com.aalsitrader.android.ui.theme.*

data class AgentDefinition(
    val id: String,
    val name: String,
    val greek: String,
    val role: String,
    val color: Color,
    val defaultStatus: AgentStatus,
)

object AgentDefinitions {
    val all = listOf(
        AgentDefinition("alpha", "Professor", "\u03B1", "Research Agent", AlphaRed, AgentStatus.active),
        AgentDefinition("beta", "Techno-Kid", "\u03B2", "Technical Analyst", BetaTeal, AgentStatus.active),
        AgentDefinition("gamma", "Risko-Frisco", "\u03B3", "Risk Manager", GammaPurple, AgentStatus.active),
        AgentDefinition("sigma", "Prime", "\u03A3", "Trade Hunter", SigmaGreen, AgentStatus.active),
        AgentDefinition("theta", "Macro", "\u03B8", "Macro Watcher", ThetaOrange, AgentStatus.sleeping),
        AgentDefinition("delta", "Booky", "\u03B4", "Trade Journal", DeltaBlue, AgentStatus.sleeping),
    )

    fun colorForAgent(agentId: String): Color {
        return all.find { it.id == agentId }?.color ?: TextSecondary
    }

    fun colorForHex(hex: String): Color {
        return when (hex.lowercase()) {
            "#ff6b6b", "ff6b6b" -> AlphaRed
            "#4ecdc4", "4ecdc4" -> BetaTeal
            "#a855f7", "a855f7" -> GammaPurple
            "#10b981", "10b981" -> SigmaGreen
            "#f97316", "f97316" -> ThetaOrange
            "#3b82f6", "3b82f6" -> DeltaBlue
            else -> TextSecondary
        }
    }
}
