import 'dotenv/config';
import { resolve4 } from 'node:dns/promises';
import { isIP } from 'node:net';
import nodemailer, { Transporter } from 'nodemailer';

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character];
  });

/**
 * NotificationService
 * Sends email via Nodemailer (SMTP/Gmail).
 */
class NotificationService {
  private resendApiKey: string | null = null;
  private smtpConfig: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
  } | null = null;

  constructor() {
    this.initMailer();
  }

  // ─── Email (Nodemailer SMTP) ────────────────────────────────────────────────

  private initMailer(): void {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
    if (process.env.RESEND_API_KEY) {
      this.resendApiKey = process.env.RESEND_API_KEY;
      console.log('[NotificationService] Resend email API configured.');
      return;
    }

    if (
      SMTP_HOST &&
      SMTP_USER &&
      SMTP_PASS &&
      !SMTP_USER.includes('your_gmail') &&
      !SMTP_PASS.includes('your_gmail')
    ) {
      this.smtpConfig = {
        host: SMTP_HOST,
        port: Number(SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        user: SMTP_USER,
        pass: SMTP_PASS,
      };
      console.log('[NotificationService] Email (SMTP) transport initialized.');
    } else {
      console.warn(
        '[NotificationService] Email not configured — set RESEND_API_KEY and EMAIL_FROM, or configure SMTP_HOST, SMTP_USER, and SMTP_PASS.'
      );
    }
  }

  async sendEmail(opts: {
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<boolean> {
    if (this.resendApiKey) {
      const from = process.env.EMAIL_FROM;
      if (!from) {
        console.error('[NotificationService] Email not sent: EMAIL_FROM is required when using Resend.');
        return false;
      }

      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from,
            to: [opts.to],
            subject: opts.subject,
            html: opts.html,
            text: opts.text,
          }),
          signal: AbortSignal.timeout(15_000),
        });

        if (!response.ok) {
          const details = await response.json().catch(() => null) as { message?: string } | null;
          console.error(
            `[NotificationService] Resend rejected email to ${opts.to} (HTTP ${response.status}): ${details?.message || response.statusText}`
          );
          return false;
        }

        const result = await response.json().catch(() => null) as { id?: string } | null;
        console.log(`[NotificationService] Email accepted by Resend → ${opts.to}${result?.id ? ` | ID: ${result.id}` : ''}`);
        return true;
      } catch (err) {
        console.error(`[NotificationService] Resend request failed for ${opts.to}:`, err);
        return false;
      }
    }

    if (!this.smtpConfig) {
      console.warn(
        `[NotificationService] Email not sent to ${opts.to}: Resend and SMTP are not configured.`
      );
      return false;
    }

    let mailer: Transporter | null = null;
    try {
      const smtpHost = this.smtpConfig.host;
      const ipAddress = isIP(smtpHost) ? smtpHost : (await resolve4(smtpHost))[0];
      if (!ipAddress) {
        throw new Error(`SMTP host ${smtpHost} did not resolve to an IPv4 address.`);
      }

      mailer = nodemailer.createTransport({
        host: ipAddress,
        port: this.smtpConfig.port,
        secure: this.smtpConfig.secure,
        auth: { user: this.smtpConfig.user, pass: this.smtpConfig.pass },
        ...(isIP(smtpHost) ? {} : { tls: { servername: smtpHost } }),
        connectionTimeout: 8_000,
        greetingTimeout: 8_000,
        socketTimeout: 12_000,
        dnsTimeout: 5_000,
      });
      const info = await mailer.sendMail({
        from:
          process.env.EMAIL_FROM && !process.env.EMAIL_FROM.includes('your_gmail')
            ? process.env.EMAIL_FROM
            : this.smtpConfig.user || '"StatusForge Alerts" <alerts@statusforge.io>',
        to: opts.to,
        subject: opts.subject,
        text: opts.text,
        html: opts.html,
      });
      console.log(`[NotificationService] Email sent → ${opts.to} | Message-ID: ${info.messageId}`);
      return true;
    } catch (err) {
      console.error(`[NotificationService] Email failed for ${opts.to}:`, err);
      return false;
    } finally {
      mailer?.close();
    }
  }

  async sendSignInNotice(opts: {
    to: string;
    name: string;
    provider: 'password' | 'Google';
  }): Promise<boolean> {
    const name = escapeHtml(opts.name);
    const provider = escapeHtml(opts.provider);
    const time = new Date().toUTCString();
    const text = `Hello ${opts.name},\n\nYour StatusForge account was signed in using ${opts.provider} at ${time}.\n\nIf this wasn't you, reset your password and contact your organization administrator.\n\nStatusForge Security`;
    return this.sendEmail({
      to: opts.to,
      subject: 'New sign-in to your StatusForge account',
      text,
      html: `<p>Hello ${name},</p><p>Your StatusForge account was signed in using <strong>${provider}</strong> at ${escapeHtml(time)}.</p><p>If this wasn't you, reset your password and contact your organization administrator.</p><p>StatusForge Security</p>`,
    });
  }

  async sendTeamInvitation(opts: {
    to: string;
    name: string;
    inviterName: string;
    organizationName: string;
    role: string;
    inviteUrl: string;
  }): Promise<boolean> {
    const name = escapeHtml(opts.name);
    const inviter = escapeHtml(opts.inviterName);
    const organization = escapeHtml(opts.organizationName);
    const role = escapeHtml(opts.role);
    const inviteUrl = escapeHtml(opts.inviteUrl);
    const text = `Hello ${opts.name},\n\n${opts.inviterName} has added you to the invitation list for ${opts.organizationName} on StatusForge as a ${opts.role}. Accept the invitation to activate your organization access and set your password within 48 hours:\n${opts.inviteUrl}\n\nIf you weren't expecting this invitation, you can ignore this email.\n\nStatusForge`;
    return this.sendEmail({
      to: opts.to,
      subject: `Invitation to join ${opts.organizationName} on StatusForge`,
      text,
      html: `<p>Hello ${name},</p><p><strong>${inviter}</strong> has added you to the invitation list for <strong>${organization}</strong> on StatusForge as a <strong>${role}</strong>. Accept the invitation to activate your organization access.</p><p><a href="${inviteUrl}">Accept invitation and set your password</a></p><p>This invitation expires in 48 hours. If you weren't expecting it, you can ignore this email.</p><p>StatusForge</p>`,
    });
  }

  async sendTeamAccessActivated(opts: {
    to: string;
    name: string;
    organizationName: string;
  }): Promise<boolean> {
    const name = escapeHtml(opts.name);
    const organization = escapeHtml(opts.organizationName);
    const text = `Hello ${opts.name},\n\nYour StatusForge account has been added to ${opts.organizationName}. You can now sign in and access your organization's services, on-call schedules, and escalation policies.\n\nStatusForge`;
    return this.sendEmail({
      to: opts.to,
      subject: `You now have access to ${opts.organizationName} on StatusForge`,
      text,
      html: `<p>Hello ${name},</p><p>Your StatusForge account has been added to <strong>${organization}</strong>. You can now sign in and access your organization's services, on-call schedules, and escalation policies.</p><p>StatusForge</p>`,
    });
  }

  async sendOnCallAssignmentNotice(opts: {
    to: string;
    name: string;
    scheduleName: string;
    serviceName: string;
    rotationType: 'daily' | 'weekly';
    timezone: string;
  }): Promise<boolean> {
    const name = escapeHtml(opts.name);
    const schedule = escapeHtml(opts.scheduleName);
    const service = escapeHtml(opts.serviceName);
    const rotation = escapeHtml(opts.rotationType);
    const timezone = escapeHtml(opts.timezone);
    const text = `Hello ${opts.name},\n\nYou have been added to the ${opts.rotationType} on-call rotation "${opts.scheduleName}" for ${opts.serviceName} in StatusForge.\n\nRotation timezone: ${opts.timezone}\n\nStatusForge`;
    return this.sendEmail({
      to: opts.to,
      subject: `Added to ${opts.rotationType} on-call rotation: ${opts.scheduleName}`,
      text,
      html: `<p>Hello ${name},</p><p>You have been added to the <strong>${rotation}</strong> on-call rotation <strong>${schedule}</strong> for <strong>${service}</strong> in StatusForge.</p><p>Rotation timezone: ${timezone}</p><p>StatusForge</p>`,
    });
  }

  async sendEscalationPolicyAssignmentNotice(opts: {
    to: string;
    name: string;
    policyName: string;
    serviceName: string;
    steps: Array<{ order: number; timeoutMinutes: number }>;
  }): Promise<boolean> {
    const name = escapeHtml(opts.name);
    const policy = escapeHtml(opts.policyName);
    const service = escapeHtml(opts.serviceName);
    const stepDetails = opts.steps
      .map((step) => `Step ${step.order}: notify after ${step.timeoutMinutes} minutes`)
      .join('\n');
    const htmlSteps = opts.steps
      .map((step) => `<li>Step ${step.order}: notify after ${step.timeoutMinutes} minutes</li>`)
      .join('');
    const text = `Hello ${opts.name},\n\nYou have been added to the escalation policy "${opts.policyName}" for ${opts.serviceName} in StatusForge.\n\n${stepDetails}\n\nStatusForge`;
    return this.sendEmail({
      to: opts.to,
      subject: `Added to escalation policy: ${opts.policyName}`,
      text,
      html: `<p>Hello ${name},</p><p>You have been added to the escalation policy <strong>${policy}</strong> for <strong>${service}</strong> in StatusForge.</p><ul>${htmlSteps}</ul><p>StatusForge</p>`,
    });
  }

  async sendPasswordReset(opts: { to: string; name: string; resetUrl: string }): Promise<boolean> {
    const name = escapeHtml(opts.name);
    const resetUrl = escapeHtml(opts.resetUrl);
    const text = `Hello ${opts.name},\n\nWe received a request to reset your StatusForge password. Use this link within one hour:\n${opts.resetUrl}\n\nIf you did not request a reset, ignore this email. Your password will not change unless the link is used.\n\nStatusForge Security`;
    return this.sendEmail({
      to: opts.to,
      subject: 'Reset your StatusForge password',
      text,
      html: `<p>Hello ${name},</p><p>We received a request to reset your StatusForge password.</p><p><a href="${resetUrl}">Reset your password</a></p><p>This link expires in one hour. If you did not request a reset, ignore this email.</p><p>StatusForge Security</p>`,
    });
  }

  async sendPasswordChangedNotice(opts: { to: string; name: string }): Promise<boolean> {
    const name = escapeHtml(opts.name);
    const time = escapeHtml(new Date().toUTCString());
    const text = `Hello ${opts.name},\n\nYour StatusForge password was changed at ${new Date().toUTCString()}.\n\nIf you did not make this change, contact your organization administrator immediately.\n\nStatusForge Security`;
    return this.sendEmail({
      to: opts.to,
      subject: 'Your StatusForge password was changed',
      text,
      html: `<p>Hello ${name},</p><p>Your StatusForge password was changed at ${time}.</p><p>If you did not make this change, contact your organization administrator immediately.</p><p>StatusForge Security</p>`,
    });
  }

  /**
   * Dispatches an incident alert by email.
   */
  async dispatchAlert(opts: {
    userEmail: string;
    userName: string;
    incidentNumber: number;
    incidentTitle: string;
    incidentSeverity: string;
    escalationStep: number;
    serviceName: string;
    dashboardUrl?: string;
  }): Promise<boolean> {
    const {
      userEmail,
      userName,
      incidentNumber,
      incidentTitle,
      incidentSeverity,
      escalationStep,
      serviceName,
      dashboardUrl,
    } = opts;

    const url = dashboardUrl || `${process.env.CLIENT_URL || 'http://localhost:3000'}/incidents`;
    const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>StatusForge Alert</title></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#090D16;color:#E2E8F0;">
  <div style="max-width:600px;margin:40px auto;background:#0F1626;border-radius:12px;overflow:hidden;border:1px solid #1E293B;">
    <div style="background:linear-gradient(135deg,#7C3AED,#C026D3);padding:24px 32px;">
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:800;">⚡ StatusForge — Incident Alert</h1>
      <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">Escalation Step ${escalationStep} — Action Required</p>
    </div>
    <div style="padding:32px;">
      <p style="margin:0 0 16px;color:#94A3B8;font-size:14px;">Hi <strong style="color:#F8FAFC;">${userName}</strong>,</p>
      <p style="margin:0 0 24px;color:#94A3B8;font-size:14px;">
        You have been paged for an unacknowledged incident that has escalated to you.
      </p>
      <div style="background:#162035;border-radius:8px;padding:20px;border-left:4px solid ${incidentSeverity === 'P1' ? '#F43F5E' : incidentSeverity === 'P2' ? '#F97316' : '#EAB308'};">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
          <span style="background:${incidentSeverity === 'P1' ? '#F43F5E' : incidentSeverity === 'P2' ? '#F97316' : '#EAB308'};color:#fff;padding:3px 10px;border-radius:9999px;font-size:12px;font-weight:700;">${incidentSeverity}</span>
          <span style="color:#94A3B8;font-size:12px;">Incident #${incidentNumber}</span>
        </div>
        <h2 style="margin:0 0 8px;color:#F8FAFC;font-size:18px;">${incidentTitle}</h2>
        <p style="margin:0;color:#64748B;font-size:13px;">Service: <strong style="color:#94A3B8;">${serviceName}</strong></p>
      </div>
      <div style="margin-top:28px;text-align:center;">
        <a href="${url}" style="display:inline-block;background:linear-gradient(135deg,#7C3AED,#C026D3);color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">
          → View Incident & Acknowledge
        </a>
      </div>
      <p style="margin:24px 0 0;color:#475569;font-size:12px;text-align:center;">
        This alert was sent by StatusForge Escalation Engine. If you believe this is an error, contact your team admin.
      </p>
    </div>
  </div>
</body>
</html>`;

    const emailText = `
StatusForge — Incident Alert (Escalation Step ${escalationStep})

Hi ${userName},

You have been paged for an unacknowledged incident.

Incident #${incidentNumber} [${incidentSeverity}]
Title: ${incidentTitle}
Service: ${serviceName}

→ Acknowledge here: ${url}

— StatusForge Escalation Engine
`;

    return this.sendEmail({
      to: userEmail,
      subject: `[ESCALATION Step ${escalationStep}] ${incidentSeverity} Incident #${incidentNumber}: ${incidentTitle}`,
      html: emailHtml,
      text: emailText,
    });
  }
}

// Singleton export
export const notificationService = new NotificationService();
