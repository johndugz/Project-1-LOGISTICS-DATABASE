import nodemailer from 'nodemailer';

const getSmtpConfig = () => {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;

  if (!host || !user || !pass) {
    return null;
  }

  return {
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
  };
};

export async function sendVerificationEmail(toEmail: string, code: string): Promise<boolean> {
  const smtp = getSmtpConfig();

  if (!smtp) {
    return false;
  }

  const transporter = nodemailer.createTransport(smtp);

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: toEmail,
    subject: 'TOPLIS Logistics - Verify your email',
    text: `Your verification code is: ${code}. This code expires in 15 minutes.`,
    html: `<p>Your verification code is: <strong>${code}</strong></p><p>This code expires in 15 minutes.</p>`,
  });

  return true;
}
