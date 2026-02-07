"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paginate = paginate;
exports.buildPagination = buildPagination;
function paginate(page, pageSize) {
    const safePage = Math.max(page, 1);
    const safePageSize = Math.max(pageSize, 1);
    return {
        skip: (safePage - 1) * safePageSize,
        take: safePageSize,
    };
}
function buildPagination(page, pageSize, total) {
    return {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
    };
}
