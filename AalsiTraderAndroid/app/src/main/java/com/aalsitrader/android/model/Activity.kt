package com.aalsitrader.android.model

import com.aalsitrader.android.network.ActivityTimestampKSerializer
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject

@Serializable
data class Activity(
    val id: String,
    val agentId: String = "",
    val agentName: String = "",
    val agentGreek: String = "",
    val agentColor: String = "",
    val type: ActivityType = ActivityType.info,
    val content: String = "",
    val timestamp: ActivityTimestamp = ActivityTimestamp.Epoch(0.0),
    val tags: List<String>? = null,
    val metadata: JsonObject? = null,
)

@Serializable
enum class ActivityType { info, alert, success, warning, error }

@Serializable(with = ActivityTimestampKSerializer::class)
sealed class ActivityTimestamp {
    @Serializable
    data class Epoch(val value: Double) : ActivityTimestamp()

    @Serializable
    data class IsoString(val value: String) : ActivityTimestamp()

    val asEpochMillis: Long
        get() = when (this) {
            is Epoch -> {
                // If value > 10 billion, it's already milliseconds; otherwise seconds
                if (value > 10_000_000_000) value.toLong() else (value * 1000).toLong()
            }
            is IsoString -> {
                try {
                    java.time.Instant.parse(value).toEpochMilli()
                } catch (_: Exception) {
                    try {
                        java.time.LocalDateTime.parse(value, java.time.format.DateTimeFormatter.ISO_LOCAL_DATE_TIME)
                            .atZone(java.time.ZoneId.of("Asia/Kolkata"))
                            .toInstant().toEpochMilli()
                    } catch (_: Exception) {
                        System.currentTimeMillis()
                    }
                }
            }
        }
}
