import cron from "node-cron";
import {
  activateScheduledAuctions,
  closeEndedAuctions,
  expireTradeOffers,
  cleanupExpiredMessages,
  cleanupExpiredMedia,
  cleanupPendingRegistrations,
  expireMensualidades,
  autoRelistUnpaidAuctions,
  recalcReputation,
} from "./jobs";

function wrapJob(name: string, fn: () => Promise<void>) {
  let running = false;
  return async () => {
    if (running) return;
    running = true;
    try {
      await fn();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[cron:${name}]`, err);
    } finally {
      running = false;
    }
  };
}

export function startCron() {
  if (process.env.RUN_JOBS === "false") {
    return;
  }

  cron.schedule("*/1 * * * *", wrapJob("activate-auctions", activateScheduledAuctions));
  cron.schedule("*/1 * * * *", wrapJob("close-auctions", closeEndedAuctions));
  cron.schedule("*/5 * * * *", wrapJob("relist-unpaid", autoRelistUnpaidAuctions));
  cron.schedule("*/10 * * * *", wrapJob("expire-offers", expireTradeOffers));
  cron.schedule("*/10 * * * *", wrapJob("cleanup-messages", cleanupExpiredMessages));
  cron.schedule("*/30 * * * *", wrapJob("cleanup-media", cleanupExpiredMedia));
  cron.schedule("*/1 * * * *", wrapJob("cleanup-pending", cleanupPendingRegistrations));
  cron.schedule("0 * * * *", wrapJob("mensualidades-expire", expireMensualidades));
  cron.schedule("0 3 * * *", wrapJob("recalc-reputation", recalcReputation));
}
