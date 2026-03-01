package com.aalsitrader.android.ui.dashboard

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.aalsitrader.android.model.Activity
import com.aalsitrader.android.ui.components.EmptyState

@Composable
fun ActivityFeed(
    activities: List<Activity>,
    modifier: Modifier = Modifier,
) {
    if (activities.isEmpty()) {
        EmptyState(title = "No activities yet", subtitle = "Activities will appear here as agents work")
        return
    }

    LazyColumn(
        modifier = modifier
            .fillMaxWidth()
            .heightIn(max = 400.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        items(activities.take(50), key = { it.id }) { activity ->
            ActivityRow(activity = activity)
        }
    }
}
