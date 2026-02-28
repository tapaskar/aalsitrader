import Foundation

@Observable
final class ProfileViewModel {
    var isSaving = false
    var error: String?
    var successMessage: String?

    // Broker credential fields
    var brokerType: BrokerType = .none
    var zerodhaApiKey = ""
    var zerodhaApiSecret = ""
    var dhanClientId = ""
    var dhanAccessToken = ""
    var dhanPin = ""
    var dhanTotpSecret = ""
    var motilalClientId = ""
    var motilalPassword = ""
    var motilalTotpSecret = ""
    var motilalApiSecret = ""
    var angeloneApiKey = ""
    var angeloneClientId = ""
    var angelonePin = ""
    var angeloneTotpSecret = ""
    var upstoxApiKey = ""
    var upstoxApiSecret = ""
    var upstoxAccessToken = ""

    func loadFromUser(_ user: User) {
        brokerType = user.brokerType ?? .none
    }

    func saveBrokerCredentials() async {
        let auth = AuthViewModel.shared
        isSaving = true
        error = nil

        var data: [String: Any] = ["brokerType": brokerType.rawValue]

        switch brokerType {
        case .zerodha:
            if !zerodhaApiKey.isEmpty { data["zerodhaApiKey"] = zerodhaApiKey }
            if !zerodhaApiSecret.isEmpty { data["zerodhaApiSecret"] = zerodhaApiSecret }
        case .dhan:
            if !dhanClientId.isEmpty { data["dhanClientId"] = dhanClientId }
            if !dhanAccessToken.isEmpty { data["dhanAccessToken"] = dhanAccessToken }
            if !dhanPin.isEmpty { data["dhanPin"] = dhanPin }
            if !dhanTotpSecret.isEmpty { data["dhanTotpSecret"] = dhanTotpSecret }
        case .motilal:
            if !motilalClientId.isEmpty { data["motilalClientId"] = motilalClientId }
            if !motilalPassword.isEmpty { data["motilalPassword"] = motilalPassword }
            if !motilalTotpSecret.isEmpty { data["motilalTotpSecret"] = motilalTotpSecret }
            if !motilalApiSecret.isEmpty { data["motilalApiSecret"] = motilalApiSecret }
        case .angelone:
            if !angeloneApiKey.isEmpty { data["angeloneApiKey"] = angeloneApiKey }
            if !angeloneClientId.isEmpty { data["angeloneClientId"] = angeloneClientId }
            if !angelonePin.isEmpty { data["angelonePin"] = angelonePin }
            if !angeloneTotpSecret.isEmpty { data["angeloneTotpSecret"] = angeloneTotpSecret }
        case .upstox:
            if !upstoxApiKey.isEmpty { data["upstoxApiKey"] = upstoxApiKey }
            if !upstoxApiSecret.isEmpty { data["upstoxApiSecret"] = upstoxApiSecret }
            if !upstoxAccessToken.isEmpty { data["upstoxAccessToken"] = upstoxAccessToken }
        case .none:
            break
        }

        let success = await auth.updateProfile(data)
        isSaving = false
        if success {
            successMessage = "Broker credentials saved"
            HapticService.success()
        } else {
            error = auth.error
            HapticService.error()
        }
    }

    func saveSettings(soundEnabled: Bool, requireSigmaApproval: Bool) async {
        let auth = AuthViewModel.shared
        isSaving = true
        let data: [String: Any] = [
            "settings": [
                "soundEnabled": soundEnabled,
                "darkMode": true,
                "requireSigmaApproval": requireSigmaApproval
            ]
        ]
        let success = await auth.updateProfile(data)
        isSaving = false
        if success {
            successMessage = "Settings saved"
            HapticService.success()
        } else {
            error = auth.error
        }
    }
}
