import Capacitor
import AuthenticationServices
import FirebaseCore
import FirebaseMessaging

class DacianaViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(DacianaApplePlugin())
        bridge?.registerPluginInstance(DacianaMessagingPlugin())
    }
}

@objc(DacianaMessagingPlugin)
public class DacianaMessagingPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "DacianaMessagingPlugin"
    public let jsName = "DacianaMessaging"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "enable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "disable", returnType: CAPPluginReturnPromise)
    ]

    @objc func enable(_ call: CAPPluginCall) {
        guard FirebaseApp.app() != nil else {
            call.reject("Notifications are unavailable in this build. Please contact the store.")
            return
        }
        Messaging.messaging().isAutoInitEnabled = true
        call.resolve()
    }

    @objc func disable(_ call: CAPPluginCall) {
        guard FirebaseApp.app() != nil else { call.resolve(); return }
        Messaging.messaging().isAutoInitEnabled = false
        // Match registration-token mode until the server migrates to FIDs.
        Messaging.messaging().deleteToken { error in
            if error != nil { call.reject("Could not reset notification registration. Please try again.") }
            else { call.resolve() }
        }
    }
}

@objc(DacianaApplePlugin)
public class DacianaApplePlugin: CAPPlugin, CAPBridgedPlugin,
    ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    public let identifier = "DacianaApplePlugin"
    public let jsName = "DacianaApple"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "authorize", returnType: CAPPluginReturnPromise)
    ]
    private var pending: CAPPluginCall?
    private var controller: ASAuthorizationController?
    private var expectedState: String?
    private var anchor: ASPresentationAnchor?

    @objc func authorize(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard self.pending == nil else {
                call.reject("Apple sign-in is already open.")
                return
            }
            guard let nonce = call.getString("nonce"),
                  nonce.range(of: "^[a-f0-9]{64}$", options: .regularExpression) != nil,
                  let state = call.getString("state"),
                  state.range(of: "^[a-f0-9]{64}$", options: .regularExpression) != nil,
                  let window = self.bridge?.viewController?.view.window else {
                call.reject("Apple sign-in could not start. Please try again.")
                return
            }
            let request = ASAuthorizationAppleIDProvider().createRequest()
            request.requestedScopes = [.fullName, .email]
            request.nonce = nonce
            request.state = state
            self.expectedState = state
            self.anchor = window
            self.pending = call
            let controller = ASAuthorizationController(authorizationRequests: [request])
            controller.delegate = self
            controller.presentationContextProvider = self
            self.controller = controller
            controller.performRequests()
        }
    }

    public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        return anchor!
    }

    public func authorizationController(controller: ASAuthorizationController,
                                        didCompleteWithAuthorization authorization: ASAuthorization) {
        defer { pending = nil; self.controller = nil; expectedState = nil; anchor = nil }
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
              credential.state == expectedState,
              let tokenData = credential.identityToken,
              let token = String(data: tokenData, encoding: .utf8),
              let codeData = credential.authorizationCode,
              let code = String(data: codeData, encoding: .utf8) else {
            pending?.reject("Apple sign-in could not finish. Please try again.")
            return
        }
        var result: [String: Any] = ["identityToken": token, "authorizationCode": code]
        if let name = credential.fullName {
            let fullName = PersonNameComponentsFormatter().string(from: name)
                .trimmingCharacters(in: .whitespacesAndNewlines)
            if !fullName.isEmpty { result["fullName"] = fullName }
        }
        pending?.resolve(result)
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        defer { pending = nil; self.controller = nil; expectedState = nil; anchor = nil }
        if (error as? ASAuthorizationError)?.code == .canceled {
            pending?.reject("Apple sign-in was cancelled.", "CANCELLED")
        } else {
            pending?.reject("Apple sign-in could not finish. Please try again.", "APPLE_AUTH_FAILED")
        }
    }
}
