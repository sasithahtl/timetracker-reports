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
    const fmt = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 2 });

    const userRows = payload.users.map(u => {
      const incomeHours = payload.perUserIncomeHours[u.id] || 0;
      const costHours = payload.perUserCostHours[u.id] || 0;
      const rate = payload.userRates[u.id] || 0;
      const cost = costHours * rate;
      const income = incomeHours * payload.clientRate;
      const net = income - cost;
      return { name: u.name, incomeHours, rate, costHours, cost, income, net };
    });

    const clientIncome = userRows.reduce((s, r) => s + r.income, 0);
    const otherIncomeTotal = (payload.otherIncomes || []).reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const totalIncome = clientIncome + otherIncomeTotal;
    const staffCost = userRows.reduce((s, r) => s + r.cost, 0);
    const otherExpenses = (payload.expenses || []).reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const totalExpenses = staffCost + otherExpenses;
    const profit = totalIncome - totalExpenses;

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Profit Report ${payload.dateFrom} to ${payload.dateTo}</title>
  <style>
    body { font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 24px; }
    .header { border-bottom: 3px solid #2563eb; padding-bottom: 12px; margin-bottom: 20px; }
    .title { font-size: 24px; font-weight: 800; color: #1e40af; margin: 0 0 6px 0; }
    .sub { color: #475569; }
    .chips { margin-top: 6px; color: #334155; font-size: 12px; }
    .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 16px 0; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; }
    .card h4 { margin: 0 0 6px 0; font-size: 12px; color: #334155; text-transform: uppercase; }
    .big { font-size: 20px; font-weight: 800; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { border-bottom: 1px solid #e2e8f0; padding: 8px 6px; text-align: right; font-size: 12px; }
    th:first-child, td:first-child { text-align: left; }
    thead th { background: #f1f5f9; color: #334155; text-transform: uppercase; font-size: 11px; }
    .section { margin-top: 24px; }
    .totals { background: #eef2ff; font-weight: 700; }
    .profit { background: #ecfeff; font-weight: 800; }
  </style>
  <script>
    window.addEventListener('load', () => { setTimeout(() => { window.focus(); window.print(); }, 150); });
  </script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>@page { size: A4; margin: 1in; }</style>
</head>
<body>
  <div class="header">
    <div class="title">Profit Report</div>
    <div class="sub">Period: ${payload.dateFrom} to ${payload.dateTo} • Client Rate: ${fmt.format(payload.clientRate)} / hr</div>
    <div class="chips">Income Projects: ${(payload.selectedProjectNames || []).join(', ') || 'All'}</div>
  </div>

  <div class="grid">
    <div class="card"><h4>Client Income</h4><div class="big">${fmt.format(clientIncome)}</div></div>
    <div class="card"><h4>Other Income</h4><div class="big">${fmt.format(otherIncomeTotal)}</div></div>
    <div class="card"><h4>Total Income</h4><div class="big">${fmt.format(totalIncome)}</div></div>
  </div>
  <div class="grid">
    <div class="card"><h4>Staff Cost</h4><div class="big">${fmt.format(staffCost)}</div></div>
    <div class="card"><h4>Other Expenses</h4><div class="big">${fmt.format(otherExpenses)}</div></div>
    <div class="card"><h4>Total Expenses</h4><div class="big">${fmt.format(totalExpenses)}</div></div>
  </div>

  <div class="card" style="margin-top:12px;background:#f0fdf4;border-color:#bbf7d0"><h4>Profit</h4><div class="big">${fmt.format(profit)}</div></div>

  <div class="section">
    <h3 style="margin:0 0 8px 0;color:#1e40af">Per User</h3>
    <table>
      <thead>
        <tr>
          <th>User</th>
          <th>Income Hours</th>
          <th>Client Income</th>
          <th>Cost Hours</th>
          <th>Rate</th>
          <th>Cost</th>
          <th>Net</th>
        </tr>
      </thead>
      <tbody>
        ${userRows.map(r => `<tr>
          <td>${r.name}</td>
          <td>${r.incomeHours.toFixed(2)}</td>
          <td>${fmt.format(r.income)}</td>
          <td>${r.costHours.toFixed(2)}</td>
          <td>${fmt.format(r.rate)}</td>
          <td>${fmt.format(r.cost)}</td>
          <td>${fmt.format(r.net)}</td>
        </tr>`).join('')}
        <tr class="totals">
          <td>Total</td>
          <td>${userRows.reduce((s,r)=>s+r.incomeHours,0).toFixed(2)}</td>
          <td>${fmt.format(clientIncome)}</td>
          <td>${userRows.reduce((s,r)=>s+r.costHours,0).toFixed(2)}</td>
          <td></td>
          <td>${fmt.format(staffCost)}</td>
          <td>${fmt.format(clientIncome - staffCost)}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="section">
    <h3 style="margin:0 0 8px 0;color:#1e40af">Other Incomes</h3>
    <table>
      <thead><tr><th>Description</th><th>Amount</th></tr></thead>
      <tbody>
        ${(payload.otherIncomes||[]).map(r => `<tr><td>${(r.description||'').replace(/</g,'&lt;')}</td><td>${fmt.format(Number(r.amount)||0)}</td></tr>`).join('')||'<tr><td colspan="2">-</td></tr>'}
      </tbody>
    </table>
  </div>

  <div class="section">
    <h3 style="margin:0 0 8px 0;color:#1e40af">Expenses</h3>
    <table>
      <thead><tr><th>Description</th><th>Amount</th></tr></thead>
      <tbody>
        ${(payload.expenses||[]).map(r => `<tr><td>${(r.description||'').replace(/</g,'&lt;')}</td><td>${fmt.format(Number(r.amount)||0)}</td></tr>`).join('')||'<tr><td colspan="2">-</td></tr>'}
      </tbody>
    </table>
  </div>
</body>
</html>`;

    const filename = `profit-${payload.dateFrom}-to-${payload.dateTo}.pdf`;
    return NextResponse.json({ html, filename }, { status: 200 });
  } catch (err) {
    console.error('Export PDF error:', err);
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }
}


