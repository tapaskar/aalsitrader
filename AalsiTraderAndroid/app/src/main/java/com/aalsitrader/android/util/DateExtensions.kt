package com.aalsitrader.android.util

import com.aalsitrader.android.model.ActivityTimestamp
import java.time.*
import java.time.format.DateTimeFormatter
import java.util.Locale

private val IST = ZoneId.of("Asia/Kolkata")
private val timeFormatter = DateTimeFormatter.ofPattern("HH:mm", Locale.US)
private val dateTimeFormatter = DateTimeFormatter.ofPattern("dd MMM yyyy, HH:mm", Locale.US)
private val dateShortFormatter = DateTimeFormatter.ofPattern("dd MMM", Locale.US)

fun Long.toIstTime(): String {
    val zdt = Instant.ofEpochMilli(this).atZone(IST)
    return timeFormatter.format(zdt)
}

fun Long.toIstDateTime(): String {
    val zdt = Instant.ofEpochMilli(this).atZone(IST)
    return dateTimeFormatter.format(zdt)
}

fun Long.toIstDateShort(): String {
    val zdt = Instant.ofEpochMilli(this).atZone(IST)
    return dateShortFormatter.format(zdt)
}

fun Long.timeAgo(): String {
    val now = System.currentTimeMillis()
    val diff = now - this
    val seconds = diff / 1000
    val minutes = seconds / 60
    val hours = minutes / 60
    val days = hours / 24

    return when {
        seconds < 60 -> "just now"
        minutes < 60 -> "${minutes}m ago"
        hours < 24 -> "${hours}h ago"
        days < 7 -> "${days}d ago"
        days < 30 -> "${days / 7}w ago"
        else -> "${days / 30}mo ago"
    }
}

fun ActivityTimestamp.timeAgo(): String = asEpochMillis.timeAgo()
fun ActivityTimestamp.toIstTime(): String = asEpochMillis.toIstTime()
fun ActivityTimestamp.toIstDateTime(): String = asEpochMillis.toIstDateTime()
