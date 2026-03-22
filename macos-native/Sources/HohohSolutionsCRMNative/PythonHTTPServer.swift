import Darwin
import Foundation

/// Lance `python3 -m http.server` sur le dossier webroot (même principe que le launcher shell).
final class PythonHTTPServer: ObservableObject {
    @Published private(set) var baseURL: URL?
    @Published private(set) var errorMessage: String?

    private var process: Process?
    private let portStart = 38_471
    private let portEnd = 38_486

    func reportError(_ message: String) {
        stop()
        errorMessage = message
        baseURL = nil
    }

    func start(webRoot: URL) {
        stop()
        errorMessage = nil
        baseURL = nil

        guard FileManager.default.fileExists(atPath: webRoot.appendingPathComponent("index.html").path) else {
            errorMessage = "index.html ontbreekt in webroot. Bouw eerst de webapp (npm run build) en sync webroot."
            return
        }

        for port in portStart...portEnd {
            if isPortListening(port) { continue }
            if startProcess(webRoot: webRoot, port: port) {
                return
            }
        }
        errorMessage = "Kon geen lokale server starten (poorten \(portStart)–\(portEnd) of Python 3)."
    }

    func stop() {
        if let p = process, Self.processIsAlive(p) {
            p.terminate()
            p.waitUntilExit()
        }
        process = nil
        baseURL = nil
    }

    private static func processIsAlive(_ p: Process) -> Bool {
        let pid = p.processIdentifier
        if pid <= 0 { return false }
        return kill(pid, 0) == 0
    }

    deinit { stop() }

    private func isPortListening(_ port: Int) -> Bool {
        let task = Process()
        task.executableURL = URL(fileURLWithPath: "/usr/sbin/lsof")
        task.arguments = ["-iTCP:\(port)", "-sTCP:LISTEN", "-P", "-n"]
        let pipe = Pipe()
        task.standardOutput = pipe
        task.standardError = pipe
        try? task.run()
        task.waitUntilExit()
        let data = pipe.fileHandleForReading.readDataToEndOfFile()
        return !data.isEmpty
    }

    private func startProcess(webRoot: URL, port: Int) -> Bool {
        let python = findPython3()
        guard let bin = python else { return false }

        let argVariants: [[String]] = [
            ["-m", "http.server", "\(port)", "--bind", "127.0.0.1"],
            ["-m", "http.server", "\(port)"]
        ]

        for args in argVariants {
            let p = Process()
            p.executableURL = bin
            p.arguments = args
            p.currentDirectoryURL = webRoot
            p.standardOutput = FileHandle.nullDevice
            p.standardError = FileHandle.nullDevice

            do {
                try p.run()
            } catch {
                continue
            }

            for _ in 0..<55 {
                Thread.sleep(forTimeInterval: 0.08)
                let url = URL(string: "http://127.0.0.1:\(port)/")!
                if probe(url: url) {
                    process = p
                    baseURL = url
                    return true
                }
                if !Self.processIsAlive(p) { break }
            }

            if Self.processIsAlive(p) {
                p.terminate()
                p.waitUntilExit()
            }
        }
        return false
    }

    private func probe(url: URL) -> Bool {
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.timeoutInterval = 0.45
        let sem = DispatchSemaphore(value: 0)
        var ok = false
        URLSession.shared.dataTask(with: request) { _, response, _ in
            ok = (response as? HTTPURLResponse)?.statusCode == 200
            sem.signal()
        }.resume()
        sem.wait()
        return ok
    }

    private func findPython3() -> URL? {
        let candidates = [
            "/usr/bin/python3",
            "/usr/local/bin/python3",
            "/opt/homebrew/bin/python3"
        ]
        for path in candidates {
            let u = URL(fileURLWithPath: path)
            if FileManager.default.isExecutableFile(atPath: path) { return u }
        }
        let which = Process()
        which.executableURL = URL(fileURLWithPath: "/usr/bin/which")
        which.arguments = ["python3"]
        let pipe = Pipe()
        which.standardOutput = pipe
        which.standardError = FileHandle.nullDevice
        try? which.run()
        which.waitUntilExit()
        guard which.terminationStatus == 0 else { return nil }
        let out = String(data: pipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8)?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return out.isEmpty ? nil : URL(fileURLWithPath: out)
    }
}
