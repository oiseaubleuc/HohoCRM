import SwiftUI
import Sparkle

@main
struct HohohSolutionsCRMNativeApp: App {
    /// Sparkle: achtergrondcontrole + menu-item « Controleren op updates… »
    private let updaterController: SPUStandardUpdaterController

    init() {
        updaterController = SPUStandardUpdaterController(
            startingUpdater: true,
            updaterDelegate: nil,
            userDriverDelegate: nil
        )
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .defaultSize(width: 1280, height: 820)
        .commands {
            CommandGroup(replacing: .newItem) {}
            CommandGroup(after: .appInfo) {
                Button("Controleren op updates…") {
                    updaterController.updater.checkForUpdates()
                }
                .keyboardShortcut("u", modifiers: [.command, .shift])
            }
        }
    }
}
