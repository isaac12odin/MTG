"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startCron = startCron;
const node_cron_1 = __importDefault(require("node-cron"));
const jobs_1 = require("./jobs");
function wrapJob(name, fn) {
    let running = false;
    return async () => {
        if (running)
            return;
        running = true;
        try {
            await fn();
        }
        catch (err) {
            // eslint-disable-next-line no-console
            console.error(`[cron:${name}]`, err);
        }
        finally {
            running = false;
        }
    };
}
function startCron() {
    if (process.env.RUN_JOBS === "false") {
        return;
    }
    node_cron_1.default.schedule("*/1 * * * *", wrapJob("activate-auctions", jobs_1.activateScheduledAuctions));
    node_cron_1.default.schedule("*/1 * * * *", wrapJob("close-auctions", jobs_1.closeEndedAuctions));
    node_cron_1.default.schedule("*/5 * * * *", wrapJob("relist-unpaid", jobs_1.autoRelistUnpaidAuctions));
    node_cron_1.default.schedule("*/10 * * * *", wrapJob("expire-offers", jobs_1.expireTradeOffers));
    node_cron_1.default.schedule("*/10 * * * *", wrapJob("cleanup-messages", jobs_1.cleanupExpiredMessages));
    node_cron_1.default.schedule("*/30 * * * *", wrapJob("cleanup-media", jobs_1.cleanupExpiredMedia));
    node_cron_1.default.schedule("0 * * * *", wrapJob("mensualidades-expire", jobs_1.expireMensualidades));
    node_cron_1.default.schedule("0 3 * * *", wrapJob("recalc-reputation", jobs_1.recalcReputation));
}
