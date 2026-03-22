import UIKit
import Social
import MobileCoreServices
import UniformTypeIdentifiers
import MMKV

/**
 * Share Extension view controller.
 *
 * Receives shared text (and optional URL) from Safari, Kindle, or any app,
 * writes a JSON item to the shared MMKV inbox, shows a brief confirmation,
 * and dismisses. The main LFG app processes the inbox on next foreground.
 *
 * No React Native runtime is loaded — this is pure native Swift.
 */
class ShareViewController: UIViewController {

    private let appGroupId = "group.com.lfg.shared"
    private let mmkvId = "lfg.share-inbox"
    private let inboxKey = "share_inbox"

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor.black.withAlphaComponent(0.3)
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        processSharedContent()
    }

    private func processSharedContent() {
        guard let extensionItems = extensionContext?.inputItems as? [NSExtensionItem] else {
            completeRequest(success: false)
            return
        }

        var sharedText: String?
        var sharedURL: String?
        var subject: String?

        let group = DispatchGroup()

        for item in extensionItems {
            // Capture the subject/title from the extension item
            if let itemSubject = item.attributedContentText?.string, !itemSubject.isEmpty {
                subject = itemSubject
            }

            guard let attachments = item.attachments else { continue }

            for provider in attachments {
                // Extract plain text
                if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
                    group.enter()
                    provider.loadItem(forTypeIdentifier: UTType.plainText.identifier, options: nil) { data, _ in
                        if let text = data as? String {
                            sharedText = text
                        }
                        group.leave()
                    }
                }

                // Extract URL
                if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
                    group.enter()
                    provider.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { data, _ in
                        if let url = data as? URL {
                            sharedURL = url.absoluteString
                        }
                        group.leave()
                    }
                }
            }
        }

        group.notify(queue: .main) { [weak self] in
            guard let self = self else { return }

            guard let text = sharedText, !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
                self.completeRequest(success: false)
                return
            }

            let success = self.saveToInbox(
                text: text.trimmingCharacters(in: .whitespacesAndNewlines),
                source: sharedURL,
                subject: subject
            )

            if success {
                self.showConfirmation()
            } else {
                self.completeRequest(success: false)
            }
        }
    }

    private func saveToInbox(text: String, source: String?, subject: String?) -> Bool {
        // Initialize MMKV with the App Group container
        guard let groupDir = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: appGroupId
        )?.path else {
            NSLog("[ShareExtension] Failed to get App Group container path")
            return false
        }

        MMKV.initialize(rootDir: groupDir + "/mmkv")

        guard let mmkv = MMKV(mmapID: mmkvId, mode: .multiProcess) else {
            NSLog("[ShareExtension] Failed to create MMKV instance")
            return false
        }

        // Read existing inbox items
        var inbox: [[String: Any]] = []
        if let existing = mmkv.string(forKey: inboxKey),
           let data = existing.data(using: .utf8),
           let parsed = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] {
            inbox = parsed
        }

        // Build the new inbox item
        var item: [String: Any] = [
            "text": text,
            "timestamp": Date().timeIntervalSince1970 * 1000 // JS-compatible ms
        ]
        if let source = source, !source.isEmpty {
            item["source"] = source
        }
        if let subject = subject, !subject.isEmpty {
            item["subject"] = subject
        }

        inbox.append(item)

        // Write back
        if let jsonData = try? JSONSerialization.data(withJSONObject: inbox),
           let jsonString = String(data: jsonData, encoding: .utf8) {
            mmkv.set(jsonString, forKey: inboxKey)
            NSLog("[ShareExtension] Saved item to inbox (total: \(inbox.count))")
            return true
        }

        return false
    }

    private func showConfirmation() {
        let label = UILabel()
        label.text = "Saved to LFG Notes"
        label.textColor = .white
        label.font = .systemFont(ofSize: 16, weight: .semibold)
        label.textAlignment = .center
        label.backgroundColor = UIColor(red: 0.2, green: 0.7, blue: 0.4, alpha: 1.0)
        label.layer.cornerRadius = 12
        label.layer.masksToBounds = true

        label.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(label)

        NSLayoutConstraint.activate([
            label.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            label.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            label.widthAnchor.constraint(equalToConstant: 220),
            label.heightAnchor.constraint(equalToConstant: 48),
        ])

        // Dismiss after a brief delay
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) { [weak self] in
            self?.completeRequest(success: true)
        }
    }

    private func completeRequest(success: Bool) {
        if success {
            extensionContext?.completeRequest(returningItems: nil)
        } else {
            extensionContext?.cancelRequest(withError: NSError(
                domain: "com.lfg.ShareExtension",
                code: 0,
                userInfo: [NSLocalizedDescriptionKey: "Failed to save shared content"]
            ))
        }
    }
}
