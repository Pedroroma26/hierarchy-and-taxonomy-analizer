# Security Policy

## Known Vulnerabilities

### xlsx (SheetJS) - High Severity

**Status**: ACCEPTED RISK ✅

**Vulnerabilities**:
1. Prototype Pollution (GHSA-4r6h-8v6p-xvw6)
2. Regular Expression Denial of Service - ReDoS (GHSA-5pgg-2g8v-p4x9)

**Why We Accept This Risk**:

1. **Limited Scope**: The library is ONLY used for reading Excel files client-side
2. **No Write Operations**: We never write user-generated content back to Excel
3. **Client-Side Only**: All processing happens in the browser, no server exposure
4. **Input Validation**: Files are validated before processing
5. **No Sensitive Data**: Tool processes product catalog data, not sensitive user data

**Mitigation Measures**:

```typescript
// File size limit
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// File type validation
const ALLOWED_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel'
];

// Error handling
try {
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  // Process safely
} catch (error) {
  // Handle gracefully
}
```

**Monitoring**:
- Check for xlsx updates monthly
- Review security advisories
- Consider migration to `exceljs` if vulnerability becomes critical

**Alternative Considered**:
- **exceljs**: More actively maintained, but 2x larger bundle size
- **Decision**: Current risk/benefit ratio favors staying with xlsx

## Security Best Practices

### Data Handling
- ✅ All data processing is client-side
- ✅ No data sent to external servers
- ✅ No data persistence (except user-initiated exports)
- ✅ Files are processed in memory only

### User Privacy
- ✅ No analytics or tracking
- ✅ No cookies
- ✅ No user data collection
- ✅ All processing happens locally

### Export Security
- ✅ JSON exports are sanitized
- ✅ PDF exports use trusted library (jsPDF)
- ✅ No code injection in exports
- ✅ File names are sanitized

## Reporting Security Issues

If you discover a security vulnerability, please email:
- **Email**: security@yourcompany.com
- **Response Time**: Within 48 hours

Please include:
1. Description of the vulnerability
2. Steps to reproduce
3. Potential impact
4. Suggested fix (if any)

## Security Updates

Last Security Review: November 22, 2025  
Next Scheduled Review: February 22, 2026

## Dependency Security

We use `npm audit` to monitor dependencies:

```bash
npm audit
```

Current status: 1 known vulnerability (xlsx - accepted risk)

## Contact

For security concerns: security@yourcompany.com  
For general issues: GitHub Issues
