import { config } from "./config";

/**
 * Email transaccional opcional. Sin RESEND_API_KEY los avisos se escriben en el log,
 * que es suficiente para desarrollo y para el trial.
 */
export async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
  if (!to) return false;
  if (!config.resendKey) {
    console.log(`[email:log] para=${to} asunto="${subject}"\n${text}\n`);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.emailFrom,
        to: [to],
        subject,
        text,
      }),
    });
    if (!res.ok) {
      console.error("[email] Resend fallo", res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("[email] error de red", err);
    return false;
  }
}
