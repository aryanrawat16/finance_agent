import { loadDb, saveDb } from './db.js';

// helper: "2026-09" -> us mahine ki start aur end date
const monthRange = (month) => {
  const [y, m] = month.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1)).toISOString();
  const end = new Date(Date.UTC(y, m, 1)).toISOString();
  return { start, end };
};

// 1. getBalance (read)
export const getBalance = ({ accountId }) => {
  const db = loadDb();
  const acc = db.accounts.find((a) => a.accountId === accountId);
  if (!acc) return { error: `Account ${accountId} not found` };
  return { accountId, balance: acc.balance, accountType: acc.accountType };
};

// 2. getTransactions (read, HARD LIMIT 10)
export const getTransactions = ({ accountId, category, fromDate, toDate }) => {
  const db = loadDb();
  const LIMIT = 10;

  let rows = db.transactions.filter((t) => t.accountId === accountId);
  if (category) rows = rows.filter((t) => t.category === category);
  if (fromDate) rows = rows.filter((t) => t.date >= fromDate);
  if (toDate) rows = rows.filter((t) => t.date <= toDate);

  rows.sort((a, b) => b.date.localeCompare(a.date)); // latest pehle

  return {
    totalMatching: rows.length,
    returned: Math.min(rows.length, LIMIT),
    note:
      rows.length > LIMIT
        ? `Showing only the latest ${LIMIT} of ${rows.length} matching transactions.`
        : 'Showing all matching transactions.',
    transactions: rows.slice(0, LIMIT),
  };
};

// 3. getSpendingSummary (compute)
export const getSpendingSummary = ({ accountId, month }) => {
  const db = loadDb();
  const { start, end } = monthRange(month);

  const totals = {};
  for (const t of db.transactions) {
    if (t.accountId !== accountId || t.type !== 'debit') continue;
    if (t.date < start || t.date >= end) continue;
    totals[t.category] = (totals[t.category] || 0) + t.amount;
  }

  const summary = Object.entries(totals)
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);

  return {
    month,
    totalSpent: summary.reduce((s, x) => s + x.total, 0),
    byCategory: summary,
    topCategory: summary[0]?.category ?? null,
  };
};

// 4. setBudget (write, upsert)
export const setBudget = ({ userId, category, limit, month }) => {
  const db = loadDb();
  const m = month || new Date().toISOString().slice(0, 7); // default: current month

  const existing = db.budgets.find(
    (b) => b.userId === userId && b.category === category && b.month === m
  );

  if (existing) {
    existing.monthlyLimit = limit;
  } else {
    db.budgets.push({ userId, category, monthlyLimit: limit, month: m });
  }

  saveDb(db);
  return { success: true, userId, category, monthlyLimit: limit, month: m };
};

// 5. checkBudgetStatus (compute)
export const checkBudgetStatus = ({ userId, category, month }) => {
  const db = loadDb();
  const m = month || new Date().toISOString().slice(0, 7);

  const budget = db.budgets.find(
    (b) => b.userId === userId && b.category === category && b.month === m
  );
  if (!budget) return { error: `No budget set for ${category} in ${m}` };

  // userId se accountId nikalo
  const acc = db.accounts.find((a) => a.userId === userId);
  const { start, end } = monthRange(m);

  const spent = db.transactions
    .filter(
      (t) =>
        t.accountId === acc.accountId &&
        t.type === 'debit' &&
        t.category === category &&
        t.date >= start &&
        t.date < end
    )
    .reduce((s, t) => s + t.amount, 0);

  return {
    category,
    month: m,
    limit: budget.monthlyLimit,
    spent,
    remaining: budget.monthlyLimit - spent,
    overBudget: spent > budget.monthlyLimit,
  };
};