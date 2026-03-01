package com.aalsitrader.android.ui.admin

import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.aalsitrader.android.model.User
import com.aalsitrader.android.ui.components.EmptyState
import com.aalsitrader.android.ui.theme.TextPrimary
import com.aalsitrader.android.viewmodel.AdminViewModel

@Composable
fun UserList(
    users: List<User>,
    viewModel: AdminViewModel,
    modifier: Modifier = Modifier,
) {
    var selectedUser by remember { mutableStateOf<User?>(null) }

    Text(
        text = "Users (${users.size})",
        style = MaterialTheme.typography.titleMedium,
        fontWeight = FontWeight.SemiBold,
        color = TextPrimary,
    )

    if (users.isEmpty()) {
        EmptyState(title = "No users found")
        return
    }

    Column(
        modifier = modifier,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        users.forEach { user ->
            UserRow(
                user = user,
                onClick = { selectedUser = user },
            )
        }
    }

    selectedUser?.let { user ->
        UserDetailSheet(
            user = user,
            viewModel = viewModel,
            onDismiss = { selectedUser = null },
        )
    }
}
