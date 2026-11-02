/* src/plugins/voice.ts */
import { registerPlugin } from '@capacitor/core';

export interface VoicePlugin {
    speak(options: { text: string; pitch: number; rate: number; voiceName?: string; langueTag?: string }): Promise<{ started: boolean }>;
}

const Voice = registerPlugin<VoicePlugin>('Voice');

export default Voice;
