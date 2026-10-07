import 'dotenv/config';
import readline from 'readline';
import Groq from 'groq-sdk';
import {
  getBalance,
  getTransactions,
  getSpendingSummary,
  setBudget,
  checkBudgetStatus,
} from './tools.js';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// tool name -> function
const toolFunctions = {
  getBalance,
  getTransactions,
  getSpendingSummary,
  setBudget,
  checkBudgetStatus,
};

// ---- Tool schemas (LLM inhe padh ke decide karta hai) ----
const tools = [
  {
    type: 'function',
    function: {
      name: 'getBalance',
      description: 'Get the current balance of a bank account.',
      parameters: {
        type: 'object',
        properties: {
          accountId: { type: 'string', description: 'The account id, e.g. acc1' },
        },
        required: ['accountId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getTransactions',
      description:
        'List transactions of an account. Returns at most 10 latest rows (hard limit). Use only when user wants to see individual transactions. For totals use getSpendingSummary instead.',
      parameters: {
        type: 'object',
        properties: {
          accountId: { type: 'string', description: 'The account id' },
          category: {
            type: 'string',
            description: 'Optional filter: food, travel, shopping, bills or income',
          },
          fromDate: { type: 'string', description: 'Optional ISO start date, e.g. 2026-09-01T00:00:00.000Z' },
          toDate: { type: 'string', description: 'Optional ISO end date' },
        },
        required: ['accountId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getSpendingSummary',
      description:
        'Get total money spent per category for a month, sorted highest first, plus the top category. Use for questions like "how much did I spend on food" or "biggest spending category".',
      parameters: {
        type: 'object',
        properties: {
          accountId: { type: 'string', description: 'The account id' },
          month: { type: 'string', description: 'Month in YYYY-MM format, e.g. 2026-09' },
        },
        required: ['accountId', 'month'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'setBudget',
      description: 'Save or update the monthly spending limit for a category.',
      parameters: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'The user id' },
          category: { type: 'string', description: 'food, travel, shopping or bills' },
          limit: { type: 'number', description: 'Monthly limit in rupees' },
          month: { type: 'string', description: 'Optional, YYYY-MM. Defaults to current month' },
        },
        required: ['userId', 'category', 'limit'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'checkBudgetStatus',
      description:
        'Compare spending against the budget limit of a category: returns spent, limit, remaining and whether over budget.',
      parameters: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'The user id' },
          category: { type: 'string', description: 'food, travel, shopping or bills' },
          month: { type: 'string', description: 'Optional, YYYY-MM. Defaults to current month' },
        },
        required: ['userId', 'category'],
      },
    },
  },
];

// ---- System prompt ----
const today = new Date();
const currentMonth = today.toISOString().slice(0, 7);
const lastMonthDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
const lastMonth = lastMonthDate.toISOString().slice(0, 7);

const systemPrompt = `You are a polite Personal Finance Assistant for a bank.

Logged-in user: userId = "user1", accountId = "acc1". Always use these ids; never ask the user for them.
Today's date: ${today.toISOString().slice(0, 10)}
Current month: ${currentMonth}
Last month: ${lastMonth}
Currency: Indian rupees (₹).

Rules:
- Never calculate totals yourself. Use tools for balances, spending and budgets.
- Use getSpendingSummary for totals/aggregation, getTransactions only to list individual rows.
- getTransactions returns at most 10 rows. If the user asks for all transactions, show the latest 10 and clearly say these are only the latest 10.
- For "am I over budget" questions, call getSpendingSummary first, then checkBudgetStatus for the relevant category.
- If a tool returns an error, explain it simply to the user.
- Keep answers short and clear. Reply in the same language style as the user.`;

// ---- Agent loop (ek question ke liye) ----
const runAgent = async (messages) => {
  const MAX_STEPS = 6;

  for (let step = 0; step < MAX_STEPS; step++) {
    const response = await groq.chat.completions.create({
      model: 'openai/gpt-oss-20b',
      messages,
      tools,
      tool_choice: 'auto',
    });

    const message = response.choices[0].message;
    messages.push(message);

    // tool call nahi => final answer
    if (!message.tool_calls || message.tool_calls.length === 0) {
      return message.content;
    }

    for (const toolCall of message.tool_calls) {
      const fnName = toolCall.function.name;
      let result;

      try {
        const args = JSON.parse(toolCall.function.arguments);
        console.log(`  🔧 ${fnName}`, args);
        const fn = toolFunctions[fnName];
        result = fn ? fn(args) : { error: `Tool ${fnName} not found` };
      } catch (err) {
        result = { error: err.message };
      }

      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(result), // string hona zaroori hai
      });
    }
  }

  return 'Sorry, I could not finish this request. Please try again.';
};

// ---- Terminal chat ----
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const messages = [{ role: 'system', content: systemPrompt }];

console.log('Finance Agent ready. Type your question (or "exit" to quit).\n');

const ask = () => {
  rl.question('You: ', async (input) => {
    const q = input.trim();

    if (q.toLowerCase() === 'exit') {
      console.log('Bye!');
      rl.close();
      return;
    }
    if (!q) return ask();

    messages.push({ role: 'user', content: q });

    try {
      const answer = await runAgent(messages);
      console.log(`\nAgent: ${answer}\n`);
    } catch (err) {
      console.log('\nError:', err.message, '\n');
    }

    ask();
  });
};

ask();