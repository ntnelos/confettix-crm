import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const SCRIPTS_DIR = path.join(process.cwd(), 'scripts');
const CONTACTS_FILE = path.join(SCRIPTS_DIR, 'contacts_without_organization.csv');
const ACCOUNTS_FILE = path.join(SCRIPTS_DIR, 'accounts.csv');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface Contact {
    id: string;
    name: string;
    email: string;
    phone: string;
    mobile: string;
    created_at: string;
    account_name?: string;
    official_org_name?: string;
}

interface Account {
    emailaddress1: string;
    telephone1: string;
    accountname: string;
}

async function loadCSV<T>(filePath: string): Promise<T[]> {
    return new Promise((resolve, reject) => {
        const results: T[] = [];
        if (!fs.existsSync(filePath)) {
            return resolve([]);
        }
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', (error) => reject(error));
    });
}

function escapeCSV(val: any): string {
    if (val === undefined || val === null) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

async function fetchAllOrganizations() {
    let allOrgs: { name: string }[] = [];
    let from = 0;
    const limit = 1000;
    
    while (true) {
        const { data, error } = await supabase
            .from('organizations')
            .select('name')
            .range(from, from + limit - 1);
        
        if (error) throw error;
        if (!data || data.length === 0) break;
        
        allOrgs = allOrgs.concat(data);
        if (data.length < limit) break;
        from += limit;
    }
    
    return allOrgs;
}

/**
 * Normalizes a string for comparison:
 * - Trim whitespace
 * - Remove common suffixes like "בע"מ", "בעמ", "(", ")"
 * - Lowercase
 */
function normalizeName(name: string): string {
    if (!name) return '';
    return name
        .toLowerCase()
        .replace(/בע"מ/g, '')
        .replace(/בעמ/g, '')
        .replace(/[()\-"]/g, '')
        .trim()
        .replace(/\s+/g, ' ');
}

async function main() {
    console.log('Connecting to Supabase and loading files...');
    
    const dbOrgs = await fetchAllOrganizations();
    const orgsList = dbOrgs
        .map(org => ({ original: org.name, normalized: normalizeName(org.name) }))
        .filter(org => org.normalized.length > 2); // Avoid matching very short names

    console.log(`Loaded ${orgsList.length} organization names from database.`);

    const contacts = await loadCSV<Contact>(CONTACTS_FILE);
    const accounts = await loadCSV<Account>(ACCOUNTS_FILE);

    console.log(`Loaded ${contacts.length} contacts.`);
    console.log(`Loaded ${accounts.length} accounts.`);

    const emailToAccount = new Map<string, string>();
    const phoneToAccount = new Map<string, string>();

    accounts.forEach(acc => {
        if (acc.emailaddress1 && acc.emailaddress1.trim()) {
            emailToAccount.set(acc.emailaddress1.trim().toLowerCase(), acc.accountname);
        }
        if (acc.telephone1 && acc.telephone1.trim()) {
            phoneToAccount.set(acc.telephone1.trim(), acc.accountname);
        }
    });

    console.log('Enriching contacts with fuzzy matching...');

    const enrichedContacts = contacts.map(contact => {
        let matchedAccountName = '';
        
        // Match by email
        if (contact.email && contact.email.trim()) {
            matchedAccountName = emailToAccount.get(contact.email.trim().toLowerCase()) || '';
        }
        
        // Match by phone/mobile if email match failed
        if (!matchedAccountName) {
            if (contact.phone && contact.phone.trim()) {
                matchedAccountName = phoneToAccount.get(contact.phone.trim()) || '';
            }
            if (!matchedAccountName && contact.mobile && contact.mobile.trim()) {
                matchedAccountName = phoneToAccount.get(contact.mobile.trim()) || '';
            }
        }

        let matchedOrgName = '';
        if (matchedAccountName) {
            const normalizedMatch = normalizeName(matchedAccountName);
            
            // Try exact match first (normalized)
            let found = orgsList.find(org => org.normalized === normalizedMatch);
            
            // If not found, try "contains" logic
            if (!found && normalizedMatch.length > 2) {
                found = orgsList.find(org => 
                    org.normalized.includes(normalizedMatch) || 
                    normalizedMatch.includes(org.normalized)
                );
            }
            
            if (found) {
                matchedOrgName = found.original;
            }
        }

        return {
            ...contact,
            account_name: matchedAccountName,
            official_org_name: matchedOrgName
        };
    });

    console.log('Writing output...');
    
    const headers = ['id', 'name', 'email', 'phone', 'mobile', 'created_at', 'Account Name', 'Official Organization Name'];
    const csvRows = [
        headers.join(','),
        ...enrichedContacts.map(c => [
            c.id,
            escapeCSV(c.name),
            escapeCSV(c.email),
            escapeCSV(c.phone),
            escapeCSV(c.mobile),
            escapeCSV(c.created_at),
            escapeCSV(c.account_name),
            escapeCSV(c.official_org_name)
        ].join(','))
    ];

    fs.writeFileSync(CONTACTS_FILE, csvRows.join('\n'), 'utf8');
    
    console.log('Done! contacts_without_organization.csv has been updated with fuzzy matching.');
}

main().catch(err => {
    console.error('Error:', err);
});
