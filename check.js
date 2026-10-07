import { loadDb } from './db.js';

const db = loadDb();

console.log('Account:', db.accounts[0]);
console.log('Txn count:', db.transactions.length);
console.log('Sample:', db.transactions[0]);

// category-wise total (yahi getSpendingSummary karega)
const totals = {};
for (const t of db.transactions) {
  if (t.type !== 'debit') continue;
  totals[t.category] = (totals[t.category] || 0) + t.amount;
}
console.log('Spending by category:', totals);