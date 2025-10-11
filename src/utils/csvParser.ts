/**
 * Parses a CSV line handling quoted fields and various delimiters
 */
export const parseCSVLine = (line: string, delimiter: string = ','): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      // Field separator
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  // Push the last field
  result.push(current.trim());
  
  return result;
};

/**
 * Detects the delimiter used in a CSV file
 */
export const detectDelimiter = (text: string): string => {
  const firstLine = text.split(/\r?\n/)[0];
  const delimiters = [',', ';', '\t', '|'];
  
  let maxCount = 0;
  let detectedDelimiter = ',';
  
  for (const delimiter of delimiters) {
    const count = firstLine.split(delimiter).length;
    if (count > maxCount) {
      maxCount = count;
      detectedDelimiter = delimiter;
    }
  }
  
  return detectedDelimiter;
};

/**
 * Validates email format
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Auto-detects field mapping based on column headers
 */
export const autoDetectFieldMapping = (headers: string[]): Record<string, string> => {
  const mapping: Record<string, string> = {};
  
  const fieldPatterns = {
    email: /^(email|e[-_]?mail|customer[-_]?email|contact[-_]?email|mail)$/i,
    first_name: /^(first[-_]?name|fname|given[-_]?name|first|forename)$/i,
    last_name: /^(last[-_]?name|lname|surname|last|family[-_]?name)$/i,
    phone: /^(phone|telephone|cell|mobile|phone[-_]?number|tel)$/i,
    tags: /^(tags|interests|categories|labels)$/i,
    persona: /^(persona|customer[-_]?type|segment|category|segment)$/i,
    sms_opt_in: /^(sms[-_]?opt[-_]?in|sms[-_]?consent|text[-_]?marketing|sms)$/i,
  };
  
  headers.forEach(header => {
    const normalizedHeader = header.toLowerCase().trim();
    
    for (const [field, pattern] of Object.entries(fieldPatterns)) {
      if (pattern.test(normalizedHeader)) {
        mapping[header] = field;
        break;
      }
    }
    
    // Default to skip if not matched
    if (!mapping[header]) {
      mapping[header] = 'skip';
    }
  });
  
  return mapping;
};

export interface ParsedCSVData {
  headers: string[];
  dataRows: string[][];
  sampleData: { header: string; samples: string[] }[];
  delimiter: string;
}

/**
 * Parses a CSV file and extracts headers, data, and sample data
 * Treats all rows as data with generic column names for maximum flexibility
 */
export const parseCSVFile = async (file: File): Promise<ParsedCSVData> => {
  const text = await file.text();
  
  // Detect delimiter
  const delimiter = detectDelimiter(text);
  
  // Parse all lines as data
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  
  if (lines.length === 0) {
    throw new Error('CSV file is empty');
  }
  
  // Parse all lines as data rows (no header assumption)
  const dataRows = lines
    .map(line => parseCSVLine(line, delimiter))
    .filter(row => row.some(cell => cell.trim()));
  
  if (dataRows.length === 0) {
    throw new Error('CSV file contains no data');
  }
  
  // Generate generic column names based on first row's column count
  const columnCount = dataRows[0].length;
  const headers = Array.from({ length: columnCount }, (_, i) => `Column ${i + 1}`);
  
  // Extract sample data (first 5 rows including what might be headers)
  const sampleData = headers.map((header, index) => ({
    header,
    samples: dataRows.slice(0, 5).map(row => row[index] || '')
  }));
  
  return {
    headers,
    dataRows,
    sampleData,
    delimiter
  };
};

/**
 * Generates a sample CSV template
 */
export const generateCSVTemplate = (): string => {
  const headers = ['Email', 'First Name', 'Last Name', 'Phone', 'Tags', 'Persona', 'SMS Opt-In'];
  const sampleRows = [
    ['john.doe@example.com', 'Jane', 'Doe', '+1234567890', 'vip,premium', 'High Value', 'yes'],
    ['jane.smith@example.com', 'Jane', 'Smith', '+1987654321', 'new', 'New Customer', 'no'],
    ['bob.wilson@example.com', 'Bob', 'Wilson', '', 'frequent', 'Frequent Buyer', 'yes']
  ];
  
  const csvContent = [
    headers.join(','),
    ...sampleRows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');
  
  return csvContent;
};
