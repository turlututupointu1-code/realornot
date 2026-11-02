/* src/plugins/navigationBar.ts */
import { registerPlugin } from '@capacitor/core';

export interface NavigationBarPlugin {
    setColor(options: { color: string }): Promise<void>;
}

const NavigationBar = registerPlugin<NavigationBarPlugin>('NavigationBar');

export default NavigationBar;
