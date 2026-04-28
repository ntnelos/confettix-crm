import { google } from 'googleapis';
import { NextResponse } from 'next/server';
import { Readable } from 'stream';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Load credentials from environment variable
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_JSON || '{}');
    
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    const drive = google.drive({ version: 'v3', auth });

    // Convert file to stream-like format for upload
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileMetadata = {
      name: file.name,
      parents: [process.env.GOOGLE_DRIVE_FOLDER_ID || ''], // Use folder ID from env
    };
    
    const media = {
      mimeType: file.type,
      body: ReadableStreamToStream(buffer),
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, webViewLink, webContentLink',
      supportsAllDrives: true,
    });

    // Make the file readable by anyone with the link
    await drive.permissions.create({
      fileId: response.data.id!,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
      supportsAllDrives: true,
    });

    // Return the direct link (using the webContentLink or a formatted uc link)
    const directUrl = `https://drive.google.com/uc?export=view&id=${response.data.id}`;

    return NextResponse.json({ url: directUrl });
  } catch (error: any) {
    console.error('Upload Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Helper to convert Buffer to Readable stream for Google SDK
function ReadableStreamToStream(buffer: Buffer) {
  const readable = new Readable();
  readable._read = () => {};
  readable.push(buffer);
  readable.push(null);
  return readable;
}
