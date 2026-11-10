import SafariServices

/// Answers `browser.runtime.sendNativeMessage` from the web extension. The one
/// message it knows saves a converted recipe into the Downloads folder, which
/// Safari gives a web extension no API for. The work is in CookFileSaver.swift.
class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {

    func beginRequest(with context: NSExtensionContext) {
        let request = context.inputItems.first as? NSExtensionItem

        let message: Any?
        if #available(macOS 14.0, *) {
            message = request?.userInfo?[SFExtensionMessageKey]
        } else {
            message = request?.userInfo?["message"]
        }

        // In the sandbox this is the real ~/Downloads, reachable through the
        // com.apple.security.files.downloads.read-write entitlement.
        let downloads = FileManager.default.urls(for: .downloadsDirectory, in: .userDomainMask).first

        let response = NSExtensionItem()
        response.userInfo = [SFExtensionMessageKey: CookSaveMessage.reply(to: message, saver: downloads.map(CookFileSaver.init(directory:)))]
        context.completeRequest(returningItems: [response], completionHandler: nil)
    }

}
