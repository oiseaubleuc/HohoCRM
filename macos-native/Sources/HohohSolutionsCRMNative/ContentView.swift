import SwiftUI

struct ContentView: View {
    @StateObject private var server = PythonHTTPServer()

    var body: some View {
        Group {
            if let err = server.errorMessage {
                VStack(spacing: 16) {
                    Text("HohohSolutions CRM")
                        .font(.title2.weight(.bold))
                    Text(err)
                        .multilineTextAlignment(.center)
                        .foregroundStyle(.secondary)
                        .padding(.horizontal)
                    Button("Opnieuw") {
                        if let root = Self.webrootURL() {
                            server.start(webRoot: root)
                        }
                    }
                    .buttonStyle(.borderedProminent)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let url = server.baseURL {
                CRMWebView(url: url)
                    .frame(minWidth: 800, minHeight: 560)
            } else {
                VStack(spacing: 12) {
                    ProgressView()
                        .scaleEffect(1.2)
                    Text("CRM wordt geladen…")
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .onAppear {
            guard let root = Self.webrootURL() else {
                server.reportError(
                    "Bundel webroot ontbreekt. Bouw de app met ./build-native-mac-app.sh (webapp → dist → .app)."
                )
                return
            }
            server.start(webRoot: root)
        }
        .onDisappear {
            server.stop()
        }
    }

    /// Dans le .app, `webroot` est copié dans Contents/Resources/webroot par le script de build.
    private static func webrootURL() -> URL? {
        let u = Bundle.main.resourceURL?.appendingPathComponent("webroot", isDirectory: true)
        guard let u, FileManager.default.fileExists(atPath: u.appendingPathComponent("index.html").path) else {
            return nil
        }
        return u
    }
}
