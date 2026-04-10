export type UploadResult =
  | { url: string; error?: never }
  | { url?: never; error: string }

export async function uploadTechniqueImage(
  file: File,
  techniqueId: string
): Promise<UploadResult> {
  // Validierung
  if (!file.type.startsWith('image/')) {
    return { error: 'Nur Bilddateien sind erlaubt.' }
  }

  if (file.size > 5 * 1024 * 1024) {
    return { error: 'Maximale Dateigröße ist 5MB.' }
  }

  try {
    // Erstelle FormData für den Server-Upload
    const formData = new FormData()
    formData.append('file', file)
    formData.append('techniqueId', techniqueId)

    // Upload via Server-Route (bypasses RLS mit Admin-Key)
    const response = await fetch('/api/admin/upload-technique-image', {
      method: 'POST',
      body: formData,
    })

    const result = await response.json()

    if (!response.ok) {
      return { error: result.error || 'Upload fehlgeschlagen' }
    }

    return { url: result.url }
  } catch (error) {
    console.error('Upload error:', error)
    return { error: error instanceof Error ? error.message : 'Upload fehlgeschlagen' }
  }
}

export async function uploadGameplanHeroImage(
  file: File,
  gameplanId: string
): Promise<UploadResult> {
  if (!file.type.startsWith('image/')) {
    return { error: 'Nur Bilddateien sind erlaubt.' }
  }

  if (file.size > 5 * 1024 * 1024) {
    return { error: 'Maximale Dateigroesse ist 5MB.' }
  }

  try {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('gameplanId', gameplanId)

    const response = await fetch('/api/admin/upload-gameplan-hero', {
      method: 'POST',
      body: formData,
    })

    const result = await response.json()

    if (!response.ok) {
      return { error: result.error || 'Upload fehlgeschlagen' }
    }

    return { url: result.url }
  } catch (error) {
    console.error('Upload error:', error)
    return { error: error instanceof Error ? error.message : 'Upload fehlgeschlagen' }
  }
}

export async function deleteTechniqueImage(url: string): Promise<void> {
  // Extrahiere Pfad aus URL
  const urlObj = new URL(url)
  const pathMatch = urlObj.pathname.match(/techniques\/(.+)$/)

  if (!pathMatch) return

  const filePath = pathMatch[1]

  try {
    await fetch('/api/admin/delete-technique-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath }),
    })
  } catch (error) {
    console.error('Delete error:', error)
  }
}
