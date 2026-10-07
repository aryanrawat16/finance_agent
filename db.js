import fs from 'fs';

const DB_FILE = './db.json';

export const loadDb = () => {
  if (!fs.existsSync(DB_FILE)) {
    return { accounts: [], transactions: [], budgets: [] };
  }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
};

export const saveDb = (data) => {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
};