const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api', (req, res, next) => { console.log('API req:', req.method, req.path); res.type('application/json'); next(); });

const dbFile = path.join(__dirname, '..', 'data', 'db.json');

function ensureDB() {
  if (!fs.existsSync(path.dirname(dbFile))) fs.mkdirSync(path.dirname(dbFile), { recursive: true });
  if (!fs.existsSync(dbFile)) {
    const initial = {
      employees: [{ id: 1, name: 'موظف افتراضي' }],
      customers: [],
      items: [],
      withdrawals: [],
      sales: [],
      payments: []
    };
    fs.writeFileSync(dbFile, JSON.stringify(initial, null, 2));
  }
}

function loadDB() {
  ensureDB();
  const raw = fs.readFileSync(dbFile, 'utf-8');
  return JSON.parse(raw);
}

function saveDB(db) {
  fs.writeFileSync(dbFile, JSON.stringify(db, null, 2));
}

function nextId(arr) {
  return arr.length ? Math.max(...arr.map(x => x.id)) + 1 : 1;
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});
app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/api/employees', (req, res) => {
  const db = loadDB();
  res.json(db.employees);
});
app.get('/employees', (req, res) => { const db = loadDB(); res.json(db.employees); });

app.post('/api/employees', (req, res) => {
  const db = loadDB();
  const { name } = req.body;
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'name required' });
  const id = nextId(db.employees);
  const emp = { id, name };
  db.employees.push(emp);
  saveDB(db);
  res.json(emp);
});
app.post('/employees', (req, res) => {
  const db = loadDB();
  const { name } = req.body;
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'name required' });
  const id = nextId(db.employees);
  const emp = { id, name };
  db.employees.push(emp);
  saveDB(db);
  res.json(emp);
});

app.get('/api/customers', (req, res) => {
  const db = loadDB();
  res.json(db.customers);
});

app.post('/api/customers', (req, res) => {
  const db = loadDB();
  const { name, phone, address } = req.body;
  const id = nextId(db.customers);
  const c = { id, name, phone, address };
  db.customers.push(c);
  saveDB(db);
  res.json(c);
});

app.put('/api/customers/:id', (req, res) => {
  const db = loadDB();
  const id = Number(req.params.id);
  const idx = db.customers.findIndex(c => c.id === id);
  if (idx === -1) return res.status(404).json({ error: 'not found' });
  const { name, phone, address } = req.body;
  db.customers[idx] = { ...db.customers[idx], name, phone, address };
  saveDB(db);
  res.json(db.customers[idx]);
});

app.get('/api/items', (req, res) => {
  const db = loadDB();
  res.json(db.items);
});

app.post('/api/items', (req, res) => {
  const db = loadDB();
  const { name, buyPrice, sellPrice } = req.body;
  const id = nextId(db.items);
  const it = { id, name, buyPrice: Number(buyPrice) || 0, sellPrice: Number(sellPrice) || 0 };
  db.items.push(it);
  saveDB(db);
  res.json(it);
});

app.put('/api/items/:id', (req, res) => {
  const db = loadDB();
  const id = Number(req.params.id);
  const idx = db.items.findIndex(i => i.id === id);
  if (idx === -1) return res.status(404).json({ error: 'not found' });
  const { name, buyPrice, sellPrice } = req.body;
  db.items[idx] = { ...db.items[idx], name, buyPrice: Number(buyPrice) || 0, sellPrice: Number(sellPrice) || 0 };
  saveDB(db);
  res.json(db.items[idx]);
});

app.get('/api/withdrawals', (req, res) => {
  const db = loadDB();
  const status = req.query.status;
  const list = status ? db.withdrawals.filter(w => w.status === status) : db.withdrawals;
  res.json(list);
});

app.post('/api/withdrawals', (req, res) => {
  const db = loadDB();
  const { employeeId, itemId, customerId, withdrawDate, buyPrice, supplierInvoiceNo, status, notes } = req.body;
  const emp = db.employees.find(e => e.id === Number(employeeId) ) || db.employees[0];
  const item = db.items.find(i => i.id === Number(itemId));
  if (!item) return res.status(400).json({ error: 'invalid itemId' });
  const cust = customerId ? db.customers.find(c => c.id === Number(customerId)) : null;
  const id = nextId(db.withdrawals);
  const w = {
    id,
    employeeId: emp.id,
    itemId: item.id,
    customerId: cust ? cust.id : null,
    withdrawDate: withdrawDate || new Date().toISOString().slice(0,10),
    buyPrice: Number(buyPrice) || 0,
    supplierInvoiceNo: supplierInvoiceNo || null,
    status: status === 'sold' ? 'sold' : 'unsold',
    notes: notes || null
  };
  db.withdrawals.push(w);
  saveDB(db);
  res.json(w);
});

app.get('/api/sales', (req, res) => {
  const db = loadDB();
  res.json(db.sales);
});

app.post('/api/sales', (req, res) => {
  const db = loadDB();
  const { withdrawalId, customerId, sellPrice, saleDate } = req.body;
  const w = db.withdrawals.find(x => x.id === Number(withdrawalId));
  if (!w) return res.status(400).json({ error: 'invalid withdrawalId' });
  if (w.status === 'sold') return res.status(400).json({ error: 'withdrawal already sold' });
  const custId = customerId ? Number(customerId) : w.customerId;
  if (!custId) return res.status(400).json({ error: 'customerId required' });
  const cust = db.customers.find(c => c.id === Number(custId));
  if (!cust) return res.status(400).json({ error: 'invalid customerId' });
  const id = nextId(db.sales);
  const s = { id, withdrawalId: w.id, customerId: cust.id, sellPrice: Number(sellPrice) || 0, saleDate: saleDate || new Date().toISOString().slice(0,10) };
  db.sales.push(s);
  w.status = 'sold';
  saveDB(db);
  res.json(s);
});

app.get('/api/payments', (req, res) => {
  const db = loadDB();
  const saleId = req.query.sale_id ? Number(req.query.sale_id) : undefined;
  const list = saleId ? db.payments.filter(p => p.saleId === saleId) : db.payments;
  res.json(list);
});

app.post('/api/payments', (req, res) => {
  const db = loadDB();
  const { saleId, amount, paymentDate, receivedByEmployeeId, method } = req.body;
  const sale = db.sales.find(s => s.id === Number(saleId));
  if (!sale) return res.status(400).json({ error: 'invalid saleId' });
  const emp = db.employees.find(e => e.id === Number(receivedByEmployeeId)) || db.employees[0];
  const id = nextId(db.payments);
  const p = { id, saleId: sale.id, customerId: sale.customerId, amount: Number(amount) || 0, paymentDate: paymentDate || new Date().toISOString().slice(0,10), receivedByEmployeeId: emp.id, method: method || null };
  db.payments.push(p);
  saveDB(db);
  res.json(p);
});

app.get('/api/customers/:id/debt', (req, res) => {
  const db = loadDB();
  const id = Number(req.params.id);
  const sales = db.sales.filter(s => s.customerId === id);
  const details = sales.map(s => {
    const paid = db.payments.filter(p => p.saleId === s.id).reduce((sum, p) => sum + Number(p.amount), 0);
    const remaining = Number(s.sellPrice) - paid;
    return { saleId: s.id, sellPrice: Number(s.sellPrice), paid, remaining };
  });
  const totalRemaining = details.reduce((sum, d) => sum + d.remaining, 0);
  res.json({ customerId: id, totalRemaining, details });
});

app.get('/api/reports/debts', (req, res) => {
  const db = loadDB();
  const overdueDays = req.query.overdue_days ? Number(req.query.overdue_days) : 0;
  const today = new Date();
  const items = db.sales.map(s => {
    const paid = db.payments.filter(p => p.saleId === s.id).reduce((sum, p) => sum + Number(p.amount), 0);
    const remaining = Number(s.sellPrice) - paid;
    const diffDays = Math.floor((today - new Date(s.saleDate)) / (1000 * 60 * 60 * 24));
    const overdue = remaining > 0 && diffDays > overdueDays;
    const cust = db.customers.find(c => c.id === s.customerId);
    return { saleId: s.id, customerId: s.customerId, customerName: cust ? cust.name : '', remaining, daysSinceSale: diffDays, overdue };
  }).filter(i => i.remaining > 0);
  res.json(items);
});

app.get('/api/reports/employees/:id/activity', (req, res) => {
  const db = loadDB();
  const id = Number(req.params.id);
  const withdrawalsCount = db.withdrawals.filter(w => w.employeeId === id).length;
  const salesCount = db.sales.filter(s => db.withdrawals.find(w => w.id === s.withdrawalId && w.employeeId === id)).length;
  const paymentsSum = db.payments.filter(p => p.receivedByEmployeeId === id).reduce((sum, p) => sum + Number(p.amount), 0);
  res.json({ employeeId: id, withdrawalsCount, salesCount, paymentsSum });
});

app.get('/api/reports/inventory', (req, res) => {
  const db = loadDB();
  const sold = db.withdrawals.filter(w => w.status === 'sold');
  const unsold = db.withdrawals.filter(w => w.status === 'unsold');
  const expectedProfit = sold.reduce((sum, w) => {
    const item = db.items.find(i => i.id === w.itemId);
    const defaultSell = item ? Number(item.sellPrice) || 0 : 0;
    return sum + defaultSell - Number(w.buyPrice || 0);
  }, 0);
  res.json({ sold: sold.length, unsold: unsold.length, expectedProfit });
});

app.get('/api/reports/summary', (req, res) => {
  const db = loadDB();
  const from = req.query.from ? new Date(req.query.from) : null;
  const to = req.query.to ? new Date(req.query.to) : null;
  const inRange = (d) => {
    const dt = new Date(d);
    if (from && dt < from) return false;
    if (to && dt > to) return false;
    return true;
  };
  const sales = db.sales.filter(s => inRange(s.saleDate));
  const salesRevenue = sales.reduce((sum, s) => sum + Number(s.sellPrice), 0);
  const payments = db.payments.filter(p => inRange(p.paymentDate));
  const paymentsSum = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const outstanding = salesRevenue - paymentsSum;
  const soldCount = db.withdrawals.filter(w => w.status === 'sold').length;
  const unsoldCount = db.withdrawals.filter(w => w.status === 'unsold').length;
  const avgSellPrice = sales.length ? salesRevenue / sales.length : 0;
  res.json({ totalSalesCount: sales.length, totalSalesRevenue: salesRevenue, totalPayments: paymentsSum, outstanding, soldCount, unsoldCount, avgSellPrice });
});

app.get('/api/reports/customers', (req, res) => {
  const db = loadDB();
  const minDebt = req.query.min_debt ? Number(req.query.min_debt) : 0;
  const rows = db.customers.map(c => {
    const csales = db.sales.filter(s => s.customerId === c.id);
    const revenue = csales.reduce((sum, s) => sum + Number(s.sellPrice), 0);
    const paid = db.payments.filter(p => csales.find(s => s.id === p.saleId)).reduce((sum, p) => sum + Number(p.amount), 0);
    const remaining = revenue - paid;
    const lastSaleDate = csales.length ? csales.reduce((a, b) => new Date(a.saleDate) > new Date(b.saleDate) ? a : b).saleDate : null;
    return { customerId: c.id, customerName: c.name, salesCount: csales.length, revenue, paid, remaining, lastSaleDate };
  }).filter(r => r.remaining >= minDebt).sort((a, b) => b.remaining - a.remaining);
  res.json(rows);
});

app.get('/api/reports/items', (req, res) => {
  const db = loadDB();
  const rows = db.items.map(i => {
    const wds = db.withdrawals.filter(w => w.itemId === i.id);
    const soldSales = db.sales.filter(s => wds.find(w => w.id === s.withdrawalId));
    const revenue = soldSales.reduce((sum, s) => sum + Number(s.sellPrice), 0);
    const buyTotal = wds.reduce((sum, w) => sum + Number(w.buyPrice || 0), 0);
    const profit = revenue - buyTotal;
    const unsoldCount = wds.filter(w => w.status === 'unsold').length;
    return { itemId: i.id, itemName: i.name, withdrawalsCount: wds.length, soldCount: soldSales.length, unsoldCount, revenue, buyTotal, profit };
  }).sort((a, b) => b.revenue - a.revenue);
  res.json(rows);
});

app.get('/api/reports/sales_by_employee', (req, res) => {
  const db = loadDB();
  const from = req.query.from ? new Date(req.query.from) : null;
  const to = req.query.to ? new Date(req.query.to) : null;
  const inRange = (d) => {
    const dt = new Date(d);
    if (from && dt < from) return false;
    if (to && dt > to) return false;
    return true;
  };
  const rows = db.employees.map(e => {
    const wds = db.withdrawals.filter(w => w.employeeId === e.id);
    const sales = db.sales.filter(s => inRange(s.saleDate) && wds.find(w => w.id === s.withdrawalId));
    const salesTotal = sales.reduce((sum, s) => sum + Number(s.sellPrice), 0);
    const paymentsSum = db.payments.filter(p => inRange(p.paymentDate) && p.receivedByEmployeeId === e.id).reduce((sum, p) => sum + Number(p.amount), 0);
    return { employeeId: e.id, employeeName: e.name, withdrawalsCount: wds.length, salesCount: sales.length, salesTotal, paymentsSum };
  }).sort((a, b) => b.salesTotal - a.salesTotal);
  res.json(rows);
});

app.get('/api/reports/monthly', (req, res) => {
  const db = loadDB();
  const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
  const months = Array.from({ length: 12 }, (_, m) => m + 1);
  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  const rows = months.map(m => {
    const from = new Date(`${year}-${pad(m)}-01`);
    const to = new Date(`${year}-${pad(m)}-31`);
    const inRange = (d) => {
      const dt = new Date(d);
      return dt >= from && dt <= to;
    };
    const sales = db.sales.filter(s => inRange(s.saleDate));
    const salesRevenue = sales.reduce((sum, s) => sum + Number(s.sellPrice), 0);
    const payments = db.payments.filter(p => inRange(p.paymentDate));
    const paymentsSum = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const outstanding = salesRevenue - paymentsSum;
    return { month: m, salesCount: sales.length, revenue: salesRevenue, payments: paymentsSum, outstanding };
  });
  res.json(rows);
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'not_found' });
});

app.use((err, req, res, next) => {
  console.error('Error handler:', err);
  if (req.path && req.path.startsWith('/api')) {
    res.status(err.status || 500).json({ error: err.message || 'server_error' });
  } else {
    next(err);
  }
});
