import AppKit
import SwiftUI
import WebKit

struct CRMWebView: NSViewRepresentable {
    let url: URL

    func makeNSView(context: Context) -> WKWebView {
        // Reduce stale JS/CSS from previous sessions on the same localhost port.
        URLCache.shared.removeAllCachedResponses()

        let config = WKWebViewConfiguration()
        config.preferences.setValue(true, forKey: "developerExtrasEnabled")
        config.userContentController.add(context.coordinator, name: "hohohDownload")
        let js = """
        // Marker + helper for native downloads (PDF, exports, etc.)
        window.__HOHOH_NATIVE_APP__ = true;
        """
        config.userContentController.addUserScript(
            WKUserScript(source: js, injectionTime: .atDocumentStart, forMainFrameOnly: true)
        )
        let webView = WKWebView(frame: .zero, configuration: config)
        context.coordinator.attach(webView: webView)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.setValue(false, forKey: "drawsBackground")
        return webView
    }

    func updateNSView(_ webView: WKWebView, context: Context) {
        if webView.url == nil || webView.url != url {
            webView.load(URLRequest(url: url))
        }
    }

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
        private weak var webView: WKWebView?

        func attach(webView: WKWebView) {
            self.webView = webView
        }

        deinit {
            // Best-effort cleanup.
            webView?.configuration.userContentController.removeScriptMessageHandler(forName: "hohohDownload")
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.name == "hohohDownload" else { return }
            guard let body = message.body as? [String: Any] else { return }
            let filename = (body["filename"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
            let b64 = (body["base64"] as? String) ?? ""
            let mime = (body["mime"] as? String) ?? "application/octet-stream"

            guard !b64.isEmpty else { return }
            guard let data = Data(base64Encoded: b64) else { return }

            DispatchQueue.main.async {
                let panel = NSSavePanel()
                panel.canCreateDirectories = true
                panel.isExtensionHidden = false
                panel.nameFieldStringValue = (filename?.isEmpty == false) ? filename! : "download"
                if mime == "application/pdf" && !panel.nameFieldStringValue.lowercased().hasSuffix(".pdf") {
                    panel.nameFieldStringValue += ".pdf"
                }
                let res = panel.runModal()
                guard res == .OK, let url = panel.url else { return }
                do {
                    try data.write(to: url, options: .atomic)
                } catch {
                    let alert = NSAlert()
                    alert.messageText = "Download mislukt"
                    alert.informativeText = error.localizedDescription
                    alert.alertStyle = .warning
                    alert.addButton(withTitle: "OK")
                    alert.runModal()
                }
            }
        }

        // WKWebView does not show JS alert/confirm/prompt without WKUIDelegate (native Mac app).
        func webView(
            _ webView: WKWebView,
            runJavaScriptAlertPanelWithMessage message: String,
            initiatedByFrame frame: WKFrameInfo,
            completionHandler: @escaping () -> Void
        ) {
            DispatchQueue.main.async {
                let alert = NSAlert()
                alert.messageText = message
                alert.alertStyle = .informational
                alert.addButton(withTitle: "OK")
                alert.runModal()
                completionHandler()
            }
        }

        func webView(
            _ webView: WKWebView,
            runJavaScriptConfirmPanelWithMessage message: String,
            initiatedByFrame frame: WKFrameInfo,
            completionHandler: @escaping (Bool) -> Void
        ) {
            DispatchQueue.main.async {
                let alert = NSAlert()
                alert.messageText = message
                alert.alertStyle = .informational
                alert.addButton(withTitle: "OK")
                alert.addButton(withTitle: "Annuleer")
                let r = alert.runModal()
                completionHandler(r == .alertFirstButtonReturn)
            }
        }

        func webView(
            _ webView: WKWebView,
            runJavaScriptTextInputPanelWithPrompt prompt: String,
            defaultText: String?,
            initiatedByFrame frame: WKFrameInfo,
            completionHandler: @escaping (String?) -> Void
        ) {
            DispatchQueue.main.async {
                let alert = NSAlert()
                alert.messageText = prompt.isEmpty ? "Invoer" : prompt
                alert.alertStyle = .informational
                let input = NSTextField(string: defaultText ?? "")
                input.frame = NSRect(x: 0, y: 0, width: 300, height: 24)
                alert.accessoryView = input
                alert.addButton(withTitle: "OK")
                alert.addButton(withTitle: "Annuleer")
                alert.layout()
                alert.window.initialFirstResponder = input
                let r = alert.runModal()
                if r == .alertFirstButtonReturn {
                    completionHandler(input.stringValue)
                } else {
                    completionHandler(nil)
                }
            }
        }

        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let u = navigationAction.request.url else {
                decisionHandler(.cancel)
                return
            }
            let scheme = (u.scheme ?? "").lowercased()
            if scheme == "blob" {
                // blob: downloads are handled by JS -> native bridge instead.
                decisionHandler(.cancel)
                return
            }
            if scheme == "mailto" || scheme == "tel" {
                NSWorkspace.shared.open(u)
                decisionHandler(.cancel)
                return
            }
            if u.scheme == "http" || u.scheme == "https" {
                if u.host == "127.0.0.1" || u.host == "localhost" {
                    decisionHandler(.allow)
                    return
                }
            }
            if navigationAction.navigationType == .linkActivated {
                NSWorkspace.shared.open(u)
                decisionHandler(.cancel)
                return
            }
            decisionHandler(.allow)
        }
    }
}
