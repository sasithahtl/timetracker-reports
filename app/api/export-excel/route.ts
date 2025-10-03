import { NextRequest, NextResponse } from 'next/server';

type ExportPayload = {
  dateFrom: string;
  dateTo: string;
  clientRate: number;
  users: { id: number; name: string }[];
  perUserIncomeHours: Record<number, number>;
  perUserCostHours: Record<number, number>;
  userRates: Record<number, number>;
  otherIncomes: { description: string; amount: number }[];
  expenses: { description: string; amount: number }[];
  selectedProjectNames: string[];
};

export async function POST(req: NextRequest) {
  try {
    const payload = (await req.json()) as ExportPayload;
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    wb.creator = 'SBOS TimeTracker';
    wb.created = new Date();

    const wsSummary = wb.addWorksheet('Summary');
    const wsUsers = wb.addWorksheet('Users');
    const wsOther = wb.addWorksheet('Other Incomes');
    const wsExp = wb.addWorksheet('Expenses');

    // Users sheet
    wsUsers.addRow(['Name', 'Income Hours', 'Rate ($/hr)', 'Cost ($) = IncomeHours*Rate', 'All Hours (Cost)']);
    payload.users.forEach(u => {
      const incomeHours = payload.perUserIncomeHours[u.id] || 0;
      const rate = payload.userRates[u.id] || 0;
      const costHours = payload.perUserCostHours[u.id] || 0;
      const row = wsUsers.addRow([u.name, incomeHours, rate, null, costHours]);
      const r = row.number;
      // D{r} = B{r} * C{r}
      wsUsers.getCell(`D${r}`).value = { formula: `B${r}*C${r}` } as unknown as string | number;
    });

    // Other incomes
    wsOther.addRow(['Description', 'Amount']);
    (payload.otherIncomes || []).forEach(r => wsOther.addRow([r.description || '', Number(r.amount) || 0]));

    // Expenses
    wsExp.addRow(['Description', 'Amount']);
    (payload.expenses || []).forEach(r => wsExp.addRow([r.description || '', Number(r.amount) || 0]));

    // Summary
    wsSummary.addRow(['Period', `${payload.dateFrom} → ${payload.dateTo}`]);
    wsSummary.addRow(['Client Rate ($/hr)', payload.clientRate]);
    wsSummary.addRow(['Projects (income only)', (payload.selectedProjectNames || []).join(', ')]);
    wsSummary.addRow(['Client Income', null]);
    wsSummary.addRow(['Other Income Total', null]);
    wsSummary.addRow(['']);
    wsSummary.addRow(['Total Income', null]);
    wsSummary.addRow(['']);
    wsSummary.addRow(['Staff Cost', null]);
    wsSummary.addRow(['Other Expenses', null]);
    wsSummary.addRow(['']);
    wsSummary.addRow(['Total Expenses', null]);
    wsSummary.addRow(['']);
    wsSummary.addRow(['Profit', null]);

    // Apply formulas after rows exist
    wsSummary.getCell('B4').value = { formula: 'SUM(Users!B2:B1048576)*B2' } as unknown as string | number;
    wsSummary.getCell('B5').value = { formula: `SUM('Other Incomes'!B2:B1048576)` } as unknown as string | number;
    wsSummary.getCell('B7').value = { formula: 'B4+B5' } as unknown as string | number;
    wsSummary.getCell('B9').value = { formula: 'SUM(Users!D2:D1048576)' } as unknown as string | number;
    wsSummary.getCell('B10').value = { formula: 'SUM(Expenses!B2:B1048576)' } as unknown as string | number;
    wsSummary.getCell('B12').value = { formula: 'B9+B10' } as unknown as string | number;
    wsSummary.getCell('B14').value = { formula: 'B7-B12' } as unknown as string | number;

    // Basic column widths
    wsUsers.columns = [
      { width: 28 }, { width: 16 }, { width: 14 }, { width: 22 }, { width: 16 }
    ];
    wsOther.columns = [{ width: 36 }, { width: 16 }];
    wsExp.columns = [{ width: 36 }, { width: 16 }];
    wsSummary.columns = [{ width: 28 }, { width: 60 }];

    const buf = await wb.xlsx.writeBuffer();
    const fileName = `profit_${payload.dateFrom}_to_${payload.dateTo}.xlsx`;
    return new NextResponse(Buffer.from(buf as ArrayBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`
      }
    });
  } catch (err) {
    console.error('Excel export error:', err);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}


