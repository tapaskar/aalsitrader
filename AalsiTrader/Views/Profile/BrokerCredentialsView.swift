import SwiftUI

struct BrokerCredentialsView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var vm = ProfileViewModel()
    private let auth = AuthViewModel.shared

    var body: some View {
        NavigationStack {
            ZStack {
                Color.appBackground.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 16) {
                        // Broker picker
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Select Broker")
                                .font(.headline).foregroundStyle(.white)

                            Picker("Broker", selection: $vm.brokerType) {
                                Text("None").tag(BrokerType.none)
                                Text("Zerodha").tag(BrokerType.zerodha)
                                Text("Dhan").tag(BrokerType.dhan)
                                Text("Motilal Oswal").tag(BrokerType.motilal)
                                Text("AngelOne").tag(BrokerType.angelone)
                                Text("Upstox").tag(BrokerType.upstox)
                            }
                            .pickerStyle(.segmented)
                        }
                        .padding()
                        .cardStyle()

                        // Dynamic credential fields
                        switch vm.brokerType {
                        case .zerodha:
                            credentialFields {
                                credField("API Key", $vm.zerodhaApiKey)
                                credField("API Secret", $vm.zerodhaApiSecret, secure: true)
                            }

                        case .dhan:
                            credentialFields {
                                credField("Client ID", $vm.dhanClientId)
                                credField("Access Token", $vm.dhanAccessToken, secure: true)
                                credField("Trading PIN", $vm.dhanPin, secure: true)
                                credField("TOTP Secret", $vm.dhanTotpSecret, secure: true)
                            }

                        case .motilal:
                            credentialFields {
                                credField("Client ID", $vm.motilalClientId)
                                credField("Password", $vm.motilalPassword, secure: true)
                                credField("TOTP Secret", $vm.motilalTotpSecret, secure: true)
                                credField("API Secret", $vm.motilalApiSecret, secure: true)
                            }

                        case .angelone:
                            credentialFields {
                                credField("API Key", $vm.angeloneApiKey)
                                credField("Client ID", $vm.angeloneClientId)
                                credField("PIN", $vm.angelonePin, secure: true)
                                credField("TOTP Secret", $vm.angeloneTotpSecret, secure: true)
                            }

                        case .upstox:
                            credentialFields {
                                credField("API Key", $vm.upstoxApiKey)
                                credField("API Secret", $vm.upstoxApiSecret, secure: true)
                                credField("Access Token", $vm.upstoxAccessToken, secure: true)
                            }

                        case .none:
                            EmptyStateView(icon: "building.columns", title: "No broker selected", subtitle: "Choose a broker to configure credentials")
                        }

                        if vm.brokerType != .none {
                            Button {
                                Task { await vm.saveBrokerCredentials() }
                            } label: {
                                if vm.isSaving {
                                    ProgressView().tint(.white).frame(maxWidth: .infinity).padding(.vertical, 14)
                                } else {
                                    Text("Save Credentials").font(.headline)
                                        .frame(maxWidth: .infinity).padding(.vertical, 14)
                                }
                            }
                            .buttonStyle(.borderedProminent)
                            .tint(Color.accentCyan)
                            .disabled(vm.isSaving)
                        }

                        if let error = vm.error {
                            ErrorBannerView(message: error)
                        }
                        if let success = vm.successMessage {
                            Text(success)
                                .font(.caption).foregroundStyle(Color.profitGreen)
                        }
                    }
                    .padding()
                }
            }
            .navigationTitle("Broker Setup")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                        .foregroundStyle(Color.accentCyan)
                }
            }
            .onAppear {
                if let user = auth.user {
                    vm.loadFromUser(user)
                }
            }
        }
    }

    private func credentialFields(@ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Credentials")
                .font(.headline).foregroundStyle(.white)
            content()
        }
        .padding()
        .cardStyle()
    }

    private func credField(_ placeholder: String, _ binding: Binding<String>, secure: Bool = false) -> some View {
        Group {
            if secure {
                SecureField(placeholder, text: binding)
            } else {
                TextField(placeholder, text: binding)
                    .autocapitalization(.none)
            }
        }
        .textFieldStyle(.plain)
        .padding()
        .background(Color.appBackground)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.appBorder.opacity(0.5)))
        .foregroundStyle(.white)
    }
}
