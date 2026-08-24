import { NewMessage } from "./gramjs";
import { logger } from "../utils/logger";
import { handleIncomingMessage } from "../pipeline/handler";
import { sendText } from "./messages";
import { ensureUser, isVip } from "../vip/vip";
import { saveConversation } from "../storage/conversations";

let selfId: string | undefined;
let selfUsername: string | undefined;

export async function registerTelegramEvents(client: any): Promise<void> {
  try {
    const me = await client.getMe();

    selfId = String(me.id ?? "");
    selfUsername = me.username ? String(me.username) : undefined;

    logger.info(
      {
        selfId,
        selfUsername,
        firstName: me.firstName,
        bot: Boolean(me.bot),
      },
      "Telegram identity ready"
    );
  } catch (error) {
    logger.warn({ err: error }, "Could not resolve Telegram self identity");
  }

  client.addEventHandler(
    async (event: any) => {
      try {
        const message = event?.message;

        if (!message) {
          return;
        }

        const isPrivate =
          event?.isPrivate ?? message?.peerId?.className === "PeerUser";

        if (!isPrivate) {
          return;
        }

        const senderId = message?.senderId
          ? String(message.senderId)
          : event?.senderId
            ? String(event.senderId)
            : "";

        if (!senderId) {
          return;
        }

        if (senderId === selfId) {
          return;
        }

        if (event.sender?.bot) {
          return;
        }

        const peer = event.inputChat ?? event.chat ?? senderId;

        const text =
          typeof message.message === "string"
            ? message.message.trim()
            : "";

        const firstToken = text.split(/\s+/)[0]?.toLowerCase() ?? "";

        const isStartCommand =
          firstToken === "/start" ||
          (selfUsername
            ? firstToken === `/start@${selfUsername.toLowerCase()}`
            : false);

        if (isStartCommand) {
          await ensureUser(senderId, event.sender ?? {});

          const vip = await isVip(senderId);

          const reply = vip
            ? "uyyy love 😭 nandito na ako. message lang ako anytime."
            : "Hey! I'm Kevin. Message me normally.";

          await sendText(peer, reply);

          await saveConversation({
            userId: senderId,
            role: "user",
            content: "/start",
          });

          await saveConversation({
            userId: senderId,
            role: "assistant",
            content: reply,
          });

          return;
        }

        logger.info(
          {
            senderId,
            text: text.slice(0, 80),
          },
          "Private message received"
        );

        await handleIncomingMessage(event);
      } catch (error) {
        logger.error({ err: error }, "Failed to process Telegram update");
      }
    },
    new NewMessage({
      incoming: true,
    } as any)
  );

  logger.info("Telegram event handler registered");
}
