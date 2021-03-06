import { BrowserWindow, ipcMain } from 'electron';

import { apiCmds, apiName, IApiArgs } from '../common/api-interface';
import { LocaleType } from '../common/i18n';
import { logger } from '../common/logger';
import { activityDetection } from './activity-detection';
import { analytics } from './analytics-handler';
import { config } from './config-handler';
import { memoryMonitor } from './memory-monitor';
import { protocolHandler } from './protocol-handler';
import { finalizeLogExports, registerLogRetriever } from './reports-handler';
import { screenSnippet } from './screen-snippet-handler';
import { activate, handleKeyPress } from './window-actions';
import { ICustomBrowserWindow, windowHandler } from './window-handler';
import {
    downloadManagerAction,
    isValidWindow,
    sanitize,
    setDataUrl,
    showBadgeCount,
    showPopupMenu,
    updateLocale,
    windowExists,
} from './window-utils';

/**
 * Handle API related ipc messages from renderers. Only messages from windows
 * we have created are allowed.
 */
ipcMain.on(apiName.symphonyApi, (event: Electron.IpcMainEvent, arg: IApiArgs) => {
    if (!isValidWindow(BrowserWindow.fromWebContents(event.sender))) {
        logger.error(`main-api-handler: invalid window try to perform action, ignoring action`, arg.cmd);
        return;
    }

    if (!arg) {
        return;
    }

    switch (arg.cmd) {
        case apiCmds.isOnline:
            if (typeof arg.isOnline === 'boolean') {
                windowHandler.isOnline = arg.isOnline;
            }
            break;
        case apiCmds.setBadgeCount:
            if (typeof arg.count === 'number') {
                showBadgeCount(arg.count);
            }
            break;
        case apiCmds.registerProtocolHandler:
            protocolHandler.setPreloadWebContents(event.sender);
            // Since we register the prococol handler window upon login,
            // we make use of it and update the pod version info on SDA
            windowHandler.updateVersionInfo();
            break;
        case apiCmds.registerLogRetriever:
            registerLogRetriever(event.sender, arg.logName);
            break;
        case apiCmds.sendLogs:
            finalizeLogExports(arg.logs);
            break;
        case apiCmds.badgeDataUrl:
            if (typeof arg.dataUrl === 'string' && typeof arg.count === 'number') {
                setDataUrl(arg.dataUrl, arg.count);
            }
            break;
        case apiCmds.activate:
            if (typeof arg.windowName === 'string') {
                activate(arg.windowName);
            }
            break;
        case apiCmds.registerLogger:
            // renderer window that has a registered logger from JS.
            logger.setLoggerWindow(event.sender);
            break;
        case apiCmds.registerActivityDetection:
            if (typeof arg.period === 'number') {
                // renderer window that has a registered activity detection from JS.
                activityDetection.setWindowAndThreshold(event.sender, arg.period);
            }
            break;
        case apiCmds.showNotificationSettings:
            if (typeof arg.windowName === 'string') {
                windowHandler.createNotificationSettingsWindow(arg.windowName);
            }
            break;
        case apiCmds.sanitize:
            if (typeof arg.windowName === 'string') {
                sanitize(arg.windowName);
            }
            break;
        case apiCmds.bringToFront:
            // validates the user bring to front config and activates the wrapper
            if (typeof arg.reason === 'string' && arg.reason === 'notification') {
                const { bringToFront } = config.getConfigFields([ 'bringToFront' ]);
                if (bringToFront) {
                    activate(arg.windowName, false);
                }
            }
            break;
        case apiCmds.openScreenPickerWindow:
            if (Array.isArray(arg.sources) && typeof arg.id === 'number') {
                windowHandler.createScreenPickerWindow(event.sender, arg.sources, arg.id);
            }
            break;
        case apiCmds.popupMenu: {
            const browserWin = BrowserWindow.fromWebContents(event.sender) as ICustomBrowserWindow;
            if (browserWin && windowExists(browserWin) && browserWin.winName === apiName.mainWindowName) {
                showPopupMenu({ window: browserWin });
            }
            break;
        }
        case apiCmds.setLocale:
            if (typeof arg.locale === 'string') {
                updateLocale(arg.locale as LocaleType);
            }
            break;
        case apiCmds.keyPress:
            if (typeof arg.keyCode === 'number') {
                handleKeyPress(arg.keyCode);
            }
            break;
        case apiCmds.openScreenSnippet:
            screenSnippet.capture(event.sender);
            break;
        case apiCmds.closeScreenSnippet:
            screenSnippet.cancelCapture();
            break;
        case apiCmds.closeWindow:
            windowHandler.closeWindow(arg.windowType, arg.winKey);
            break;
        case apiCmds.openScreenSharingIndicator:
            const { displayId, id, streamId } = arg;
            if (typeof displayId === 'string' && typeof id === 'number') {
                windowHandler.createScreenSharingIndicatorWindow(event.sender, displayId, id, streamId);
            }
            break;
        case apiCmds.downloadManagerAction:
            if (typeof arg.path === 'string') {
                downloadManagerAction(arg.type, arg.path);
            }
            break;
        case apiCmds.isMisspelled:
            if (typeof arg.word === 'string') {
                event.returnValue = windowHandler.spellchecker ? windowHandler.spellchecker.isMisspelled(arg.word) : false;
            }
            break;
        case apiCmds.setIsInMeeting:
            if (typeof arg.isInMeeting === 'boolean') {
                memoryMonitor.setMeetingStatus(arg.isInMeeting);
            }
            break;
        case apiCmds.memoryInfo:
            if (typeof arg.memoryInfo === 'object') {
                memoryMonitor.setMemoryInfo(arg.memoryInfo);
            }
            break;
        case apiCmds.getConfigUrl:
            const { url } = config.getGlobalConfigFields([ 'url' ]);
            event.returnValue = url;
            break;
        case apiCmds.registerAnalyticsHandler:
            analytics.registerPreloadWindow(event.sender);
            break;
        default:
    }

});
