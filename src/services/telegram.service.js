const env = require('../config/env');
const AppError = require('../utils/AppError');

async function sendMessage({ text, chatId, parseMode = 'HTML', replyMarkup }) {
  const { botToken, defaultChatId, apiUrl } = env.telegram;

  if (!botToken) {
    throw new AppError(500, 'TELEGRAM_BOT_TOKEN belum disetel di .env.');
  }

  const payload = {
    chat_id: chatId || defaultChatId,
    text,
    parse_mode: parseMode,
  };

  if (replyMarkup) {
    payload.reply_markup = replyMarkup;
  }

  const response = await fetch(`${apiUrl}/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const body = await response.json();

  if (!body.ok) {
    throw new AppError(502, `Telegram API error: ${body.description || 'Unknown error'}`);
  }

  return body;
}

module.exports = { sendMessage };
