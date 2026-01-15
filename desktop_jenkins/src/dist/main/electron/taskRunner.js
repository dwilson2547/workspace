"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runTask = void 0;
const promises_1 = __importDefault(require("node:fs/promises"));
const runTask = async (task) => {
    switch (task.type) {
        case 'copy':
            if (!task.config.destinationPath) {
                throw new Error('Copy task missing destination path');
            }
            await promises_1.default.copyFile(task.config.sourcePath, task.config.destinationPath);
            break;
        case 'move':
            if (!task.config.destinationPath) {
                throw new Error('Move task missing destination path');
            }
            await promises_1.default.rename(task.config.sourcePath, task.config.destinationPath);
            break;
        case 'delete':
            await promises_1.default.rm(task.config.sourcePath, { force: true, recursive: true });
            break;
        default:
            throw new Error(`Unsupported task type: ${task.type}`);
    }
};
exports.runTask = runTask;
