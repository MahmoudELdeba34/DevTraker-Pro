import nodemailer from 'nodemailer';

/**
 * Send an email using SMTP if configured, otherwise mock-print to console.
 */
export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpHost || !smtpUser || !smtpPass) {
    // Mock mode — print to console
    console.log('\n╔══════════════════════════════════════════════════════╗');
    console.log('║              📧  MOCK EMAIL (No SMTP)               ║');
    console.log('╠══════════════════════════════════════════════════════╣');
    console.log(`║ To:      ${to}`);
    console.log(`║ Subject: ${subject}`);
    console.log('╠══════════════════════════════════════════════════════╣');
    console.log(html.replace(/<[^>]+>/g, ''));   // Strip HTML tags for console
    console.log('╚══════════════════════════════════════════════════════╝\n');
    return;
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: parseInt(smtpPort || '587'),
    secure: smtpPort === '465',
    auth: { user: smtpUser, pass: smtpPass },
  });

  await transporter.sendMail({
    from: `"DevTracker Pro" <${smtpUser}>`,
    to,
    subject,
    html,
  });
}

/**
 * Generate a random password of the given length.
 */
export function generatePassword(length = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

export function isSmtpConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}
