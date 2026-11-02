/* src/plugins/appUpdate.ts */
import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export interface AppUpdatePlugin {
    downloadAndInstall(options: { url: string }): Promise<{ started: boolean }>;
    addListener(
        eventName: 'downloadProgress',
        listenerFunc: (data: { percent: number }) => void
    ): Promise<PluginListenerHandle>;
}

const AppUpdate = registerPlugin<AppUpdatePlugin>('AppUpdate');

export default AppUpdate;
