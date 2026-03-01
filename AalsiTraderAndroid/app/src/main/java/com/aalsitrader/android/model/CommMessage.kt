package com.aalsitrader.android.model

import kotlinx.serialization.Serializable

@Serializable
data class CommMessage(
    val id: String,
    val from: String = "",
    val fromGreek: String = "",
    val fromColor: String = "",
    val to: String = "",
    val toGreek: String = "",
    val toColor: String = "",
    val content: String = "",
    val timestamp: ActivityTimestamp = ActivityTimestamp.Epoch(0.0),
)
