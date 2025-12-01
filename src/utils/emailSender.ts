import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendVerificationEmail(to: string, verifyUrl: string) {
  await resend.emails.send({
    from: "Trustworthy AI <noreply@resend.dev>",
    to,
    subject: "請驗證您的帳戶",
    html: `
      <h2>請驗證您的電子郵件</h2>
      <p>感謝您註冊 Trustworthy AI Assessment System。</p>
      <p>請點擊以下連結驗證您的電子郵件：</p>
      <a href="${verifyUrl}" target="_blank">${verifyUrl}</a>
      <p>此連結將於 <strong>10 分鐘後過期</strong>。</p>
    `,
  });
}
