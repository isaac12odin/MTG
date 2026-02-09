"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscribePlanSchema = void 0;
const zod_1 = require("zod");
exports.SubscribePlanSchema = zod_1.z.object({
    planId: zod_1.z.string().uuid(),
});
