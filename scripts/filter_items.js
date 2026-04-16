const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'order_items.csv');
const tempPath = path.join(__dirname, 'order_items_filtered.csv');

console.log('Starting to filter order_items.csv...');

const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

if (lines.length === 0) {
    console.error('File is empty.');
    process.exit(1);
}

const header = lines[0];
const headers = header.split(',');
const orderIdNameIndex = headers.indexOf('crmorderidname');

if (orderIdNameIndex === -1) {
    console.error('Column crmorderidname not found in header.');
    process.exit(1);
}

// Function to parse CSV line correctly handling quotes
function parseCsvLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);
    return result;
}

const filteredLines = [header];
let deletedCount = 0;
let keptCount = 0;

for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Quick check before heavy parsing if possible, or just parse
    const columns = parseCsvLine(line);
    const orderIdValue = parseInt(columns[orderIdNameIndex]);

    if (!isNaN(orderIdValue) && orderIdValue >= 7588) {
        filteredLines.push(lines[i]);
        keptCount++;
    } else {
        deletedCount++;
    }
}

fs.writeFileSync(filePath, filteredLines.join('\n'));

console.log(`Finish! Kept ${keptCount} records, deleted ${deletedCount} records.`);
