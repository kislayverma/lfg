package com.lfg

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * Transparent activity that handles ACTION_SEND intents for text sharing.
 *
 * When a user shares text from any app (browser, Kindle, etc.) to LFG,
 * this activity receives the intent, appends the shared text as a JSON
 * entry to a file in the app's files directory, shows a brief Toast,
 * and finishes immediately — without launching the React Native runtime
 * or the main app UI.
 *
 * The main app processes the inbox file on next foreground via the journal
 * plugin's onForeground hook.
 */
class ShareReceiverActivity : Activity() {

    private val inboxFileName = "share_inbox.json"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (intent?.action == Intent.ACTION_SEND && intent.type == "text/plain") {
            handleSharedText(intent)
        }

        finish()
    }

    private fun handleSharedText(intent: Intent) {
        val sharedText = intent.getStringExtra(Intent.EXTRA_TEXT)
        if (sharedText.isNullOrBlank()) return

        val subject = intent.getStringExtra(Intent.EXTRA_SUBJECT)

        // Detect URL in shared text — many apps share "title\nurl" format
        val (text, source) = extractTextAndUrl(sharedText)

        try {
            saveToInbox(text, source, subject)
            Toast.makeText(this, "Saved to LFG Notes", Toast.LENGTH_SHORT).show()
        } catch (e: Exception) {
            Toast.makeText(this, "Failed to save", Toast.LENGTH_SHORT).show()
        }
    }

    private fun saveToInbox(text: String, source: String?, subject: String?) {
        val file = File(filesDir, inboxFileName)

        // Read existing inbox items
        val inbox: JSONArray = try {
            if (file.exists()) {
                JSONArray(file.readText())
            } else {
                JSONArray()
            }
        } catch (_: Exception) {
            JSONArray()
        }

        // Build the new item
        val item = JSONObject().apply {
            put("text", text.trim())
            put("timestamp", System.currentTimeMillis())
            if (!source.isNullOrBlank()) put("source", source)
            if (!subject.isNullOrBlank()) put("subject", subject)
        }

        inbox.put(item)
        file.writeText(inbox.toString())
    }

    /**
     * Many apps share text as "Article Title\nhttps://example.com".
     * This extracts the URL (if present at the end) and returns the
     * remaining text separately.
     */
    private fun extractTextAndUrl(sharedText: String): Pair<String, String?> {
        val lines = sharedText.trim().split("\n")
        if (lines.size >= 2) {
            val lastLine = lines.last().trim()
            if (lastLine.startsWith("http://") || lastLine.startsWith("https://")) {
                val textPart = lines.dropLast(1).joinToString("\n").trim()
                return if (textPart.isNotEmpty()) {
                    Pair(textPart, lastLine)
                } else {
                    Pair(lastLine, lastLine)
                }
            }
        }
        val trimmed = sharedText.trim()
        if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
            return Pair(trimmed, trimmed)
        }
        return Pair(sharedText, null)
    }
}
