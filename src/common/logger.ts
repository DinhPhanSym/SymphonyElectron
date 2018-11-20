import { app } from 'electron';
import electronLog, { LogLevel, transports } from 'electron-log';
import * as path from 'path';

import { isElectronQA } from './env';
import { getCommandLineArgs } from './utils';

interface ILogMsg {
    level: LogLevel;
    details: any;
    showInConsole: boolean;
    startTime: number;
}

interface IClientLogMsg {
    msgs?: ILogMsg[];
    logLevel?: LogLevel;
    showInConsole?: boolean;
}

const MAX_LOG_QUEUE_LENGTH = 100;

export class Logger {
    private readonly showInConsole: boolean = false;
    private readonly desiredLogLevel?: LogLevel;
    private readonly logQueue: ILogMsg[];
    private loggerWindow: Electron.WebContents | null;

    constructor() {

        this.loggerWindow = null;
        this.logQueue = [];

        if (!isElectronQA) {
            transports.file.file = path.join(app.getPath('logs'), 'app.log');
            transports.file.level = 'debug';
            transports.file.format = '{h}:{i}:{s}:{ms} {text}';
            transports.file.maxSize = 10 * 1024 * 1024;
            transports.file.appName = 'Symphony';
        }

        const logLevel = getCommandLineArgs(process.argv, '--logLevel=', false);
        if (logLevel) {
            const level = logLevel.split('=')[1];
            if (level) {
                this.desiredLogLevel = level as LogLevel;
            }
        }

        if (getCommandLineArgs(process.argv, '--enableConsoleLogging', false)) {
            this.showInConsole = true;
        }
    }

    /**
     * Log error
     *
     * @param message {string} - message to be logged
     * @param data {any} - extra data that needs to be logged
     */
    public error(message: string, ...data: any[]): void {
        this.log('error', message, data);
    }

    /**
     * Log warn
     *
     * @param message {string} - message to be logged
     * @param data {any} - extra data that needs to be logged
     */
    public warn(message: string, ...data: any[]): void {
        this.log('warn', message, data);
    }

    /**
     * Log info
     *
     * @param message {string} - message to be logged
     * @param data {any} - extra data that needs to be logged
     */
    public info(message: string, ...data: any[]): void {
        this.log('info', message, data);
    }

    /**
     * Log verbose
     *
     * @param message {string} - message to be logged
     * @param data {array} - extra data that needs to be logged
     */
    public verbose(message: string, ...data: any[]): void {
        this.log('verbose', message, data);
    }

    /**
     * Log debug
     *
     * @param message {string} - message to be logged
     * @param data {any} - extra data that needs to be logged
     */
    public debug(message: string, ...data: any[]): void {
        this.log('debug', message, data);
    }

    /**
     * Log silly
     *
     * @param message {string} - message to be logged
     * @param data {any} - extra data that needs to be logged
     */
    public silly(message: string, ...data: any[]): void {
        this.log('silly', message, data);
    }

    /**
     * Sets the renderer window for sending logs to the client
     *
     * @param window {WebContents} - renderer window
     */
    public setLoggerWindow(window: Electron.WebContents): void {
        this.loggerWindow = window;

        if (this.loggerWindow) {
            const logMsgs: IClientLogMsg = {};
            if (this.logQueue.length) logMsgs.msgs = this.logQueue;
            if (this.desiredLogLevel) logMsgs.logLevel = this.desiredLogLevel;
            if (Object.keys(logMsgs).length) this.loggerWindow.send('log', logMsgs);
        }
    }

    /**
     * Main instance of the logger method
     *
     * @param logLevel {LogLevel} - Different type of log levels
     * @param message {string} - Log message
     * @param data {array} - extra data to be logged
     */
    private log(logLevel: LogLevel, message: string, data: any[] = []): void {
        if (data && data.length > 0) {
            data.forEach((param) => {
                message += `, '${param && typeof param}': ${JSON.stringify(param)}`;
            });
        }
        if (!isElectronQA) {
            switch (logLevel) {
                case 'error': electronLog.error(message); break;
                case 'warn': electronLog.warn(message); break;
                case 'info': electronLog.info(message); break;
                case 'verbose': electronLog.verbose(message); break;
                case 'debug': electronLog.debug(message); break;
                case 'silly': electronLog.silly(message); break;
                default: electronLog.info(message);
            }
        }
        this.sendToCloud(this.formatLogMsg(logLevel, message));
    }

    /**
     * Formats the logs in the format that required
     * to send to the client
     *
     * @param level {LogLevel} - Different type of log levels
     * @param details {any} - log format that required to send to client
     */
    private formatLogMsg(level: LogLevel, details: any): ILogMsg {
        return {
            details,
            level,
            showInConsole: this.showInConsole,
            startTime: Date.now(),
        };
    }

    /**
     * This will send the logs to the client if loggerWindow
     * else adds the logs to a Queue
     *
     * @param logMsg {ILogMsg}
     */
    private sendToCloud(logMsg: ILogMsg) {
        // don't send logs if it is not desired by the user
        if (this.desiredLogLevel && this.desiredLogLevel !== logMsg.level) {
            return;
        }

        if (this.loggerWindow) {
            this.loggerWindow.send('log', { msgs: [ logMsg ] });
        } else {
            this.logQueue.push(logMsg);
            // don't store more than 100 msgs. keep most recent log msgs.
            if (this.logQueue.length > MAX_LOG_QUEUE_LENGTH) {
                this.logQueue.shift();
            }
        }
    }
}

const logger = new Logger();

export { logger };