# DOCUMENT GENERATION
# Module: 06e-documents.md
# Load with: 00-core.md
# Covers: PDF, Excel, Word document generation

---

## PDF GENERATION

### Using @react-pdf/renderer

```typescript
// lib/pdf/templates/invoice.tsx
import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer';

// Register fonts if needed
Font.register({
  family: 'Inter',
  src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hjp-Ek-_EeA.woff2',
});

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  table: {
    width: '100%',
    marginTop: 20,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
    paddingVertical: 8,
  },
  tableHeader: {
    backgroundColor: '#f5f5f5',
    fontWeight: 'bold',
  },
  tableCell: {
    flex: 1,
  },
  total: {
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  totalLabel: {
    fontWeight: 'bold',
    marginRight: 20,
  },
  totalValue: {
    fontWeight: 'bold',
  },
});

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

interface InvoiceData {
  invoiceNumber: string;
  date: string;
  dueDate: string;
  clientName: string;
  clientAddress: string;
  items: InvoiceItem[];
  notes?: string;
}

export function InvoicePDF({ data }: { data: InvoiceData }) {
  const total = data.items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>INVOICE</Text>
            <Text>Invoice #{data.invoiceNumber}</Text>
          </View>
          <View>
            <Text>Date: {data.date}</Text>
            <Text>Due: {data.dueDate}</Text>
          </View>
        </View>

        {/* Client Info */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontWeight: 'bold' }}>Bill To:</Text>
          <Text>{data.clientName}</Text>
          <Text>{data.clientAddress}</Text>
        </View>

        {/* Items Table */}
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={[styles.tableCell, { flex: 3 }]}>Description</Text>
            <Text style={styles.tableCell}>Qty</Text>
            <Text style={styles.tableCell}>Price</Text>
            <Text style={styles.tableCell}>Total</Text>
          </View>

          {data.items.map((item, index) => (
            <View key={index} style={styles.tableRow}>
              <Text style={[styles.tableCell, { flex: 3 }]}>
                {item.description}
              </Text>
              <Text style={styles.tableCell}>{item.quantity}</Text>
              <Text style={styles.tableCell}>${item.unitPrice.toFixed(2)}</Text>
              <Text style={styles.tableCell}>
                ${(item.quantity * item.unitPrice).toFixed(2)}
              </Text>
            </View>
          ))}
        </View>

        {/* Total */}
        <View style={styles.total}>
          <Text style={styles.totalLabel}>Total:</Text>
          <Text style={styles.totalValue}>${total.toFixed(2)}</Text>
        </View>

        {/* Notes */}
        {data.notes && (
          <View style={{ marginTop: 40 }}>
            <Text style={{ fontWeight: 'bold' }}>Notes:</Text>
            <Text>{data.notes}</Text>
          </View>
        )}
      </Page>
    </Document>
  );
}
```

### PDF Generation API

```typescript
// app/api/pdf/invoice/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { InvoicePDF } from '@/lib/pdf/templates/invoice';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const invoiceSchema = z.object({
  invoiceNumber: z.string(),
  date: z.string(),
  dueDate: z.string(),
  clientName: z.string(),
  clientAddress: z.string(),
  items: z.array(
    z.object({
      description: z.string(),
      quantity: z.number(),
      unitPrice: z.number(),
    })
  ),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const result = invoiceSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid invoice data', details: result.error.flatten() },
        { status: 400 }
      );
    }

    const pdfBuffer = await renderToBuffer(
      <InvoicePDF data={result.data} />
    );

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${result.data.invoiceNumber}.pdf"`,
      },
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}
```

---

## EXCEL GENERATION

### Using ExcelJS

```typescript
// lib/excel/generators.ts
import ExcelJS from 'exceljs';

interface ReportRow {
  date: string;
  description: string;
  amount: number;
  category: string;
}

export async function generateExpenseReport(
  data: ReportRow[],
  title: string
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Your App';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Expense Report');

  // Title
  sheet.mergeCells('A1:D1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = title;
  titleCell.font = { size: 16, bold: true };
  titleCell.alignment = { horizontal: 'center' };

  // Headers
  sheet.addRow([]);
  const headerRow = sheet.addRow(['Date', 'Description', 'Amount', 'Category']);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };
    cell.border = {
      bottom: { style: 'thin' },
    };
  });

  // Data rows
  data.forEach((row) => {
    const dataRow = sheet.addRow([
      row.date,
      row.description,
      row.amount,
      row.category,
    ]);

    // Format amount as currency
    dataRow.getCell(3).numFmt = '$#,##0.00';
  });

  // Total row
  const totalRow = sheet.addRow([
    '',
    'Total',
    { formula: `SUM(C4:C${3 + data.length})` },
    '',
  ]);
  totalRow.getCell(2).font = { bold: true };
  totalRow.getCell(3).font = { bold: true };
  totalRow.getCell(3).numFmt = '$#,##0.00';

  // Column widths
  sheet.columns = [
    { width: 12 },
    { width: 40 },
    { width: 15 },
    { width: 20 },
  ];

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
```

### Excel API Route

```typescript
// app/api/excel/expense-report/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { generateExpenseReport } from '@/lib/excel/generators';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const reportSchema = z.object({
  title: z.string(),
  data: z.array(
    z.object({
      date: z.string(),
      description: z.string(),
      amount: z.number(),
      category: z.string(),
    })
  ),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const result = reportSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid report data' },
        { status: 400 }
      );
    }

    const excelBuffer = await generateExpenseReport(
      result.data.data,
      result.data.title
    );

    return new NextResponse(excelBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="expense-report.xlsx"',
      },
    });
  } catch (error) {
    console.error('Excel generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate Excel file' },
      { status: 500 }
    );
  }
}
```

---

## WORD DOCUMENT GENERATION

### Using docx

```typescript
// lib/docx/generators.ts
import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  Packer,
} from 'docx';

interface ProposalData {
  clientName: string;
  projectName: string;
  date: string;
  sections: {
    title: string;
    content: string;
  }[];
  pricing: {
    item: string;
    price: number;
  }[];
}

export async function generateProposal(data: ProposalData): Promise<Buffer> {
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          // Title
          new Paragraph({
            text: 'PROJECT PROPOSAL',
            heading: HeadingLevel.TITLE,
            spacing: { after: 400 },
          }),

          // Client info
          new Paragraph({
            children: [
              new TextRun({ text: 'Prepared for: ', bold: true }),
              new TextRun(data.clientName),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Project: ', bold: true }),
              new TextRun(data.projectName),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Date: ', bold: true }),
              new TextRun(data.date),
            ],
            spacing: { after: 400 },
          }),

          // Sections
          ...data.sections.flatMap((section) => [
            new Paragraph({
              text: section.title,
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 400, after: 200 },
            }),
            new Paragraph({
              text: section.content,
              spacing: { after: 200 },
            }),
          ]),

          // Pricing table
          new Paragraph({
            text: 'Pricing',
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ text: 'Item', bold: true })],
                    shading: { fill: 'E0E0E0' },
                  }),
                  new TableCell({
                    children: [new Paragraph({ text: 'Price', bold: true })],
                    shading: { fill: 'E0E0E0' },
                  }),
                ],
              }),
              ...data.pricing.map(
                (item) =>
                  new TableRow({
                    children: [
                      new TableCell({
                        children: [new Paragraph(item.item)],
                      }),
                      new TableCell({
                        children: [
                          new Paragraph(`$${item.price.toLocaleString()}`),
                        ],
                      }),
                    ],
                  })
              ),
              new TableRow({
                children: [
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [new TextRun({ text: 'Total', bold: true })],
                      }),
                    ],
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: `$${data.pricing
                              .reduce((sum, item) => sum + item.price, 0)
                              .toLocaleString()}`,
                            bold: true,
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return buffer;
}
```

### Word API Route

```typescript
// app/api/docx/proposal/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { generateProposal } from '@/lib/docx/generators';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const proposalSchema = z.object({
  clientName: z.string(),
  projectName: z.string(),
  date: z.string(),
  sections: z.array(
    z.object({
      title: z.string(),
      content: z.string(),
    })
  ),
  pricing: z.array(
    z.object({
      item: z.string(),
      price: z.number(),
    })
  ),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const result = proposalSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid proposal data' },
        { status: 400 }
      );
    }

    const docxBuffer = await generateProposal(result.data);

    return new NextResponse(docxBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': 'attachment; filename="proposal.docx"',
      },
    });
  } catch (error) {
    console.error('DOCX generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate document' },
      { status: 500 }
    );
  }
}
```

---

## Dependencies

```json
{
  "@react-pdf/renderer": "^3.1.0",
  "exceljs": "^4.3.0",
  "docx": "^8.2.0"
}
```

---
