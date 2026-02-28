import SwiftUI

struct SigmaApprovalsView: View {
    let approvals: [SigmaApproval]
    let onApprove: (String) -> Void
    let onReject: (String) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Pending Approvals")
                    .sectionHeader()
                if !approvals.isEmpty {
                    PillBadgeView(text: "\(approvals.count)", color: Color.statusWarning)
                }
            }

            if approvals.isEmpty {
                EmptyStateView(
                    icon: "checkmark.seal",
                    title: "No pending approvals",
                    subtitle: "Sigma will send trade signals here for your review"
                )
            } else {
                LazyVStack(spacing: 10) {
                    ForEach(approvals) { approval in
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Text(approval.symbol)
                                    .font(.headline)
                                    .foregroundStyle(.white)
                                PillBadgeView(
                                    text: approval.signal.rawValue,
                                    color: approval.signal == .BUY ? Color.profitGreen : Color.lossRed
                                )
                                Spacer()
                                TimeAgoText(date: approval.date)
                            }

                            Text("Entry: \(approval.entryPrice, specifier: "%.2f")")
                                .font(.subheadline)
                                .foregroundStyle(Color.textSecondary)

                            if let indicators = approval.indicators {
                                HStack(spacing: 12) {
                                    if let rsi = indicators.rsi {
                                        Text("RSI: \(rsi, specifier: "%.1f")")
                                            .font(.caption)
                                            .foregroundStyle(Color.textMuted)
                                    }
                                    if let conf = indicators.confidence {
                                        Text("Conf: \(conf, specifier: "%.0f")%")
                                            .font(.caption)
                                            .foregroundStyle(Color.textMuted)
                                    }
                                }
                            }

                            HStack(spacing: 12) {
                                Button {
                                    onApprove(approval.tradeId)
                                } label: {
                                    Label("Approve", systemImage: "checkmark")
                                        .font(.subheadline.bold())
                                        .frame(maxWidth: .infinity)
                                        .padding(.vertical, 8)
                                }
                                .buttonStyle(.borderedProminent)
                                .tint(Color.profitGreen)

                                Button {
                                    onReject(approval.tradeId)
                                } label: {
                                    Label("Reject", systemImage: "xmark")
                                        .font(.subheadline.bold())
                                        .frame(maxWidth: .infinity)
                                        .padding(.vertical, 8)
                                }
                                .buttonStyle(.borderedProminent)
                                .tint(Color.statusDanger)
                            }
                        }
                        .padding()
                        .cardStyle()
                    }
                }
            }
        }
    }
}
