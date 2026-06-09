import bcrypt from 'bcrypt';
import User from '../models/User';
import { sendEmail, generatePassword, isSmtpConfigured } from '../utils/email';
import { issueAccountSetup } from '../utils/accountSetup';
import { revokeAllUserTokens } from '../utils/tokens';

const SALT_ROUNDS = 10;

export interface DeliverCredentialsInput {
  userId: string;
  email: string;
  name: string;
  tempPassword: string;
  emailSubject?: string;
  /** Extra lines inside the credentials box (HTML). */
  emailExtrasHtml?: string;
  /** Intro paragraph under the title. */
  emailIntro?: string;
}

export interface DeliverCredentialsResult {
  tempPassword: string;
  setupLink: string;
  shareMessage: string;
  setupExpiresAt: Date;
  emailSent: boolean;
  /** `email` when SMTP delivered; `manual` when admin must copy/share. */
  deliveryMethod: 'email' | 'manual';
}

function buildWelcomeEmailHtml(input: DeliverCredentialsInput, setupLink: string): string {
  return `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px;background:#0f172a;color:#e2e8f0;border-radius:18px;">
      <div style="text-align:center;margin-bottom:24px;">
        <h1 style="color:#a78bfa;margin:0 0 6px;font-size:24px;">Welcome to DevTracker Pro!</h1>
        <p style="margin:0;color:#94a3b8;font-size:14px;">${input.emailIntro || `Hello <strong style="color:#e2e8f0;">${input.name}</strong>, your account is ready.`}</p>
      </div>
      <div style="background:#1e293b;padding:22px;border-radius:14px;margin:24px 0;border:1px solid #334155;">
        <p style="margin:0 0 10px;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;">Login credentials</p>
        <p style="margin:8px 0;"><strong>Email:</strong> ${input.email}</p>
        <p style="margin:8px 0;"><strong>Temporary password:</strong>
          <code style="background:#0f172a;padding:6px 10px;border-radius:6px;color:#f472b6;">${input.tempPassword}</code>
        </p>
        ${input.emailExtrasHtml || ''}
      </div>
      <div style="text-align:center;margin:28px 0;">
        <a href="${setupLink}" style="display:inline-block;background:#6366f1;color:white;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:bold;">Set your password</a>
      </div>
      <p style="color:#64748b;font-size:12px;text-align:center;">Link expires in 7 days. Change your password after first sign-in.</p>
    </div>
  `;
}

/** Create setup link + optional SMTP email. Always returns share payload for the admin UI. */
export async function deliverAccountCredentials(
  input: DeliverCredentialsInput
): Promise<DeliverCredentialsResult> {
  const setup = await issueAccountSetup(input.userId, input.email, input.tempPassword);

  let emailSent = false;
  if (isSmtpConfigured()) {
    try {
      await sendEmail(
        input.email,
        input.emailSubject || 'DevTracker Pro — Your account credentials',
        buildWelcomeEmailHtml(input, setup.setupLink)
      );
      emailSent = true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('deliverAccountCredentials email failed:', message);
    }
  }

  return {
    tempPassword: input.tempPassword,
    setupLink: setup.setupLink,
    shareMessage: setup.shareMessage,
    setupExpiresAt: setup.expiresAt,
    emailSent,
    deliveryMethod: emailSent ? 'email' : 'manual',
  };
}

/** New temp password + fresh setup link (resend credentials). */
export async function rotatePasswordAndDeliver(opts: {
  userId: string;
  emailIntro?: string;
}): Promise<
  DeliverCredentialsResult & {
    user: { _id: string; name: string; email: string };
  }
> {
  const user = await User.findById(opts.userId);
  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }

  const tempPassword = generatePassword(12);
  user.passwordHash = await bcrypt.hash(tempPassword, SALT_ROUNDS);
  await user.save();
  await revokeAllUserTokens(opts.userId);

  const delivery = await deliverAccountCredentials({
    userId: user._id.toString(),
    email: user.email,
    name: user.name,
    tempPassword,
    emailSubject: 'DevTracker Pro — Updated login credentials',
    emailIntro:
      opts.emailIntro ||
      `Hello <strong style="color:#e2e8f0;">${user.name}</strong>, here are your updated login details.`,
  });

  return {
    ...delivery,
    user: {
      _id: user._id.toString(),
      name: user.name,
      email: user.email,
    },
  };
}

export function credentialsResponsePayload(
  delivery: DeliverCredentialsResult,
  invitedUser: { _id: unknown; email: string; name: string },
  extra: Record<string, unknown> = {}
) {
  return {
    invitedUser: {
      _id: invitedUser._id,
      email: invitedUser.email,
      name: invitedUser.name,
    },
    setupLink: delivery.setupLink,
    shareMessage: delivery.shareMessage,
    setupExpiresAt: delivery.setupExpiresAt,
    emailSent: delivery.emailSent,
    deliveryMethod: delivery.deliveryMethod,
    ...extra,
  };
}
