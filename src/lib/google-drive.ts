import { google } from 'googleapis'
import { Readable } from 'stream'

export async function uploadFileToDrive(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<{ url: string; fileId: string }> {
  try {
    const credentialsJson = process.env.GOOGLE_SERVICE_JSON
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID

    if (!credentialsJson || !folderId) {
      throw new Error('Missing Google Drive configuration (JSON or Folder ID).')
    }

    const credentials = JSON.parse(credentialsJson)

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    })

    const drive = google.drive({ version: 'v3', auth })

    // Convert Buffer to a Readable Stream for the googleapis client
    const stream = new Readable()
    stream.push(buffer)
    stream.push(null)

    const fileMetadata = {
      name: filename,
      parents: [folderId],
    }

    const media = {
      mimeType,
      body: stream,
    }

    const res = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, webViewLink, webContentLink',
    })

    const fileId = res.data.id
    if (!fileId) throw new Error('File uploaded but no ID returned.')

    // Since the folder is public, the webViewLink is accessible.
    // To make sure it's embeddable or downloadable, we can optionally use the Drive export/view link.
    // e.g. https://drive.google.com/uc?export=view&id={id}
    const publicUrl = `https://drive.google.com/uc?export=view&id=${fileId}`

    return {
      url: publicUrl,
      fileId: fileId,
    }
  } catch (error) {
    console.error('Error uploading to Google Drive:', error)
    throw error
  }
}
