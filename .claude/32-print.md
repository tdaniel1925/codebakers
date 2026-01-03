# Print & PDF Module
# PDF Generation, Print Stylesheets, Invoices, Reports, Certificates

---

## PDF Generation Options

| Library | Best For | Rendering |
|---------|----------|-----------|
| **React-PDF** | React-based PDFs | Custom renderer |
| **Puppeteer** | HTML to PDF | Headless Chrome |
| **jsPDF** | Simple PDFs | Canvas |
| **PDFKit** | Server-side Node | Stream-based |
| **html-pdf-node** | HTML templates | Chromium |

**Recommendation:** Use React-PDF for structured documents (invoices, reports). Use Puppeteer for complex HTML layouts.

---

## React-PDF Setup

```bash
npm install @react-pdf/renderer
```

### Basic Document

```tsx
// lib/pdf/invoice.tsx
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  Image,
} from '@react-pdf/renderer';

// Register custom fonts
Font.register({
  family: 'Inter',
  fonts: [
    { src: '/fonts/Inter-Regular.ttf', fontWeight: 400 },
    { src: '/fonts/Inter-Medium.ttf', fontWeight: 500 },
    { src: '/fonts/Inter-Bold.ttf', fontWeight: 700 },
  ],
});

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Inter',
    fontSize: 10,
    color: '#333',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 40,
  },
  logo: {
    width: 120,
    height: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    color: '#111',
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 8,
    color: '#111',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  label: {
    width: 100,
    color: '#666',
  },
  value: {
    flex: 1,
  },
  table: {
    marginTop: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    padding: 8,
    fontWeight: 700,
  },
  tableRow: {
    flexDirection: 'row',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  col1: { width: '40%' },
  col2: { width: '20%', textAlign: 'center' },
  col3: { width: '20%', textAlign: 'right' },
  col4: { width: '20%', textAlign: 'right' },
  totals: {
    marginTop: 20,
    alignItems: 'flex-end',
  },
  totalRow: {
    flexDirection: 'row',
    width: 200,
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  grandTotal: {
    fontWeight: 700,
    fontSize: 14,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 2,
    borderTopColor: '#333',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    color: '#999',
    fontSize: 8,
  },
});

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface InvoiceData {
  invoiceNumber: string;
  date: string;
  dueDate: string;
  company: {
    name: string;
    address: string;
    email: string;
    logoUrl?: string;
  };
  customer: {
    name: string;
    address: string;
    email: string;
  };
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  total: number;
  notes?: string;
}

export function InvoicePDF({ data }: { data: InvoiceData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            {data.company.logoUrl && (
              <Image src={data.company.logoUrl} style={styles.logo} />
            )}
            <Text style={styles.title}>INVOICE</Text>
            <Text style={styles.subtitle}>#{data.invoiceNumber}</Text>
          </View>
          <View style={{ textAlign: 'right' }}>
            <Text>{data.company.name}</Text>
            <Text style={{ color: '#666' }}>{data.company.address}</Text>
            <Text style={{ color: '#666' }}>{data.company.email}</Text>
          </View>
        </View>

        {/* Bill To / Invoice Details */}
        <View style={{ flexDirection: 'row', marginBottom: 30 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>Bill To</Text>
            <Text>{data.customer.name}</Text>
            <Text style={{ color: '#666' }}>{data.customer.address}</Text>
            <Text style={{ color: '#666' }}>{data.customer.email}</Text>
          </View>
          <View style={{ width: 200 }}>
            <View style={styles.row}>
              <Text style={styles.label}>Invoice Date:</Text>
              <Text style={styles.value}>{data.date}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Due Date:</Text>
              <Text style={styles.value}>{data.dueDate}</Text>
            </View>
          </View>
        </View>

        {/* Items Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.col1}>Description</Text>
            <Text style={styles.col2}>Qty</Text>
            <Text style={styles.col3}>Unit Price</Text>
            <Text style={styles.col4}>Total</Text>
          </View>
          {data.items.map((item, index) => (
            <View key={index} style={styles.tableRow}>
              <Text style={styles.col1}>{item.description}</Text>
              <Text style={styles.col2}>{item.quantity}</Text>
              <Text style={styles.col3}>${item.unitPrice.toFixed(2)}</Text>
              <Text style={styles.col4}>${item.total.toFixed(2)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text>Subtotal:</Text>
            <Text>${data.subtotal.toFixed(2)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text>Tax:</Text>
            <Text>${data.tax.toFixed(2)}</Text>
          </View>
          <View style={[styles.totalRow, styles.grandTotal]}>
            <Text>Total:</Text>
            <Text>${data.total.toFixed(2)}</Text>
          </View>
        </View>

        {/* Notes */}
        {data.notes && (
          <View style={{ marginTop: 40 }}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={{ color: '#666' }}>{data.notes}</Text>
          </View>
        )}

        {/* Footer */}
        <Text style={styles.footer}>
          Thank you for your business! Payment due within 30 days.
        </Text>
      </Page>
    </Document>
  );
}
```

### Generate & Download PDF

```tsx
// app/api/invoice/[id]/pdf/route.ts
import { renderToBuffer } from '@react-pdf/renderer';
import { InvoicePDF } from '@/lib/pdf/invoice';
import { getInvoice } from '@/lib/db/invoices';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const invoice = await getInvoice(params.id);

  if (!invoice) {
    return new Response('Invoice not found', { status: 404 });
  }

  const pdfBuffer = await renderToBuffer(<InvoicePDF data={invoice} />);

  return new Response(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`,
    },
  });
}

// Client-side download
export function DownloadInvoiceButton({ invoiceId }: { invoiceId: string }) {
  const handleDownload = async () => {
    const response = await fetch(`/api/invoice/${invoiceId}/pdf`);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `invoice-${invoiceId}.pdf`;
    a.click();

    URL.revokeObjectURL(url);
  };

  return (
    <button onClick={handleDownload}>
      Download PDF
    </button>
  );
}
```

### PDF Preview Component

```tsx
// components/pdf/preview.tsx
'use client';

import { PDFViewer } from '@react-pdf/renderer';
import { InvoicePDF } from '@/lib/pdf/invoice';

export function InvoicePreview({ data }: { data: InvoiceData }) {
  return (
    <PDFViewer width="100%" height="600px">
      <InvoicePDF data={data} />
    </PDFViewer>
  );
}
```

---

## Report PDF Template

```tsx
// lib/pdf/report.tsx
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
  },
  coverPage: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  coverSubtitle: {
    fontSize: 16,
    color: '#666',
  },
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  pageNumber: {
    position: 'absolute',
    bottom: 30,
    right: 40,
    fontSize: 10,
    color: '#999',
  },
  h1: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#111',
  },
  h2: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
    marginTop: 15,
    color: '#333',
  },
  paragraph: {
    fontSize: 10,
    lineHeight: 1.6,
    marginBottom: 10,
    color: '#444',
  },
  bulletList: {
    marginLeft: 15,
  },
  bulletItem: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  bullet: {
    width: 15,
    fontSize: 10,
  },
  chart: {
    width: '100%',
    height: 200,
    marginVertical: 20,
  },
});

interface ReportData {
  title: string;
  subtitle: string;
  date: string;
  author: string;
  sections: {
    title: string;
    content: string;
    bullets?: string[];
    chartImage?: string;
  }[];
}

export function ReportPDF({ data }: { data: ReportData }) {
  return (
    <Document>
      {/* Cover Page */}
      <Page size="A4" style={[styles.page, styles.coverPage]}>
        <Text style={styles.coverTitle}>{data.title}</Text>
        <Text style={styles.coverSubtitle}>{data.subtitle}</Text>
        <View style={{ marginTop: 40 }}>
          <Text style={{ fontSize: 12, color: '#666' }}>
            Prepared by: {data.author}
          </Text>
          <Text style={{ fontSize: 12, color: '#666', marginTop: 5 }}>
            Date: {data.date}
          </Text>
        </View>
      </Page>

      {/* Content Pages */}
      {data.sections.map((section, index) => (
        <Page key={index} size="A4" style={styles.page}>
          <View style={styles.pageHeader}>
            <Text style={{ fontSize: 10, color: '#666' }}>{data.title}</Text>
            <Text style={{ fontSize: 10, color: '#666' }}>{data.date}</Text>
          </View>

          <Text style={styles.h1}>{section.title}</Text>

          <Text style={styles.paragraph}>{section.content}</Text>

          {section.bullets && (
            <View style={styles.bulletList}>
              {section.bullets.map((bullet, i) => (
                <View key={i} style={styles.bulletItem}>
                  <Text style={styles.bullet}>•</Text>
                  <Text style={styles.paragraph}>{bullet}</Text>
                </View>
              ))}
            </View>
          )}

          {section.chartImage && (
            <Image src={section.chartImage} style={styles.chart} />
          )}

          <Text
            style={styles.pageNumber}
            render={({ pageNumber, totalPages }) =>
              `${pageNumber} / ${totalPages}`
            }
          />
        </Page>
      ))}
    </Document>
  );
}
```

---

## Puppeteer HTML to PDF

```bash
npm install puppeteer
```

```typescript
// lib/pdf/puppeteer.ts
import puppeteer from 'puppeteer';

interface PDFOptions {
  html: string;
  format?: 'A4' | 'Letter' | 'Legal';
  landscape?: boolean;
  margin?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
  headerTemplate?: string;
  footerTemplate?: string;
}

export async function generatePDFFromHTML({
  html,
  format = 'A4',
  landscape = false,
  margin = { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
  headerTemplate,
  footerTemplate,
}: PDFOptions): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();

    await page.setContent(html, {
      waitUntil: 'networkidle0',
    });

    const pdfBuffer = await page.pdf({
      format,
      landscape,
      margin,
      printBackground: true,
      displayHeaderFooter: !!(headerTemplate || footerTemplate),
      headerTemplate: headerTemplate || '<span></span>',
      footerTemplate:
        footerTemplate ||
        '<div style="width:100%;text-align:center;font-size:10px;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

// Usage
const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; padding: 40px; }
    h1 { color: #333; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 8px; border: 1px solid #ddd; }
  </style>
</head>
<body>
  <h1>Sales Report</h1>
  <table>
    <tr><th>Product</th><th>Sales</th></tr>
    <tr><td>Widget A</td><td>$10,000</td></tr>
    <tr><td>Widget B</td><td>$15,000</td></tr>
  </table>
</body>
</html>
`;

const pdf = await generatePDFFromHTML({ html });
```

---

## Print Stylesheets

```css
/* globals.css */

/* Print-specific styles */
@media print {
  /* Hide non-printable elements */
  .no-print,
  nav,
  footer,
  .sidebar,
  button,
  .toast {
    display: none !important;
  }

  /* Reset background colors */
  body {
    background: white !important;
    color: black !important;
  }

  /* Ensure content fills page */
  .print-content {
    width: 100% !important;
    max-width: none !important;
    margin: 0 !important;
    padding: 0 !important;
  }

  /* Page breaks */
  .page-break-before {
    page-break-before: always;
  }

  .page-break-after {
    page-break-after: always;
  }

  .avoid-break {
    page-break-inside: avoid;
  }

  /* Links */
  a[href]::after {
    content: " (" attr(href) ")";
    font-size: 0.8em;
    color: #666;
  }

  a[href^="#"]::after,
  a[href^="javascript"]::after {
    content: "";
  }

  /* Tables */
  table {
    border-collapse: collapse;
  }

  thead {
    display: table-header-group; /* Repeat header on each page */
  }

  tr {
    page-break-inside: avoid;
  }

  /* Images */
  img {
    max-width: 100% !important;
    page-break-inside: avoid;
  }

  /* Page margins */
  @page {
    margin: 2cm;
  }

  @page :first {
    margin-top: 3cm;
  }
}
```

### Print Button Component

```tsx
// components/print-button.tsx
'use client';

import { Printer } from 'lucide-react';

export function PrintButton() {
  const handlePrint = () => {
    window.print();
  };

  return (
    <button
      onClick={handlePrint}
      className="inline-flex items-center gap-2 px-4 py-2 border rounded-lg no-print"
    >
      <Printer className="h-4 w-4" />
      Print
    </button>
  );
}
```

### Print-Optimized Page

```tsx
// app/invoice/[id]/print/page.tsx
import { getInvoice } from '@/lib/db/invoices';
import { PrintButton } from '@/components/print-button';

export default async function PrintInvoicePage({
  params,
}: {
  params: { id: string };
}) {
  const invoice = await getInvoice(params.id);

  return (
    <>
      <div className="no-print p-4 border-b">
        <PrintButton />
      </div>

      <div className="print-content p-8 max-w-3xl mx-auto">
        {/* Invoice header */}
        <div className="flex justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">INVOICE</h1>
            <p className="text-gray-600">#{invoice.number}</p>
          </div>
          <div className="text-right">
            <p className="font-bold">{invoice.company.name}</p>
            <p className="text-gray-600">{invoice.company.address}</p>
          </div>
        </div>

        {/* Bill to */}
        <div className="mb-8 avoid-break">
          <h2 className="font-bold mb-2">Bill To:</h2>
          <p>{invoice.customer.name}</p>
          <p className="text-gray-600">{invoice.customer.address}</p>
        </div>

        {/* Items table */}
        <table className="w-full mb-8">
          <thead>
            <tr className="border-b-2">
              <th className="text-left py-2">Description</th>
              <th className="text-center py-2">Qty</th>
              <th className="text-right py-2">Price</th>
              <th className="text-right py-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, i) => (
              <tr key={i} className="border-b">
                <td className="py-2">{item.description}</td>
                <td className="text-center py-2">{item.quantity}</td>
                <td className="text-right py-2">${item.price}</td>
                <td className="text-right py-2">${item.total}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end avoid-break">
          <div className="w-48">
            <div className="flex justify-between py-1">
              <span>Subtotal:</span>
              <span>${invoice.subtotal}</span>
            </div>
            <div className="flex justify-between py-1">
              <span>Tax:</span>
              <span>${invoice.tax}</span>
            </div>
            <div className="flex justify-between py-2 border-t-2 font-bold text-lg">
              <span>Total:</span>
              <span>${invoice.total}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
```

---

## Certificate Template

```tsx
// lib/pdf/certificate.tsx
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 50,
    backgroundColor: '#fff',
  },
  border: {
    border: '3px solid #1a365d',
    padding: 40,
    height: '100%',
  },
  innerBorder: {
    border: '1px solid #2c5282',
    padding: 30,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#1a365d',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#4a5568',
    marginBottom: 30,
  },
  presented: {
    fontSize: 12,
    color: '#718096',
    marginBottom: 10,
  },
  recipientName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 20,
    fontStyle: 'italic',
  },
  description: {
    fontSize: 12,
    color: '#4a5568',
    textAlign: 'center',
    maxWidth: 400,
    lineHeight: 1.6,
    marginBottom: 40,
  },
  signatures: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 400,
    marginTop: 40,
  },
  signatureBlock: {
    alignItems: 'center',
  },
  signatureLine: {
    width: 150,
    borderBottomWidth: 1,
    borderBottomColor: '#a0aec0',
    marginBottom: 5,
  },
  signatureLabel: {
    fontSize: 10,
    color: '#718096',
  },
  date: {
    fontSize: 10,
    color: '#718096',
    marginTop: 30,
  },
});

interface CertificateData {
  recipientName: string;
  courseName: string;
  completionDate: string;
  instructorName: string;
  organizationName: string;
  logoUrl?: string;
}

export function CertificatePDF({ data }: { data: CertificateData }) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.border}>
          <View style={styles.innerBorder}>
            {data.logoUrl && (
              <Image
                src={data.logoUrl}
                style={{ width: 80, height: 80, marginBottom: 20 }}
              />
            )}

            <Text style={styles.title}>Certificate</Text>
            <Text style={styles.subtitle}>of Completion</Text>

            <Text style={styles.presented}>This is to certify that</Text>

            <Text style={styles.recipientName}>{data.recipientName}</Text>

            <Text style={styles.description}>
              has successfully completed the course "{data.courseName}"
              demonstrating proficiency and dedication to professional development.
            </Text>

            <View style={styles.signatures}>
              <View style={styles.signatureBlock}>
                <View style={styles.signatureLine} />
                <Text style={styles.signatureLabel}>{data.instructorName}</Text>
                <Text style={styles.signatureLabel}>Instructor</Text>
              </View>
              <View style={styles.signatureBlock}>
                <View style={styles.signatureLine} />
                <Text style={styles.signatureLabel}>{data.organizationName}</Text>
                <Text style={styles.signatureLabel}>Organization</Text>
              </View>
            </View>

            <Text style={styles.date}>
              Issued on {data.completionDate}
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
```

---

## Chart Images for PDFs

```tsx
// lib/pdf/chart-image.ts
// Convert Recharts to image for PDF embedding

import { renderToString } from 'react-dom/server';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from 'recharts';

export async function chartToDataURL(
  ChartComponent: React.ReactElement
): Promise<string> {
  // For server-side, use puppeteer to render chart
  const puppeteer = await import('puppeteer');
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <script src="https://unpkg.com/react/umd/react.production.min.js"></script>
      <script src="https://unpkg.com/recharts/umd/Recharts.min.js"></script>
    </head>
    <body>
      <div id="chart" style="width: 600px; height: 300px;"></div>
    </body>
    </html>
  `;

  await page.setContent(html);

  // Render chart and capture as image
  const chartElement = await page.$('#chart');
  const screenshot = await chartElement?.screenshot({
    type: 'png',
    encoding: 'base64',
  });

  await browser.close();

  return `data:image/png;base64,${screenshot}`;
}
```

---

## Quality Checklist

Before shipping:
- [ ] PDFs render correctly on different viewers
- [ ] Custom fonts are embedded
- [ ] Images are optimized for PDF size
- [ ] Page breaks are logical
- [ ] Headers/footers appear on all pages
- [ ] Print stylesheet hides interactive elements
- [ ] Links are visible in print
- [ ] Tables don't break awkwardly
- [ ] Large documents paginate properly
- [ ] File sizes are reasonable (<5MB for most)
