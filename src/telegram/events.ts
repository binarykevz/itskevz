import { events } from "telegram";
import { logger } from "../utils/logger";
import { handleIncomingMessage } from "../pipeline/handler";

export function registerTelegramEvents(client: any): void {
  client.addEventHandler(
    async (event: any) => {
      try {
        if (!event?.message) return;
        if (!event.isPrivate) return;
        if (event.sender?.bot) return;

        await handleIncomingMessage(event);
      } catch (error) {
        logger.error({ err: error }, "Failed to process Telegram update");
      }
    },
    new events.NewMessage({
      incoming: true,
    })
  );
}
