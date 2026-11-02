/* src/utils/signalements.ts */
import { SERVER_BASE_URL } from '../config';

export interface Signalement {
    creationId?: number;
    creationTitle: string;
    motif: string;
    commentaire: string;
}

export const envoyerSignalement = async (signalement: Signalement): Promise<void> => {
    const response = await fetch(`${SERVER_BASE_URL}/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signalement),
    });
    if (!response.ok) throw new Error(`Erreur serveur (${response.status})`);
};
