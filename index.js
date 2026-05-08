import http from 'http';

const BOT_TOKEN = process.env.BOT_TOKEN;
const PORT = process.env.PORT || 3000;

if (!BOT_TOKEN) {
  console.error("ERROR: BOT_TOKEN environment variable is required");
  process.exit(1);
}

const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

const HELP_MESSAGE = [
  "GAMERS ESCROW SERVICES",
  "",
  "Send a deal amount and I will calculate the escrow fee.",
  "",
  "Examples: /fees 500",
  "",
  "CHARGES ACCORDING TO AMOUNT -",
  "• UNDER Rs 50 - Rs 5",
  "• Rs 199 - Rs 10",
  "• Rs 200 To Rs 500 - Rs 20",
  "• Rs 501 To Rs 2000 - 4%",
  "• Rs 2001 To Rs 3000 - 3.5%",
  "• Upper Than Rs 3000 - 3%",
  "------------------------------------------",
  "Note : If Deal Cancelled! 100%",
  "Of The Charge Will Be Refunded except fees.",
  "",
  "Developer:- @clerkMM"
].join("\n");

let offset = 0;

const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end("GAMERS ESCROW Bot is running");
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

function calculateFee(amount) {
  if (amount <= 50) return 5;
  if (amount <= 199) return 10;
  if (amount <= 500) return 20;
  if (amount <= 2000) return amount * 0.04;
  if (amount <= 3000) return amount * 0.035;
  return amount * 0.03;
}

function formatRupees(value) {
  const rounded = Math.ceil(value * 100) / 100;
  return Number.isInteger(rounded) ? `₹${rounded}` : `₹${rounded.toFixed(2)}`;
}

function extractAmount(text) {
  const cleaned = text.replace(/,/g, "");
  const match = cleaned.match(/(?:^|\s)(\d+(?:\.\d+)?)(?:\s|$)/);
  return match ? Number(match[1]) : null;
}

function buildCalculationMessage(amount) {
  const fee = calculateFee(amount);
  const total = amount + fee;
  return [
    `Deal Amount: ${formatRupees(amount)}`,
    `Escrow Fee: ${formatRupees(fee)}`,
    `Total Payable: ${formatRupees(total)}`,
  ].join("\n");
}

async function telegram(method, payload) {
  const response = await fetch(`${TELEGRAM_API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!data.ok) throw new Error(`${method} failed`);
  return data.result;
}

async function sendMessage(chatId, text, replyToMessageId) {
  return telegram("sendMessage", {
    chat_id: chatId,
    text,
    reply_to_message_id: replyToMessageId,
  });
}

async function handleMessage(message) {
  if (!message || !message.text) return;
  
  const text = message.text.trim();
  const chatId = message.chat.id;
  const replyToMessageId = message.message_id;

  // Handle /start or /help - show help message
  if (text === "/start" || text === "/help") {
    await sendMessage(chatId, HELP_MESSAGE, replyToMessageId);
    return;
  }

  // Handle /fees command ONLY (not /fee)
  const commandMatch = text.match(/^\/(?:fees)(?:@\w+)?(?:\s+(.+))?$/i);
  if (commandMatch) {
    const amount = commandMatch[1] ? extractAmount(commandMatch[1]) : null;
    if (!amount || amount <= 0) {
      await sendMessage(chatId, "Send the deal amount like /fees 500", replyToMessageId);
      return;
    }
    await sendMessage(chatId, buildCalculationMessage(amount), replyToMessageId);
    return;
  }

  // In private chat, if no command is used, send help message
  if (message.chat.type === "private") {
    await sendMessage(chatId, HELP_MESSAGE, replyToMessageId);
  }
}

async function poll() {
  while (true) {
    try {
      const updates = await telegram("getUpdates", { offset, timeout: 50 });
      for (const update of updates) {
        offset = update.update_id + 1;
        if (update.message) await handleMessage(update.message);
      }
    } catch (error) {
      console.error(error.message);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
}

poll();
