import SwiftUI
#if !NO_SPARKLE
import Sparkle
#endif

@main
struct HohohSolutionsCRMNativeApp: App {
    #if !NO_SPARKLE
    /// Sparkle: achtergrondcontrole + menu-item « Controleren op updates… »
    private let updaterController: SPUStandardUpdaterController
    #endif

    init() {
        #if !NO_SPARKLE
        updaterController = SPUStandardUpdaterController(
            startingUpdater: true,
            updaterDelegate: nil,
            userDriverDelegate: nil
        )
        #endif
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .defaultSize(width: 1280, height: 820)
        .commands {
            CommandGroup(replacing: .newItem) {}
            CommandGroup(after: .appInfo) {
                #if !NO_SPARKLE
                Button("Controleren op updates…") {
                    updaterController.updater.checkForUpdates()
                }
                .keyboardShortcut("u", modifiers: [.command, .shift])
                #endif
            }
        }
    }
}
