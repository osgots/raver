import { generateText } from 'ai';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');
}

function send(res, status, body) {
  setCors(res);
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

const SYSTEM_PROMPT = `You are Raver AI Support, the intelligent customer-service assistant built specifically for the Raver institution-search web app.

Raver purpose:
- Users select an institution and search a student using a roll/enrollment number.
- Search and AI Support are available without login and have no search quota.
- Guests and normal users never receive protected phone numbers.
- Only Admin and Developer roles may see phone numbers.
- Reports and feedback require login.
- Users can change their password, and forgotten passwords use the secure recovery flow.
- Developer controls maintenance mode, admin promotion, notices, users, reports, support transcripts, and audit information.
- During maintenance the site, login, notices, language controls, account functions and Support AI continue working, but student searches are paused.
- Raver supports multiple UI/voice languages and keeps language preferences on the device.

Behavior:
- Answer the actual question; do not repeat a fixed introduction.
- Use earlier messages in this conversation when useful.
- Be concise but useful and give exact UI steps when the user asks how to do something.
- Never claim you changed an account, role, password, setting, report, or deployment unless the website confirms the action.
- Never help bypass role/privacy restrictions or reveal protected phone data to guests/normal users.
- If the user asks what Raver is, explain it as an institution/student lookup interface with role-protected sensitive fields, notices, account tools, multilingual UI, maintenance controls, reports/feedback, and AI support.
- If a problem needs human/admin action, tell the signed-in user to use Report / Feedback in Customer Service.`;

function cleanHistory(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(-16)
    .map((m) => ({
      role: m?.role === 'assistant' ? 'assistant' : 'user',
      content: String(m?.content || '').trim().slice(0, 3000),
    }))
    .filter((m) => m.content);
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });

  try {
    const message = String(req.body?.message || '').trim().slice(0, 3000);
    if (!message) return send(res, 400, { error: 'Message required' });

    const history = cleanHistory(req.body?.history);
    // Avoid duplicating the current message if the browser already included it.
    const messages = history.length && history[history.length - 1]?.role === 'user' && history[history.length - 1]?.content === message
      ? history
      : [...history, { role: 'user', content: message }];

    const result = await generateText({
      model: 'openai/gpt-5.6-sol',
      system: SYSTEM_PROMPT,
      messages,
      temperature: 0.35,
      maxOutputTokens: 900,
    });

    const answer = String(result?.text || '').trim();
    if (!answer) return send(res, 502, { error: 'Empty AI response' });

    return send(res, 200, {
      answer,
      mode: 'ai',
      model: 'openai/gpt-5.6-sol',
    });
  } catch (err) {
    console.error('Raver AI Support error:', err);
    return send(res, 503, {
      error: 'AI support is temporarily unavailable',
      detail: process.env.VERCEL ? 'Check AI Gateway/OIDC for this Vercel project.' : 'Run through Vercel or configure AI_GATEWAY_API_KEY locally.',
    });
  }
}
