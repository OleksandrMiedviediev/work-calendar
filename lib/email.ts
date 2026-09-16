import "server-only";
import nodemailer from "nodemailer";

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

export async function sendVerificationEmail(email: string, token: string) {
  const baseUrl = required("APP_BASE_URL").replace(/\/$/, "");
  const verifyUrl = `${baseUrl}/api/auth/verify?token=${encodeURIComponent(token)}`;
  const subject = "Подтверди email для Work Calendar";
  const text = `Подтверди email по ссылке: ${verifyUrl}`;
  const html = `<main style="font-family:Arial,sans-serif;max-width:560px;margin:40px auto"><h1>Work Calendar</h1><p>Подтверди email, чтобы войти в аккаунт.</p><p><a href="${verifyUrl}" style="display:inline-block;padding:12px 18px;background:#111;color:#fff;text-decoration:none;border-radius:8px">Подтвердить email</a></p><p>Ссылка действует 24 часа.</p></main>`;

  if (process.env.BREVO_API_KEY) {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": process.env.BREVO_API_KEY,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        sender: { email: process.env.MAIL_FROM || required("SMTP_USER") },
        to: [{ email }],
        subject,
        textContent: text,
        htmlContent: html
      })
    });
    if (!response.ok) throw new Error(`Brevo API rejected email: ${response.status}`);
    return;
  }

  const transporter = nodemailer.createTransport({
    host: required("SMTP_HOST"),
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: required("SMTP_USER"),
      pass: required("SMTP_PASS")
    }
  });

  await transporter.sendMail({
    from: process.env.MAIL_FROM || required("SMTP_USER"),
    to: email,
    subject,
    text,
    html
  });
}
