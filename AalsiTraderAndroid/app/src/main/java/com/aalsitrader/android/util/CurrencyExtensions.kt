package com.aalsitrader.android.util

import java.text.DecimalFormat
import kotlin.math.abs

private val indianFormat = DecimalFormat("#,##,##0.00").apply {
    isGroupingUsed = true
    groupingSize = 3
}

fun Double.inrFormatted(): String {
    val abs = abs(this)
    val formatted = formatIndian(abs)
    return if (this < 0) "-\u20B9$formatted" else "\u20B9$formatted"
}

fun Double.inrShort(): String {
    val abs = abs(this)
    val str = when {
        abs >= 1_00_00_000 -> String.format("%.1fCr", abs / 1_00_00_000)
        abs >= 1_00_000 -> String.format("%.1fL", abs / 1_00_000)
        abs >= 1_000 -> String.format("%.1fK", abs / 1_000)
        else -> String.format("%.0f", abs)
    }
    return if (this < 0) "-\u20B9$str" else "\u20B9$str"
}

fun Double.pctFormatted(): String = String.format("%.2f%%", this)

private fun formatIndian(value: Double): String {
    val intPart = value.toLong()
    val decPart = String.format(".%02d", ((value - intPart) * 100).toLong())

    if (intPart < 1000) return "$intPart$decPart"

    val str = intPart.toString()
    val lastThree = str.takeLast(3)
    val remaining = str.dropLast(3)
    val grouped = remaining.reversed().chunked(2).joinToString(",").reversed()
    return "$grouped,$lastThree$decPart"
}
