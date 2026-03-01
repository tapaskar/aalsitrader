package com.aalsitrader.android.network

import com.aalsitrader.android.model.ActivityTimestamp
import kotlinx.serialization.KSerializer
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.descriptors.buildClassSerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.json.*

typealias ActivityTimestampSerializer = ActivityTimestampKSerializer

object ActivityTimestampKSerializer : KSerializer<ActivityTimestamp> {
    override val descriptor: SerialDescriptor =
        buildClassSerialDescriptor("ActivityTimestamp")

    override fun deserialize(decoder: Decoder): ActivityTimestamp {
        val element = (decoder as JsonDecoder).decodeJsonElement()
        return when (element) {
            is JsonPrimitive -> {
                val content = element.content
                element.doubleOrNull?.let { ActivityTimestamp.Epoch(it) }
                    ?: element.longOrNull?.let { ActivityTimestamp.Epoch(it.toDouble()) }
                    ?: ActivityTimestamp.IsoString(content)
            }
            else -> ActivityTimestamp.Epoch(0.0)
        }
    }

    override fun serialize(encoder: Encoder, value: ActivityTimestamp) {
        val jsonEncoder = encoder as JsonEncoder
        when (value) {
            is ActivityTimestamp.Epoch -> jsonEncoder.encodeDouble(value.value)
            is ActivityTimestamp.IsoString -> jsonEncoder.encodeString(value.value)
        }
    }
}
