/**
 * Outgoing email. SMTP when SMTP_URL is set; in development without SMTP the message (including any link) is
 * written to the log instead; elsewhere mail is disabled and features that need it report themselves off
 * (AuthProviders.passwordReset). Sending is fire-and-forget so responses take the same time either way.
 */
import nodemailer from 'nodemailer';
import type { Logger } from '../context';
import type { Env } from '../env';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface Mailer {
  /** smtp = delivered · console = logged (development only) · disabled = dropped · capture = recorded (tests). */
  readonly kind: 'smtp' | 'console' | 'disabled' | 'capture';
  /** True when a message actually reaches someone (or the developer's console). */
  readonly enabled: boolean;
  /** Returns immediately and never throws; delivery happens later and failures are logged. */
  send(message: MailMessage): void;
  /** Release SMTP connections (graceful shutdown). */
  close(): void;
}

export function createMailer(env: Pick<Env, 'NODE_ENV' | 'SMTP_URL' | 'MAIL_FROM'>, logger: Logger): Mailer {
  if (env.SMTP_URL) {
    const transport = nodemailer.createTransport(env.SMTP_URL);
    return {
      kind: 'smtp',
      enabled: true,
      send(message) {
        setImmediate(() => {
          try {
            transport.sendMail({ from: env.MAIL_FROM, ...message }).catch((error: unknown) => {
              logger.error({ err: error, subject: message.subject }, 'Email delivery failed');
            });
          } catch (error) {
            logger.error({ err: error, subject: message.subject }, 'Email delivery failed');
          }
        });
      },
      close: () => transport.close(),
    };
  }

  if (env.NODE_ENV === 'development') {
    return {
      kind: 'console',
      enabled: true,
      send(message) {
        setImmediate(() => {
          logger.info({ mail: { to: message.to, subject: message.subject, text: message.text } }, 'Email (development: logged, not sent)');
        });
      },
      close: () => undefined,
    };
  }

  return {
    kind: 'disabled',
    enabled: false,
    send(message) {
      logger.debug({ subject: message.subject }, 'Email dropped (no SMTP_URL configured)');
    },
    close: () => undefined,
  };
}

export interface CapturingMailer extends Mailer {
  /** Every message passed to send(), in order. */
  readonly outbox: MailMessage[];
  clear(): void;
}

/** Test mailer: records messages synchronously so a test can read them as soon as the response arrives. */
export function createCapturingMailer(): CapturingMailer {
  const outbox: MailMessage[] = [];
  return {
    kind: 'capture',
    enabled: true,
    outbox,
    send(message) {
      outbox.push({ ...message });
    },
    clear() {
      outbox.length = 0;
    },
    close: () => undefined,
  };
}
