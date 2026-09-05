const { z } = require('zod');
const telegramService = require('../services/telegram.service');
const AppError = require('../utils/AppError');
const ApiResponse = require('../utils/ApiResponse');

const inlineButtonSchema = z.object({ text: z.string().trim().min(1) }).passthrough();

const sendMessageSchema = z
  .object({
    text: z.string().trim().min(1).max(4096),
    chat_id: z.string().trim().max(100).optional(),
    parse_mode: z.enum(['HTML', 'Markdown']).optional(),
    inline_keyboard: z.array(z.array(inlineButtonSchema)).optional(),
  })
  .strict();

function parseOrThrow(schema, body) {
  const result = schema.safeParse(body);
  if (!result.success) {
    const message = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new AppError(400, message);
  }
  return result.data;
}

async function sendMessage(req, res, next) {
  try {
    const data = parseOrThrow(sendMessageSchema, req.body);

    const replyMarkup = data.inline_keyboard ? { inline_keyboard: data.inline_keyboard } : undefined;

    const result = await telegramService.sendMessage({
      text: data.text,
      chatId: data.chat_id,
      parseMode: data.parse_mode || 'HTML',
      replyMarkup,
    });

    ApiResponse.success(res, {
      data: {
        message_id: result.result?.message_id ?? null,
        chat: result.result?.chat ?? null,
      },
      message: 'Pesan berhasil dikirim.',
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { sendMessage };
