import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import { Readable } from 'stream';

// All tables to back up
const TABLES = [
  'contacts',
  'organizations',
  'opportunities',
  'opportunity_updates',
  'leads',
  'lead_messages',
  'lead_rejection_reasons',
  'orders',
  'quotes',
  'quote_items',
  'items',
  'item_categories',
  'inventory_levels',
  'inventory_locations',
  'inventory_logs',
  'invoices',
  'delivery_addresses',
  'contact_inquiries',
  'system_logs',
];

// Simple auth check via secret header
function isAuthorized(req: Request): boolean {
  const secret = req.headers.get('x-backup-secret');
  return secret === process.env.BACKUP_SECRET;
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const backup: Record<string, any[]> = {};
    const errors: string[] = [];

    // Fetch all rows from each table
    for (const table of TABLES) {
      const { data, error } = await supabase.from(table).select('*');
      if (error) {
        errors.push(`${table}: ${error.message}`);
        backup[table] = [];
      } else {
        backup[table] = data ?? [];
      }
    }

    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const dateLabel = now.toLocaleDateString('he-IL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'Asia/Jerusalem',
    }).replace(/\//g, '-');

    const backupPayload = {
      created_at: now.toISOString(),
      version: '1.0',
      tables: TABLES,
      row_counts: Object.fromEntries(
        Object.entries(backup).map(([t, rows]) => [t, rows.length])
      ),
      errors,
      data: backup,
    };

    const jsonString = JSON.stringify(backupPayload, null, 2);
    const buffer = Buffer.from(jsonString, 'utf-8');
    const fileName = `confettix-backup-${dateLabel}-${timestamp}.json`;

    // Upload to Google Drive
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_JSON || '{}');
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });
    const drive = google.drive({ version: 'v3', auth });

    const readable = new Readable();
    readable._read = () => {};
    readable.push(buffer);
    readable.push(null);

    const driveResponse = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [process.env.GOOGLE_DRIVE_BACKUP_FOLDER_ID!],
        description: `Confettix CRM Backup - ${now.toISOString()}`,
      },
      media: {
        mimeType: 'application/json',
        body: readable,
      },
      fields: 'id, name, webViewLink',
    });

    // Log backup to system_logs
    await supabase.from('system_logs').insert({
      action: 'db_backup',
      entity_type: 'system',
      details: {
        file_name: fileName,
        drive_file_id: driveResponse.data.id,
        row_counts: backupPayload.row_counts,
        errors,
        size_bytes: buffer.length,
      },
    });

    return NextResponse.json({
      success: true,
      file_name: fileName,
      drive_file_id: driveResponse.data.id,
      drive_link: driveResponse.data.webViewLink,
      row_counts: backupPayload.row_counts,
      size_kb: Math.round(buffer.length / 1024),
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('Backup error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET — returns last backup info from system_logs
export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data } = await supabase
    .from('system_logs')
    .select('*')
    .eq('action', 'db_backup')
    .order('created_at', { ascending: false })
    .limit(10);

  return NextResponse.json({ backups: data ?? [] });
}
