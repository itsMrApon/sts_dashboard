/**
 * Ready-made SMTP settings for the email services creators use most, with where to get the
 * password. Picking one only fills the form; everything can still be changed.
 */

export type SmtpProviderId = 'gmail' | 'zoho' | 'brevo' | 'resend' | 'custom'

export type SetupLink = { label: string; href: string }

export type SmtpProvider = {
  id: SmtpProviderId
  label: string
  host: string
  port: number
  secure: boolean
  /** What goes in Username, when it is not just the email address. */
  username?: string
  usernameHint: string
  passwordHint: string
  /** The daily or monthly limit on the free plan, so creators know when to move. */
  limit: string
  links: SetupLink[]
}

export const SMTP_PROVIDERS: SmtpProvider[] = [
  {
    id: 'gmail',
    label: 'Gmail',
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    usernameHint: 'Your Gmail address',
    passwordHint: 'A 16-letter App Password, not your Gmail password. It needs 2-Step Verification turned on.',
    limit: 'About 500 emails a day',
    links: [
      { label: 'Turn on 2-Step Verification', href: 'https://myaccount.google.com/signinoptions/twosv' },
      { label: 'Make an App Password', href: 'https://myaccount.google.com/apppasswords' },
    ],
  },
  {
    id: 'zoho',
    label: 'Zoho Mail',
    host: 'smtp.zoho.com',
    port: 465,
    secure: true,
    usernameHint: 'Your Zoho Mail address',
    passwordHint: 'An app-specific password from your Zoho account security settings.',
    limit: 'Depends on your Zoho plan',
    links: [
      { label: 'Zoho SMTP settings', href: 'https://www.zoho.com/mail/help/zoho-smtp.html' },
      { label: 'Make an app password', href: 'https://accounts.zoho.com/home#security/app_password' },
    ],
  },
  {
    id: 'brevo',
    label: 'Brevo',
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
    usernameHint: 'The SMTP login Brevo shows (it ends in @smtp-brevo.com)',
    passwordHint: 'An SMTP key from Brevo, not your Brevo password.',
    limit: '300 emails a day free',
    links: [
      { label: 'Sign up for Brevo', href: 'https://onboarding.brevo.com/account/register' },
      { label: 'Get your SMTP key', href: 'https://app.brevo.com/settings/keys/smtp' },
      { label: 'Add your sender address', href: 'https://app.brevo.com/senders' },
    ],
  },
  {
    id: 'resend',
    label: 'Resend',
    host: 'smtp.resend.com',
    port: 465,
    secure: true,
    username: 'resend',
    usernameHint: 'Always the word resend',
    passwordHint: 'A Resend API key (starts with re_). The From address must be on a domain you added to Resend.',
    limit: '3,000 emails a month free',
    links: [
      { label: 'Sign up for Resend', href: 'https://resend.com/signup' },
      { label: 'Add your domain', href: 'https://resend.com/domains' },
      { label: 'Make an API key', href: 'https://resend.com/api-keys' },
    ],
  },
  {
    id: 'custom',
    label: 'Other',
    host: '',
    port: 587,
    secure: false,
    usernameHint: 'Usually your full email address',
    passwordHint: 'Your mailbox password, or an app password if your provider uses them.',
    limit: 'Ask your email provider',
    links: [],
  },
]

export function smtpProvider(id: string | null | undefined): SmtpProvider {
  return SMTP_PROVIDERS.find((provider) => provider.id === id) ?? SMTP_PROVIDERS[SMTP_PROVIDERS.length - 1]
}
