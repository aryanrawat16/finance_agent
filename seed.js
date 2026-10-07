import { saveDb } from './db.js';

const USER_ID = 'user1';
const ACCOUNT_ID = 'acc1';

const merchants = {
  food: ['Zomato', 'Swiggy', 'Dominos', 'Cafe Coffee Day', 'Local Dhaba'],
  travel: ['Uber', 'Ola', 'IRCTC', 'MakeMyTrip', 'Redbus'],
  shopping: ['Amazon', 'Flipkart', 'Myntra', 'Reliance Digital'],
  bills: ['Airtel', 'Jio', 'Electricity Board', 'Netflix', 'Water Dept'],
};

const ranges = {
  food: [100, 900],
  travel: [80, 2500],
  shopping: [300, 6000],
  bills: [200, 2500],
};

const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[randInt(0, arr.length - 1)];

// pichle 90 din ke andar random date
const randomDate = () => {
  const d = new Date();
  d.setDate(d.getDate() - randInt(0, 90));
  d.setHours(randInt(8, 22), randInt(0, 59), 0, 0);
  return d.toISOString();
};

const categories = Object.keys(merchants);
const transactions = [];

for (let i = 1; i <= 250; i++) {
  const isCredit = Math.random() < 0.08; // ~8% credit

  if (isCredit) {
    transactions.push({
      txnId: `txn${i}`,
      accountId: ACCOUNT_ID,
      amount: randInt(2000, 30000),
      type: 'credit',
      category: 'income',
      merchant: pick(['Salary', 'Refund', 'UPI Received']),
      date: randomDate(),
    });
  } else {
    const category = pick(categories);
    const [min, max] = ranges[category];
    transactions.push({
      txnId: `txn${i}`,
      accountId: ACCOUNT_ID,
      amount: randInt(min, max),
      type: 'debit',
      category,
      merchant: pick(merchants[category]),
      date: randomDate(),
    });
  }
}

// latest pehle (getTransactions ke liye kaam aayega)
transactions.sort((a, b) => b.date.localeCompare(a.date));

saveDb({
  accounts: [
    { accountId: ACCOUNT_ID, userId: USER_ID, accountType: 'savings', balance: 85000 },
  ],
  transactions,
  budgets: [], // agent yahan likhega
});

console.log(`Seeded: 1 account, ${transactions.length} transactions`);