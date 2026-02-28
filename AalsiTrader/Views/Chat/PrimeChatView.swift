import SwiftUI

struct PrimeChatView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var viewModel = PrimeChatViewModel()
    @FocusState private var isInputFocused: Bool

    var body: some View {
        VStack(spacing: 0) {
            // MARK: - Header
            headerView

            Divider()
                .overlay(Color.appBorder.opacity(0.3))

            // MARK: - Quick Prompts
            quickPromptsRow

            // MARK: - Messages
            messagesScrollView

            // MARK: - Error Banner
            if let error = viewModel.error {
                errorBanner(error)
            }

            // MARK: - Input Bar
            inputBar
        }
        .background(Color.appBackground)
        .task {
            await viewModel.loadHistory()
        }
    }

    // MARK: - Header

    private var headerView: some View {
        HStack(spacing: 12) {
            // Prime avatar
            AgentAvatarView(agentId: "sigma", size: 36)

            VStack(alignment: .leading, spacing: 2) {
                Text("Chat with Prime")
                    .font(.headline)
                    .foregroundStyle(.white)

                Text("Sigma Orchestrator")
                    .font(.caption)
                    .foregroundStyle(Color.textSecondary)
            }

            Spacer()

            Button {
                HapticService.impact(.light)
                dismiss()
            } label: {
                Image(systemName: "xmark.circle.fill")
                    .font(.title2)
                    .foregroundStyle(Color.textSecondary)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(Color.cardBackground)
    }

    // MARK: - Quick Prompts

    private var quickPromptsRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(viewModel.quickPrompts, id: \.self) { prompt in
                    Button {
                        HapticService.selection()
                        Task {
                            await viewModel.sendQuickPrompt(prompt)
                        }
                    } label: {
                        Text(prompt)
                            .font(.caption.bold())
                            .foregroundStyle(Color.accentCyan)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(Color.accentCyan.opacity(0.1))
                            .clipShape(Capsule())
                            .overlay(
                                Capsule()
                                    .stroke(Color.accentCyan.opacity(0.3), lineWidth: 1)
                            )
                    }
                    .disabled(viewModel.isSending)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
        }
        .background(Color.cardBackground.opacity(0.5))
    }

    // MARK: - Messages

    private var messagesScrollView: some View {
        ScrollViewReader { proxy in
            ScrollView {
                if viewModel.isLoading {
                    VStack(spacing: 12) {
                        ProgressView()
                            .tint(Color.accentCyan)
                        Text("Loading chat history...")
                            .font(.caption)
                            .foregroundStyle(Color.textMuted)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.top, 40)
                } else if viewModel.messages.isEmpty {
                    emptyStateView
                } else {
                    LazyVStack(spacing: 4) {
                        ForEach(viewModel.messages) { message in
                            ChatBubbleView(message: message)
                                .id(message.id)
                        }

                        // Typing indicator
                        if viewModel.isSending {
                            typingIndicator
                                .id("typing-indicator")
                        }
                    }
                    .padding(.vertical, 12)
                }
            }
            .scrollDismissesKeyboard(.interactively)
            .onChange(of: viewModel.messages.count) { _, _ in
                withAnimation(.easeOut(duration: 0.3)) {
                    if let lastId = viewModel.messages.last?.id {
                        proxy.scrollTo(lastId, anchor: .bottom)
                    }
                }
            }
            .onChange(of: viewModel.isSending) { _, isSending in
                if isSending {
                    withAnimation(.easeOut(duration: 0.3)) {
                        proxy.scrollTo("typing-indicator", anchor: .bottom)
                    }
                }
            }
        }
    }

    // MARK: - Empty State

    private var emptyStateView: some View {
        VStack(spacing: 16) {
            Spacer()
                .frame(height: 60)

            AgentAvatarView(agentId: "sigma", size: 80)

            Text("Hello! I'm Prime")
                .font(.title3.bold())
                .foregroundStyle(.white)

            Text("Your AI trading assistant. Ask me about trades, portfolio analysis, risk assessment, or market insights.")
                .font(.subheadline)
                .foregroundStyle(Color.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)

            Text("Try one of the quick prompts above to get started.")
                .font(.caption)
                .foregroundStyle(Color.textMuted)
                .padding(.top, 4)

            Spacer()
        }
    }

    // MARK: - Typing Indicator

    private var typingIndicator: some View {
        HStack(alignment: .top, spacing: 8) {
            AgentAvatarView(agentId: "sigma", size: 32)

            HStack(spacing: 4) {
                ForEach(0..<3, id: \.self) { index in
                    Circle()
                        .fill(Color.textSecondary)
                        .frame(width: 6, height: 6)
                        .opacity(0.6)
                        .animation(
                            .easeInOut(duration: 0.6)
                                .repeatForever()
                                .delay(Double(index) * 0.2),
                            value: viewModel.isSending
                        )
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .background(Color.cardBackground)
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(Color.appBorder.opacity(0.3), lineWidth: 1)
            )

            Spacer(minLength: 60)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 2)
    }

    // MARK: - Error Banner

    private func errorBanner(_ message: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(Color.statusDanger)
                .font(.caption)

            Text(message)
                .font(.caption)
                .foregroundStyle(Color.statusDanger)
                .lineLimit(2)

            Spacer()

            Button {
                viewModel.error = nil
            } label: {
                Image(systemName: "xmark")
                    .font(.caption2)
                    .foregroundStyle(Color.textMuted)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(Color.statusDanger.opacity(0.1))
    }

    // MARK: - Input Bar

    private var inputBar: some View {
        HStack(spacing: 10) {
            TextField("Ask Prime anything...", text: $viewModel.inputText, axis: .vertical)
                .font(.subheadline)
                .foregroundStyle(.white)
                .lineLimit(1...4)
                .focused($isInputFocused)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(Color.cardBackground)
                .clipShape(RoundedRectangle(cornerRadius: 20))
                .overlay(
                    RoundedRectangle(cornerRadius: 20)
                        .stroke(
                            isInputFocused ? Color.accentCyan.opacity(0.5) : Color.appBorder.opacity(0.3),
                            lineWidth: 1
                        )
                )
                .onSubmit {
                    guard !viewModel.isSending else { return }
                    Task { await viewModel.sendMessage() }
                }

            // Send button
            Button {
                HapticService.impact(.medium)
                Task { await viewModel.sendMessage() }
            } label: {
                ZStack {
                    Circle()
                        .fill(sendButtonEnabled ? Color.accentCyan : Color.cardBackground)
                        .frame(width: 36, height: 36)

                    if viewModel.isSending {
                        ProgressView()
                            .tint(.white)
                            .scaleEffect(0.7)
                    } else {
                        Image(systemName: "arrow.up")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(sendButtonEnabled ? .white : Color.textMuted)
                    }
                }
            }
            .disabled(!sendButtonEnabled)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(Color.appBackground)
        .overlay(alignment: .top) {
            Divider()
                .overlay(Color.appBorder.opacity(0.3))
        }
    }

    private var sendButtonEnabled: Bool {
        !viewModel.inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !viewModel.isSending
    }
}
