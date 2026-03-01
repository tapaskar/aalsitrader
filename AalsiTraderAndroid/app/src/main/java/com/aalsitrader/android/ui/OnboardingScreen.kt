package com.aalsitrader.android.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.ExperimentalFoundationApi
import com.aalsitrader.android.ui.theme.*
import kotlinx.coroutines.launch

private data class OnboardingPage(
    val title: String,
    val description: String,
    val emoji: String,
)

private val pages = listOf(
    OnboardingPage("AI-Powered Trading", "6 specialized AI agents work together to analyze markets, manage risk, and execute trades.", ""),
    OnboardingPage("Smart Money Screener", "Real-time stock screening using institutional flow analysis and technical indicators.", ""),
    OnboardingPage("Paper Trading", "Practice with virtual capital before going live. Track performance with detailed metrics.", ""),
    OnboardingPage("Options Straddle", "Automated Nifty/BankNifty options strategies with real-time position tracking.", ""),
)

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun OnboardingScreen(
    onComplete: () -> Unit,
) {
    val pagerState = rememberPagerState(pageCount = { pages.size })
    val scope = rememberCoroutineScope()

    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        HorizontalPager(
            state = pagerState,
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth(),
        ) { page ->
            val p = pages[page]
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(32.dp),
                verticalArrangement = Arrangement.Center,
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(
                    text = p.title,
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Bold,
                    color = TextPrimary,
                    textAlign = TextAlign.Center,
                )
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    text = p.description,
                    style = MaterialTheme.typography.bodyLarge,
                    color = TextSecondary,
                    textAlign = TextAlign.Center,
                )
            }
        }

        // Dots
        Row(
            modifier = Modifier.padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            repeat(pages.size) { index ->
                Box(
                    modifier = Modifier
                        .size(if (index == pagerState.currentPage) 12.dp else 8.dp)
                        .clip(CircleShape)
                        .then(
                            if (index == pagerState.currentPage) {
                                Modifier.let { it }
                            } else {
                                Modifier
                            }
                        ),
                ) {
                    Surface(
                        modifier = Modifier.fillMaxSize(),
                        color = if (index == pagerState.currentPage) AccentCyan else TextMuted,
                        shape = CircleShape,
                    ) {}
                }
            }
        }

        // Button
        Button(
            onClick = {
                if (pagerState.currentPage < pages.size - 1) {
                    scope.launch { pagerState.animateScrollToPage(pagerState.currentPage + 1) }
                } else {
                    onComplete()
                }
            },
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 32.dp, vertical = 16.dp)
                .height(50.dp),
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(containerColor = AccentCyan, contentColor = AppBackground),
        ) {
            Text(
                text = if (pagerState.currentPage < pages.size - 1) "Next" else "Get Started",
                fontWeight = FontWeight.SemiBold,
            )
        }

        Spacer(modifier = Modifier.height(32.dp))
    }
}
