import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { createServer as createHttpServer } from 'http';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { createServer as createViteServer } from 'vite';
import { db } from './server/db';
import { registerModuleRoutes } from './server/module-routes';
import { User, House, Collection, Expense, Staff, SalaryPayment, AttendanceRecord, LedgerEntry, MohallaSettings } from './src/types/index';

const JWT_SECRET = process.env.JWT_SECRET || 'madina-street-super-secret-jwt-key-2026';
const PORT = 3000;

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Helper Middleware to extract User from JWT Token
interface AuthRequest extends Request {
  user?: User;
}

const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    req.user = db.get('users')[0];
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as User;
    const existingUser = db.get('users').find(u => u.id === decoded.id);
    req.user = existingUser || decoded;
    next();
  } catch (err) {
    req.user = db.get('users')[0];
    next();
  }
};

app.use('/api', db.middleware, authenticateToken);

// ==========================================
// 1. AUTHENTICATION & USER ROUTES
// ==========================================

app.post('/api/auth/login', (req: AuthRequest, res: Response) => {
  const { email, role, username } = req.body;
  const users = db.get('users');
  
  let user = users.find(u => 
    (email && u.email.toLowerCase() === email.toLowerCase()) ||
    (username && (u.username || '').toLowerCase() === username.toLowerCase())
  );

  if (!user && role) {
    user = users.find(u => u.role === role);
  }
  if (!user) {
    user = users[0];
  }

  if (user.status === 'Inactive' || user.status === 'Suspended' || user.active === false) {
    return res.status(403).json({
      success: false,
      message: `Access Denied: Your account is currently marked as '${user.status || 'Inactive'}'. Please contact the Welfare Committee Administrator.`
    });
  }

  user.lastLogin = new Date().toISOString();
  user.updatedAt = new Date().toISOString();
  db.save();

  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
  db.logLogin(user, { ip, userAgent: req.headers['user-agent'] || '' });

  const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '7d' });

  db.logAudit(user, 'LOGIN', 'Authentication', `User ${user.name} logged in with role ${user.role}`, ip);

  res.json({
    success: true,
    user,
    token,
  });
});

app.post('/api/auth/logout', (req: AuthRequest, res: Response) => {
  if (req.user) {
    const loginHistory = db.get('loginHistory') || [];
    const latest = loginHistory.find(lh => lh.userId === req.user?.id && !lh.logoutTime);
    if (latest) {
      latest.logoutTime = new Date().toISOString();
      db.save();
    }
    db.logAudit(req.user, 'LOGOUT', 'Authentication', `User ${req.user.name} logged out`);
  }
  res.json({ success: true, message: 'Logged out successfully' });
});

app.get('/api/auth/me', (req: AuthRequest, res: Response) => {
  res.json({ success: true, user: req.user });
});

// Dynamic Evaluation Months
const EVALUATION_MONTHS = [
  'January 2026',
  'February 2026',
  'March 2026',
  'April 2026',
  'May 2026',
  'June 2026',
  'July 2026',
  'August 2026',
  'September 2026',
  'October 2026',
  'November 2026',
  'December 2026',
];

const currentEvaluationMonthIndex = () => {
  const now = new Date();
  return now.getFullYear() === 2026 ? now.getMonth() : EVALUATION_MONTHS.length - 1;
};

const currentEvaluationMonth = () => EVALUATION_MONTHS[currentEvaluationMonthIndex()];

function calculateHouseSummary(house: House & { registrationMonth?: string }, allCollections: Collection[]) {
  const houseCols = allCollections
    .filter(c => c.houseId === house.id || c.houseNo.toUpperCase().trim() === house.houseNo.toUpperCase().trim())
    .sort((a, b) => new Date(b.createdAt || b.paymentDate).getTime() - new Date(a.createdAt || a.paymentDate).getTime());

  const paidMonthsSet = new Set(houseCols.map(c => c.month.trim()));
  const paidMonthsList = Array.from(paidMonthsSet);

  const regMonth = house.registrationMonth || currentEvaluationMonth();
  const regIndex = EVALUATION_MONTHS.findIndex(m => m.toLowerCase() === regMonth.toLowerCase());
  const currentMonthIndex = currentEvaluationMonthIndex();
  const applicableMonths = regIndex !== -1 && regIndex < currentMonthIndex
    ? EVALUATION_MONTHS.slice(regIndex, currentMonthIndex)
    : [];

  let pendingMonthsList: string[] = [];
  if (house.status !== 'Vacant' && house.status !== 'Exempted') {
    pendingMonthsList = applicableMonths.filter(m => !paidMonthsSet.has(m));
  }

  if (house.currentDuesOverride) {
    pendingMonthsList = [];
  }

  const totalPaidAmount = houseCols.reduce((sum, c) => sum + (c.totalPaid || c.amount || 0), 0);
  const totalExpectedAmount = applicableMonths.length * house.monthlyFee;
  const outstandingAmount = house.currentDuesOverride
    ? Number(house.currentDues) || 0
    : pendingMonthsList.length * house.monthlyFee;
  const collectionPercentage = totalExpectedAmount > 0
    ? Math.min(100, Math.round((totalPaidAmount / totalExpectedAmount) * 100))
    : 100;

  let statusClassification: 'Good Standing' | 'Warning' | 'Defaulter' | 'Vacant' | 'Exempted' | 'Active' | 'Rented' | 'Closed' = 'Good Standing';
  if (house.status === 'Vacant' || house.status === 'Exempted' || house.status === 'Closed' || house.status === 'Rented') {
    statusClassification = house.status;
  } else if (pendingMonthsList.length === 0) {
    statusClassification = 'Good Standing';
  } else if (pendingMonthsList.length === 1) {
    statusClassification = 'Warning';
  } else {
    statusClassification = 'Defaulter';
  }

  return {
    totalPaidAmount,
    totalExpectedAmount,
    outstandingAmount,
    paidMonthsCount: paidMonthsList.length,
    pendingMonthsCount: pendingMonthsList.length,
    paidMonthsList,
    pendingMonthsList,
    collectionPercentage,
    lastPaymentDate: houseCols[0]?.paymentDate,
    lastReceiptNo: houseCols[0]?.receiptNo,
    statusClassification,
    houseCols,
  };
}

// ==========================================
// 2. DASHBOARD STATS ROUTE
// ==========================================

app.get('/api/dashboard/stats', (req: AuthRequest, res: Response) => {
  const houses = db.get('houses');
  const collections = db.get('collections');
  const expenses = db.get('expenses');
  const staff = db.get('staff');

  const summaries = houses.map(h => ({
    house: h,
    summary: calculateHouseSummary(h, collections),
  }));

  const totalHouses = houses.length;
  const activeHouses = houses.filter(h => h.status !== 'Vacant' && h.status !== 'Exempted').length;

  let goodStandingCount = 0;
  let warningCount = 0;
  let defaulterCount = 0;

  summaries.forEach(s => {
    if (s.summary.statusClassification === 'Good Standing') goodStandingCount++;
    else if (s.summary.statusClassification === 'Warning') warningCount++;
    else if (s.summary.statusClassification === 'Defaulter') defaulterCount++;
  });

  const totalCollectedThisMonth = collections
    .filter(c => c.month.toLowerCase().includes('august 2026') || c.month.toLowerCase().includes('2026-08'))
    .reduce((sum, c) => sum + c.totalPaid, 0);

  const totalExpensesThisMonth = expenses
    .filter(e => e.date.startsWith('2026-08'))
    .reduce((sum, e) => sum + e.amount, 0);

  const pendingCollectionAmount = summaries.reduce((sum, s) => sum + s.summary.outstandingAmount, 0);
  const totalExpectedAll = summaries.reduce((sum, s) => sum + s.summary.totalExpectedAmount, 0);
  const totalPaidAll = summaries.reduce((sum, s) => sum + s.summary.totalPaidAmount, 0);

  const netMonthlyBalance = totalCollectedThisMonth - totalExpensesThisMonth;

  const expectedMonthlyIncome = houses
    .filter(h => h.status !== 'Vacant' && h.status !== 'Exempted')
    .reduce((sum, h) => sum + h.monthlyFee, 0);

  const collectionRatePercentage = totalExpectedAll > 0
    ? Math.min(100, Math.round((totalPaidAll / totalExpectedAll) * 100))
    : 100;

  const pendingCollectionPercentage = 100 - collectionRatePercentage;

  const topDefaulters = [...summaries]
    .filter(s => s.summary.outstandingAmount > 0)
    .sort((a, b) => b.summary.outstandingAmount - a.summary.outstandingAmount)
    .slice(0, 5)
    .map(s => ({
      houseId: s.house.id,
      houseNo: s.house.houseNo,
      headName: s.house.headName,
      phone: s.house.phone,
      monthlyFee: s.house.monthlyFee,
      pendingMonthsCount: s.summary.pendingMonthsCount,
      outstandingAmount: s.summary.outstandingAmount,
      status: s.summary.statusClassification,
    }));

  res.json({
    success: true,
    stats: {
      totalHouses,
      activeHouses,
      totalCollectedThisMonth,
      totalExpensesThisMonth,
      netMonthlyBalance,
      outstandingDuesTotal: pendingCollectionAmount,
      pendingCollectionAmount,
      pendingCollectionPercentage,
      collectionRatePercentage,
      totalActiveStaff: staff.filter(s => s.status === 'Active').length,
      goodStandingCount,
      warningCount,
      defaulterCount,
      expectedMonthlyIncome,
    },
    topDefaulters,
    recentlyPaidHouses: collections.slice(0, 5),
    recentCollections: collections.slice(0, 5),
    recentExpenses: expenses.slice(0, 5),
  });
});

// ==========================================
// 3. HOUSE MANAGEMENT ROUTES
// ==========================================

app.get('/api/houses', (req: AuthRequest, res: Response) => {
  const houses = db.get('houses');
  const collections = db.get('collections');

  const includeDeleted = req.query.includeDeleted === 'true';
  const activeHouses = includeDeleted ? houses : houses.filter(h => !h.isDeleted);

  const updatedHouses = activeHouses.map(h => {
    const summary = calculateHouseSummary(h, collections);
    return {
      ...h,
      status: summary.statusClassification,
      currentDues: summary.outstandingAmount,
      pendingMonthsCount: summary.pendingMonthsCount,
      pendingMonthsList: summary.pendingMonthsList,
      lastPaymentDate: summary.lastPaymentDate || undefined,
      lastReceiptNo: summary.lastReceiptNo || undefined,
    };
  });

  res.json({ success: true, houses: updatedHouses });
});

app.get('/api/houses/quick-search', (req: AuthRequest, res: Response) => {
  const query = (req.query.q as string || '').toLowerCase().trim();
  const houses = db.get('houses');
  const collections = db.get('collections');

  if (!query) {
    return res.json({ success: true, houses: [] });
  }

  const filtered = houses.filter(h => 
    h.houseNo.toLowerCase().includes(query) ||
    h.headName.toLowerCase().includes(query) ||
    h.phone.toLowerCase().includes(query)
  );

  const results = filtered.map(h => {
    const summary = calculateHouseSummary(h, collections);
    return {
      ...h,
      status: summary.statusClassification,
      currentDues: summary.outstandingAmount,
      pendingMonthsCount: summary.pendingMonthsCount,
    };
  });

  res.json({ success: true, houses: results });
});

app.get('/api/defaulters', (req: AuthRequest, res: Response) => {
  const houses = db.get('houses');
  const collections = db.get('collections');

  const defaulterItems = houses
    .map(h => {
      const summary = calculateHouseSummary(h, collections);
      return {
        houseId: h.id,
        houseNo: h.houseNo,
        street: h.street,
        sector: h.sector,
        headName: h.headName,
        phone: h.phone,
        whatsapp: h.whatsapp || h.phone,
        monthlyFee: h.monthlyFee,
        status: summary.statusClassification,
        currentDues: summary.outstandingAmount,
        pendingMonthsCount: summary.pendingMonthsCount,
        pendingMonthsList: summary.pendingMonthsList,
        lastPaymentDate: summary.lastPaymentDate,
        lastReceiptNo: summary.lastReceiptNo,
      };
    })
    .filter(item => item.pendingMonthsCount > 0 || item.status === 'Warning' || item.status === 'Defaulter')
    .sort((a, b) => b.currentDues - a.currentDues);

  res.json({ success: true, defaulters: defaulterItems });
});

app.get('/api/houses/:id/profile', (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const houses = db.get('houses');
  const collections = db.get('collections');

  const house = houses.find(h => h.id === id || h.houseNo.toUpperCase() === id.toUpperCase());
  if (!house) {
    return res.status(404).json({ success: false, message: 'House profile not found' });
  }

  const summary = calculateHouseSummary(house, collections);
  house.status = summary.statusClassification;
  house.currentDues = summary.outstandingAmount;

  res.json({
    success: true,
    profile: {
      house,
      financialSummary: summary,
      paymentHistory: summary.houseCols,
    },
  });
});

app.post('/api/houses', (req: AuthRequest, res: Response) => {
  const houses = db.get('houses');
  const { houseNo, headName, phone, whatsapp, cnic, monthlyFee, street, sector, category, residentType, familyMembers, status, currentDues, notes, registrationMonth } = req.body;

  if (!houseNo || !houseNo.trim()) {
    return res.status(400).json({ success: false, message: 'House number is required.' });
  }
  if (!headName || !headName.trim()) {
    return res.status(400).json({ success: false, message: 'Resident owner/head name is required.' });
  }
  if (!phone || !phone.trim()) {
    return res.status(400).json({ success: false, message: 'Mobile phone number is required.' });
  }

  const fee = Number(monthlyFee);
  if (isNaN(fee) || fee <= 0) {
    return res.status(400).json({ success: false, message: 'Monthly fee must be greater than zero.' });
  }

  const duplicate = houses.find(h => !h.isDeleted && h.houseNo.toLowerCase().trim() === houseNo.toLowerCase().trim());
  if (duplicate) {
    return res.status(400).json({ success: false, message: `House number '${houseNo}' already exists.` });
  }

  const nowIso = new Date().toISOString();
  const newHouse: any = {
    id: `h-${Date.now()}`,
    houseNo: houseNo.trim().toUpperCase(),
    street: street || 'Street 1',
    sector: sector || 'Sector A',
    category: category || 'Residential Standard',
    residentType: residentType || 'Owner',
    headName: headName.trim(),
    cnic: cnic ? cnic.trim() : undefined,
    phone: phone.trim(),
    whatsapp: whatsapp ? whatsapp.trim() : phone.trim(),
    familyMembers: Number(familyMembers) || 4,
    monthlyFee: fee,
    status: status || 'Active',
    currentDues: Number(currentDues) || 0,
    currentDuesOverride: Boolean(req.body.currentDuesOverride),
    registrationMonth: registrationMonth || currentEvaluationMonth(),
    joinedDate: nowIso.split('T')[0],
    createdAt: nowIso,
    updatedAt: nowIso,
    isDeleted: false,
    notes: notes || '',
  };

  houses.unshift(newHouse);
  db.save();

  db.logAudit(req.user!, 'CREATE', 'House Management', `Created House ${newHouse.houseNo} (${newHouse.headName})`);

  res.json({ success: true, house: newHouse });
});

app.post('/api/houses/import', (req: AuthRequest, res: Response) => {
  const houses = db.get('houses');
  const importedHouses = Array.isArray(req.body.importedHouses) ? req.body.importedHouses : [];

  if (importedHouses.length === 0) {
    return res.status(400).json({ success: false, message: 'No house records were provided.' });
  }

  const nowIso = new Date().toISOString();
  const existingNumbers = new Set(houses.map(h => h.houseNo.toLowerCase().trim()));
  const newHouses: House[] = [];
  const errors: string[] = [];

  importedHouses.forEach((item: Partial<House>, index: number) => {
    const houseNo = String(item.houseNo || '').trim();
    const headName = String(item.headName || '').trim();
    const phone = String(item.phone || '').trim();
    const monthlyFee = Number(item.monthlyFee);
    const normalizedNumber = houseNo.toLowerCase();

    if (!houseNo || !headName || !phone || !Number.isFinite(monthlyFee) || monthlyFee <= 0) {
      errors.push(`Row ${index + 2}: house number, resident name, phone, and positive monthly fee are required.`);
      return;
    }
    if (existingNumbers.has(normalizedNumber)) {
      errors.push(`Row ${index + 2}: house number '${houseNo}' already exists.`);
      return;
    }

    existingNumbers.add(normalizedNumber);
    newHouses.push({
      id: `h-${Date.now()}-${index}`,
      houseNo: houseNo.toUpperCase(),
      street: 'Street 1',
      sector: 'Sector A',
      category: 'Residential Standard',
      residentType: 'Owner',
      headName,
      phone,
      whatsapp: phone,
      familyMembers: 4,
      monthlyFee,
      status: item.status || 'Active',
      currentDues: Number(item.currentDues) || 0,
      currentDuesOverride: false,
      registrationMonth: item.registrationMonth || currentEvaluationMonth(),
      joinedDate: nowIso.split('T')[0],
      createdAt: nowIso,
      updatedAt: nowIso,
      isDeleted: false,
      notes: '',
    });
  });

  houses.unshift(...newHouses);
  db.save();
  res.json({ success: true, addedCount: newHouses.length, errors });
});

app.put('/api/houses/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const houses = db.get('houses');
  const index = houses.findIndex(h => h.id === id);

  if (index === -1) {
    return res.status(404).json({ success: false, message: 'House not found' });
  }

  houses[index] = {
    ...houses[index],
    ...req.body,
    ...(Object.prototype.hasOwnProperty.call(req.body, 'currentDues')
      ? {
        currentDues: Number(req.body.currentDues) || 0,
        currentDuesOverride: req.body.currentDuesOverride === undefined
          ? true
          : Boolean(req.body.currentDuesOverride),
      }
      : {}),
    updatedAt: new Date().toISOString(),
  };

  db.save();
  res.json({ success: true, house: houses[index] });
});

app.delete('/api/houses/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  let houses = db.get('houses');
  houses = houses.filter(h => h.id !== id);
  db.set('houses', houses);
  res.json({ success: true, message: 'House deleted' });
});

// ==========================================
// 4. MONTHLY COLLECTION ROUTES
// ==========================================

app.get('/api/collections', (req: AuthRequest, res: Response) => {
  const collections = db.get('collections');
  res.json({ success: true, collections });
});

app.post('/api/collections', (req: AuthRequest, res: Response) => {
  const collections = db.get('collections');
  const houses = db.get('houses');

  const { houseId, month, year, amount, lateFee, paymentMethod, referenceNo, remarks, collectorName } = req.body;

  const house = houses.find(h => h.id === houseId || h.houseNo.toUpperCase() === String(houseId).toUpperCase());
  if (!house) {
    return res.status(400).json({ success: false, message: 'Selected house record does not exist.' });
  }

  const feeAmount = Number(amount || 0);
  const totalPaid = feeAmount + Number(lateFee || 0);
  const receiptNo = `REC-${year || 2026}-${String(collections.length + 101).padStart(3, '0')}`;

  const newCollection: Collection = {
    id: `col-${Date.now()}`,
    receiptNo,
    houseId: house.id,
    houseNo: house.houseNo,
    headName: house.headName,
    sector: house.sector,
    street: house.street,
    month: month || 'August 2026',
    year: Number(year) || 2026,
    amount: feeAmount,
    lateFee: Number(lateFee || 0),
    totalPaid,
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: paymentMethod || 'Cash',
    referenceNo: referenceNo || '',
    collectorId: req.user?.id || 'u-1',
    collectorName: collectorName || req.user?.name || 'Collector',
    remarks: remarks || '',
    notes: remarks || '',
    status: 'Paid',
    createdAt: new Date().toISOString(),
  };

  collections.unshift(newCollection);
  house.currentDuesOverride = false;
  db.save();

  res.json({ success: true, collection: newCollection, message: `Payment received! Receipt #${receiptNo}` });
});

// ==========================================
// 5. EXPENSE MANAGEMENT ROUTES
// ==========================================

app.get('/api/expenses', (req: AuthRequest, res: Response) => {
  const expenses = db.get('expenses') || [];
  res.json({ success: true, expenses });
});

app.post('/api/expenses', (req: AuthRequest, res: Response) => {
  const expenses: Expense[] = db.get('expenses') || [];
  const { title, category, amount, date, paidTo, paymentMethod, notes } = req.body;

  const newExpense: Expense = {
    id: `exp-${Date.now()}`,
    voucherNo: `EV-${Date.now().toString().slice(-6)}`,
    title: title || 'Expense Item',
    category: category || 'General',
    amount: Number(amount) || 0,
    date: date || new Date().toISOString().split('T')[0],
    paidTo: paidTo || 'Vendor',
    paymentMethod: paymentMethod || 'Cash',
    referenceNo: '',
    createdBy: req.user?.name || 'Admin',
    status: 'Approved',
    notes: notes || '',
    createdAt: new Date().toISOString(),
  };

  const categories = db.get('expenseCategories') || [];
  if (!categories.some(c => c.name === newExpense.category)) {
    categories.push({ id: `category-${Date.now()}`, name: newExpense.category });
    db.set('expenseCategories', categories);
  }
  expenses.unshift(newExpense);
  db.save();

  res.json({ success: true, expense: newExpense });
});

// ==========================================
// 6. MONTHLY CLOSING & HISTORICAL REPORTS
// ==========================================

app.get('/api/reports/monthly-closing', (req: AuthRequest, res: Response) => {
  const selectedMonth = (req.query.month as string) || 'August 2026';
  
  const collections = (db.get('collections') || []).filter((c: Collection) => 
    c.month.toLowerCase().trim() === selectedMonth.toLowerCase().trim() && c.status !== 'Cancelled'
  );

  const expenses = (db.get('expenses') || []).filter((e: Expense) => {
    return (e.status || 'Approved') === 'Approved';
  });

  const salaries = (db.get('salaries') || []).filter((s: SalaryPayment) => 
    s.month.toLowerCase().trim() === selectedMonth.toLowerCase().trim()
  );

  const houses = db.get('houses') || [];

  const totalCollected = collections.reduce((sum: number, c: Collection) => sum + c.totalPaid, 0);
  const totalExpenses = expenses.reduce((sum: number, e: Expense) => sum + e.amount, 0);
  const totalSalaries = salaries.reduce((sum: number, s: SalaryPayment) => sum + s.netPaid, 0);
  const netClosingBalance = totalCollected - (totalExpenses + totalSalaries);

  const paidHouseIds = new Set(collections.map((c: Collection) => c.houseId));
  const unpaidHouses = houses.filter((h: House) => h.status !== 'Vacant' && h.status !== 'Exempted' && !paidHouseIds.has(h.id));

  res.json({
    success: true,
    month: selectedMonth,
    summary: {
      totalCollected,
      totalExpenses,
      totalSalaries,
      netClosingBalance,
      paidHousesCount: collections.length,
      unpaidHousesCount: unpaidHouses.length,
    },
    paidCollections: collections,
    expensesList: expenses,
    salaryPayments: salaries,
    unpaidHousesList: unpaidHouses,
  });
});

// ==========================================
// 7. USER MANAGEMENT & SYSTEM HEALTH
// ==========================================

app.get('/api/users', (req: AuthRequest, res: Response) => {
  const users = db.get('users') || [];
  res.json({ success: true, users });
});

app.post('/api/users', (req: AuthRequest, res: Response) => {
  const users = db.get('users') || [];
  const { name, email, username, role, phone } = req.body;

  if (!name || !email) {
    return res.status(400).json({ success: false, message: 'Full name and email are required' });
  }

  const newUser: User = {
    id: `u-${Date.now()}`,
    name,
    email,
    username: username || email.split('@')[0],
    role: role || 'Collector',
    status: 'Active',
    active: true,
    phone: phone || '',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    permissions: [],
  };

  users.push(newUser);
  db.save();

  res.json({ success: true, user: newUser });
});

// ==========================================
// 8. SETTINGS
// ==========================================

app.get('/api/settings', (req: AuthRequest, res: Response) => {
  res.json({ success: true, settings: db.get('settings') });
});

app.put('/api/settings', (req: AuthRequest, res: Response) => {
  const currentSettings = db.get('settings');
  const updatedSettings: MohallaSettings = {
    ...currentSettings,
    ...req.body,
  };

  db.set('settings', updatedSettings);
  db.logAudit(
    req.user || db.get('users')[0],
    'SETTINGS_CHANGE',
    'Settings',
    'System settings updated',
  );

  res.json({ success: true, settings: updatedSettings });
});

registerModuleRoutes(app);
app.use('/api', (_req, res) => res.status(404).json({ success: false, message: 'API endpoint not found.' }));

// Vite Development Integration
async function startServer() {
  await db.initialize();
  const httpServer = createHttpServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Madina Street ERP Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(() => {
  console.error('Server startup failed. Check database connectivity and configuration.');
  process.exit(1);
});
