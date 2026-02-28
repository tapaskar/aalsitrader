import Foundation
import SwiftUI

@Observable
final class PrimeChatViewModel {
    var messages: [ChatMessage] = []
    var inputText: String = ""
    var isLoading: Bool = false
    var isSending: Bool = false
    var error: String?

    let quickPrompts = ["Find Trades", "Portfolio Summary", "Risk Check", "Market Analysis"]

    // MARK: - Load History

    func loadHistory() async {
        isLoading = true
        error = nil
        do {
            let history = try await PrimeChatService.fetchHistory()
            await MainActor.run {
                self.messages = history
                self.isLoading = false
            }
        } catch let apiError as APIError {
            await MainActor.run {
                self.error = apiError.localizedDescription
                self.isLoading = false
            }
        } catch {
            await MainActor.run {
                self.error = error.localizedDescription
                self.isLoading = false
            }
        }
    }

    // MARK: - Send Message

    func sendMessage() async {
        let text = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }

        // Create optimistic user message
        let userMessage = ChatMessage(
            id: UUID().uuidString,
            role: .user,
            content: text,
            timestamp: .epoch(Date().timeIntervalSince1970 * 1000),
            intent: nil
        )

        await MainActor.run {
            self.messages.append(userMessage)
            self.inputText = ""
            self.isSending = true
            self.error = nil
        }

        do {
            let response = try await PrimeChatService.sendMessage(text)
            let assistantMessage = ChatMessage(
                id: UUID().uuidString,
                role: .assistant,
                content: response.response.message,
                timestamp: .epoch(Date().timeIntervalSince1970 * 1000),
                intent: response.response.intent
            )
            await MainActor.run {
                self.messages.append(assistantMessage)
                self.isSending = false
            }
            HapticService.success()
        } catch let apiError as APIError {
            await MainActor.run {
                self.error = apiError.localizedDescription
                self.isSending = false
            }
            HapticService.error()
        } catch {
            await MainActor.run {
                self.error = error.localizedDescription
                self.isSending = false
            }
            HapticService.error()
        }
    }

    // MARK: - Quick Prompt

    func sendQuickPrompt(_ prompt: String) async {
        await MainActor.run {
            self.inputText = prompt
        }
        await sendMessage()
    }
}
