import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import ExcelJS from 'exceljs';

export type MobileExportColumn = {
  header: string;
  key: string;
  format?: (value: unknown, row: Record<string, unknown>) => string;
};

export class MobileExportService {
  private static instance: MobileExportService;

  private constructor() {}

  public static getInstance(): MobileExportService {
    if (!MobileExportService.instance) {
      MobileExportService.instance = new MobileExportService();
    }
    return MobileExportService.instance;
  }

  private resolveCellValue(row: Record<string, unknown>, col: MobileExportColumn): string {
    const rawVal = col.key.includes('.')
      ? col.key
          .split('.')
          .reduce<unknown>(
            (acc, part) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[part] : undefined),
            row
          )
      : row[col.key];

    if (col.format) {
      return col.format(rawVal, row);
    }
    if (rawVal === null || rawVal === undefined) {
      return '';
    }
    if (typeof rawVal === 'object') {
      return JSON.stringify(rawVal);
    }
    return String(rawVal);
  }

  public async exportToCsv(
    filename: string,
    columns: MobileExportColumn[],
    data: Record<string, unknown>[]
  ): Promise<void> {
    const headers = columns.map((c) => `"${c.header.replace(/"/g, '""')}"`).join(',');
    const rows = data.map((row) =>
      columns
        .map((c) => {
          const val = this.resolveCellValue(row, c);
          return `"${val.replace(/"/g, '""')}"`;
        })
        .join(',')
    );

    const csvContent = '\uFEFF' + [headers, ...rows].join('\r\n');
    const safeName = filename.replace(/\.csv$/i, '');
    const fileUri = `${FileSystem.cacheDirectory || ''}${safeName}.csv`;

    await FileSystem.writeAsStringAsync(fileUri, csvContent, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/csv',
        dialogTitle: `Export ${safeName}.csv`,
        UTI: 'public.comma-separated-values-text',
      });
    }
  }

  public async exportToExcel(
    filename: string,
    sheetName: string,
    columns: MobileExportColumn[],
    data: Record<string, unknown>[]
  ): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(sheetName.slice(0, 31));

    worksheet.columns = columns.map((col) => ({
      header: col.header,
      key: col.key,
      width: Math.max(col.header.length + 4, 15),
    }));

    data.forEach((row) => {
      const rowObj: Record<string, string> = {};
      columns.forEach((col) => {
        rowObj[col.key] = this.resolveCellValue(row, col);
      });
      worksheet.addRow(rowObj);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);

    const safeName = filename.replace(/\.xlsx$/i, '');
    const fileUri = `${FileSystem.cacheDirectory || ''}${safeName}.xlsx`;

    await FileSystem.writeAsStringAsync(fileUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: `Export ${safeName}.xlsx`,
        UTI: 'org.openxmlformats.spreadsheetml.sheet',
      });
    }
  }

  public async exportToDocument(
    filename: string,
    title: string,
    periodLabel: string,
    columns: MobileExportColumn[],
    data: Record<string, unknown>[]
  ): Promise<void> {
    const headerLine = columns.map((c) => c.header).join(' | ');
    const divider = '-'.repeat(Math.max(headerLine.length, 40));

    const content = [
      '=======================================================',
      'OURLIME ADMINISTRATION AUDIT REPORT',
      '=======================================================',
      `Title: ${title}`,
      `Generated: ${new Date().toLocaleString()}`,
      `Period: ${periodLabel}`,
      `Total Records: ${data.length}`,
      divider,
      headerLine,
      divider,
      ...data.map((row) => columns.map((c) => this.resolveCellValue(row, c)).join(' | ')),
      '=======================================================',
    ].join('\r\n');

    const safeName = filename.replace(/\.txt$/i, '');
    const fileUri = `${FileSystem.cacheDirectory || ''}${safeName}.txt`;

    await FileSystem.writeAsStringAsync(fileUri, content, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/plain',
        dialogTitle: `Export ${safeName}.txt`,
        UTI: 'public.plain-text',
      });
    }
  }
}

export const mobileExportService = MobileExportService.getInstance();
