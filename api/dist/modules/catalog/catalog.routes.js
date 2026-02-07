"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.catalogRoutes = catalogRoutes;
const catalog_controller_1 = require("./catalog.controller");
async function catalogRoutes(app) {
    app.get("/games", catalog_controller_1.listGames);
    app.get("/sets", catalog_controller_1.listSets);
    app.get("/cards", catalog_controller_1.listCards);
}
