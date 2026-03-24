/**
 * Verstuurt opvolgmail via Gmail (SMTP) — geheimen alleen in Netlify env.
 * Body JSON: { to, subject, text, html }
 * Header: x-followup-secret: <zelfde als FOLLOWUP_API_SECRET>
 */
import nodemailer from 'nodemailer';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, X-Followup-Secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const expected = process.env.FOLLOWUP_API_SECRET || '';
  const got =
    event.headers['x-followup-secret'] ||
    event.headers['X-Followup-Secret'] ||
    '';
  if (!expected || got !== expected) {
    return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Server missing GMAIL_USER or GMAIL_APP_PASSWORD' }),
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { to, subject, text, html } = payload;
  if (!to || !subject) {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Missing to or subject' }) };
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });

  try {
    await transporter.sendMail({
      from: `"HohohSolutions CRM" <${user}>`,
      to,
      subject,
      text: text || '',
      html: html || undefined,
    });
  } catch (err) {
    console.error('send-followup', err);
    return {
      statusCode: 502,
      headers: corsHeaders,
      body: JSON.stringify({ error: err.message || 'Send failed' }),
    };
  }

  return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ ok: true }) };
};
