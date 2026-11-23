package studio.frame.transfer

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import android.net.Uri
import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.io.File

// Android TV can ship without DocumentsUI. The app's external media folder is
// accessible to a USB-connected computer without a broad storage permission.
class FrameTransferModule : Module() {
  private fun folder(): File {
    val context = requireNotNull(appContext.reactContext)
    val root = requireNotNull(context.externalMediaDirs.firstOrNull { it != null })
    return File(root, "Frame").also { check(it.isDirectory || it.mkdirs()) }
  }

  private fun document(name: String): File {
    require(name == File(name).name && name.endsWith(".md", ignoreCase = true))
    val root = folder().canonicalFile
    return File(root, name).canonicalFile.also { require(it.parentFile == root) }
  }

  private fun readMarkdown(input: InputStream): String = input.use { stream ->
    val buffer = ByteArray(8192)
    val bytes = ByteArrayOutputStream()
    var count = stream.read(buffer)
    while (count >= 0) {
      require(bytes.size() + count <= 1048576)
      bytes.write(buffer, 0, count)
      count = stream.read(buffer)
    }
    bytes.toString("UTF-8")
  }

  override fun definition() = ModuleDefinition {
    Name("FrameTransfer")
    AsyncFunction("list") {
      val root = folder()
      mapOf("folder" to "Android/media/${root.parentFile!!.name}/Frame",
        "files" to root.listFiles().orEmpty().filter { it.isFile && it.extension.equals("md", true) }.sortedByDescending { it.lastModified() }.map { it.name })
    }
    AsyncFunction("read") { name: String ->
      val file = document(name)
      require(file.length() in 1L..1048576L)
      readMarkdown(file.inputStream())
    }
    AsyncFunction("readPickedDocument") { uri: String ->
      val selected = Uri.parse(uri)
      require(selected.scheme == "content")
      val resolver = requireNotNull(appContext.reactContext).contentResolver
      readMarkdown(requireNotNull(resolver.openInputStream(selected)))
    }
    AsyncFunction("write") { name: String, text: String ->
      val file = document(name)
      require(text.toByteArray().size <= 1048576 && file.createNewFile())
      try { file.writeText(text) } catch (e: Exception) { file.delete(); throw e }
      "Android/media/${file.parentFile!!.parentFile!!.name}/Frame/${file.name}"
    }
  }
}
