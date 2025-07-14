#!/usr/bin/env node

// Script to remove all toast notifications from the codebase
const fs = require('fs');
const path = require('path');

function removeToastFromFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Remove toast imports
  const toastImportPatterns = [
    /import\s+{\s*toast\s*}\s+from\s+['"](.*sonner.*)['"]\s*;?\s*\n?/g,
    /import\s+{\s*useToast[^}]*}\s+from\s+['"](.*use-toast.*)['"]\s*;?\s*\n?/g,
    /import\s+{\s*[^}]*toast[^}]*}\s+from\s+['"](.*)['"]\s*;?\s*\n?/g,
  ];

  toastImportPatterns.forEach(pattern => {
    if (pattern.test(content)) {
      content = content.replace(pattern, '');
      modified = true;
    }
  });

  // Remove useToast hook declarations
  const useToastPatterns = [
    /const\s+{\s*toast[^}]*}\s*=\s*useToast\(\)\s*;?\s*\n?/g,
  ];

  useToastPatterns.forEach(pattern => {
    if (pattern.test(content)) {
      content = content.replace(pattern, '');
      modified = true;
    }
  });

  // Remove toast function calls
  const toastCallPatterns = [
    /toast\.[a-zA-Z]+\([^;]*\)\s*;?\s*\n?/g,
    /toast\(\s*{[^}]*}\s*\)\s*;?\s*\n?/g,
    /showSuccessToast\([^)]*\)\s*;?\s*\n?/g,
    /triggerCardPulse\([^)]*\)\s*;?\s*\n?/g,
    /showConnectionSuccessToast\([^)]*\)\s*;?\s*\n?/g,
  ];

  toastCallPatterns.forEach(pattern => {
    if (pattern.test(content)) {
      content = content.replace(pattern, '');
      modified = true;
    }
  });

  if (modified) {
    // Clean up empty lines
    content = content.replace(/\n\s*\n\s*\n/g, '\n\n');
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Modified: ${filePath}`);
  }
}

// Find all TypeScript/JavaScript files in src
function findFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      files.push(...findFiles(fullPath));
    } else if (item.endsWith('.ts') || item.endsWith('.tsx') || item.endsWith('.js') || item.endsWith('.jsx')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

const srcFiles = findFiles('src');
srcFiles.forEach(removeToastFromFile);

console.log('Toast removal complete!');