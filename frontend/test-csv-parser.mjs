import Papa from 'papaparse';

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;

class CsvParseError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CsvParseError';
  }
}

function validateCsvFile(file) {
  if (!file) throw new CsvParseError('No file selected.');
  const isCsvExtension = file.name.toLowerCase().endsWith('.csv');
  const isCsvMime = file.type === 'text/csv' || file.type === 'application/vnd.ms-excel' || file.type === 'text/plain';
  if (!isCsvExtension && !isCsvMime) {
    throw new CsvParseError('Invalid file format. Please upload a valid .csv file.');
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new CsvParseError('File exceeds maximum allowed size of 15 MB.');
  }
}

async function parseCsvFile(file) {
  validateCsvFile(file);
  return new Promise((resolve, reject) => {
    // In Node.js testing environment without browser FileReader, pass the string directly to Papa.parse
    const input = typeof file.content === 'string' ? file.content : file;
    Papa.parse(input, {
      header: true,
      skipEmptyLines: 'greedy',
      complete: (results) => {
        if (!results.data || results.data.length === 0) {
          reject(new CsvParseError('The uploaded CSV file contains no data rows.'));
          return;
        }
        if (results.errors && results.errors.length > 0) {
          const firstError = results.errors[0];
          if (results.data.length === 0 || firstError.type === 'Delimiter' || firstError.code === 'UndetectableDelimiter') {
            reject(new CsvParseError(`Failed to parse CSV: ${firstError.message} (Row ${firstError.row ?? 'unknown'})`));
            return;
          }
        }
        const columns = results.meta.fields || Object.keys(results.data[0] || {});
        if (columns.length === 0) {
          reject(new CsvParseError('The uploaded CSV file contains no column headers.'));
          return;
        }
        resolve({
          rows: results.data,
          meta: {
            filename: file.name,
            sizeBytes: file.size,
            totalRows: results.data.length,
            columns,
            detectedDelimiter: results.meta.delimiter || ',',
          },
        });
      },
      error: (error) => reject(new CsvParseError(`Failed to parse CSV: ${error.message}`)),
    });
  });
}

// Mock File object for Node test
class MockFile {
  constructor(content, name, options = {}) {
    this.content = content;
    this.name = name;
    this.type = options.type || 'text/csv';
    this.size = Buffer.byteLength(content, 'utf8');
  }
}

async function runTests() {
  console.log('--- Running SPEC-0002 CSV Parser Edge Case Tests ---');
  let passed = 0;
  let failed = 0;

  // Test 1: Valid CSV file
  try {
    const file = new MockFile('Name,Email,Phone\nJohn Doe,john@example.com,555-0199\nJane Smith,jane@example.com,555-0200', 'leads.csv');
    const { rows, meta } = await parseCsvFile(file);
    if (rows.length === 2 && meta.columns.length === 3 && meta.detectedDelimiter === ',') {
      console.log('✔ Test 1 passed: Valid CSV parsing & metadata extraction.');
      passed++;
    } else {
      console.error('✖ Test 1 failed: Incorrect rows or metadata.');
      failed++;
    }
  } catch (err) {
    console.error('✖ Test 1 failed with unexpected error:', err.message);
    failed++;
  }

  // Test 2: Invalid file extension (.pdf)
  try {
    const file = new MockFile('fake pdf content', 'report.pdf', { type: 'application/pdf' });
    await parseCsvFile(file);
    console.error('✖ Test 2 failed: Expected CsvParseError for .pdf extension.');
    failed++;
  } catch (err) {
    if (err.message.includes('Invalid file format')) {
      console.log('✔ Test 2 passed: Successfully rejected .pdf extension.');
      passed++;
    } else {
      console.error('✖ Test 2 failed with wrong error:', err.message);
      failed++;
    }
  }

  // Test 3: File exceeding 15 MB limit
  try {
    const largeFile = { name: 'huge.csv', type: 'text/csv', size: 16 * 1024 * 1024 };
    validateCsvFile(largeFile);
    console.error('✖ Test 3 failed: Expected CsvParseError for >15 MB file.');
    failed++;
  } catch (err) {
    if (err.message.includes('15 MB')) {
      console.log('✔ Test 3 passed: Successfully rejected >15 MB file.');
      passed++;
    } else {
      console.error('✖ Test 3 failed with wrong error:', err.message);
      failed++;
    }
  }

  // Test 4: Empty CSV (or only headers)
  try {
    const file = new MockFile('Name,Email,Phone\n', 'empty.csv');
    await parseCsvFile(file);
    console.error('✖ Test 4 failed: Expected error for empty CSV.');
    failed++;
  } catch (err) {
    if (err.message.includes('contains no data rows')) {
      console.log('✔ Test 4 passed: Successfully rejected CSV with no data rows.');
      passed++;
    } else {
      console.error('✖ Test 4 failed with wrong error:', err.message);
      failed++;
    }
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

runTests();
