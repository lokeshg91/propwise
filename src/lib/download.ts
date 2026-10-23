/**
 * Saves text as a file through the browser's download, e.g. a backup or a
 * CSV export. Nothing is uploaded: the file goes straight to the user.
 * Throws when the browser can't create the download.
 */
export function downloadTextFile(fileName: string, contents: string, type = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([contents], { type: `${type};charset=utf-8` }))
  try {
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    link.rel = 'noopener'
    link.style.display = 'none'
    document.body.append(link)
    link.click()
    link.remove()
  } finally {
    // Give the browser a moment to start the download before releasing the file.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}
