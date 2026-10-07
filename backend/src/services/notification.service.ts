import 'dotenv/config';
import nodemailer, { Transporter } from 'nodemailer';

/**
 * NotificationService
 * Sends email via Nodemailer (SMTP/Gmail).
 */
class NotificationService {
  private mailer: Transporter | null = null;

  constructor() {
    this.initMailer();
  }

  // ─── Email (Nodemailer SMTP) ────────────────────────────────────────────────

  private initMailer(): void {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
    if (
      SMTP_HOST &&
      SMTP_USER &&
      SMTP_PASS &&
      !SMTP_USER.includes('your_gmail') &&
      !SMTP_PASS.includes('your_gmail')
    ) {
      this.mailer = nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user: SMTP_USER, pass: SMTP_PASS },
      });
      console.log('[NotificationService] Email (SMTP) transport initialized.');
    } else {
      console.warn(
        '[NotificationService] Email SMTP not configured — set SMTP_HOST, SMTP_USER, SMTP_PASS in .env to enable real emails.'
      );
    }
  }

  async sendEmail(opts: {
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<boolean> {
    if (!this.mailer) {
      console.warn(
        `[NotificationService] Email not sent to ${opts.to}: SMTP is not configured.`
      );
      return false;
    }
    try {
      const info = await this.mailer.sendMail({
        from:
          process.env.EMAIL_FROM && !process.env.EMAIL_FROM.includes('your_gmail')
            ? process.env.EMAIL_FROM
            : process.env.SMTP_USER || '"StatusForge Alerts" <alerts@statusforge.io>',
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
    }
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
