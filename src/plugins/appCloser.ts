/* src/plugins/appCloser.ts */
import { registerPlugin } from '@capacitor/core';

export interface AppCloserPlugin {
    exitApp(): Promise<void>;
}

const AppCloser = registerPlugin<AppCloserPlugin>('AppCloser');

export default AppCloser;
