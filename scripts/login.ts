import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import input from "input";

const apiId = Number(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;

if (!apiId || !apiHash) {
  console.error("Set TELEGRAM_API_ID and TELEGRAM_API_HASH before running login.");
  process.exit(1);
}

async function main() {
  const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () => input.text("Phone number: "),
    phoneCode: async () => input.text("Telegram login code: "),
    password: async () => input.text("2FA password, if enabled: "),
    onError: (err) => console.error("Login error:", err),
  });

  console.log("\nSave this value as TELEGRAM_SESSION in your .env:\n");
  console.log(client.session.save());

  await client.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
