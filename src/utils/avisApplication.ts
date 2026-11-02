/* src/utils/avisApplication.ts */
import { SERVER_BASE_URL } from '../config';
import { getDeviceId } from './deviceId';

export const envoyerAvisApplication = async (note: number): Promise<void> => {
    const response = await fetch(`${SERVER_BASE_URL}/avis-application`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: getDeviceId(), note }),
    });
    if (!response.ok) throw new Error(`Erreur serveur (${response.status})`);
};
