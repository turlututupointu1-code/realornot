/* src/utils/deviceId.ts */
// Identifiant unique généré une seule fois par appareil (persisté en
// localStorage), utilisé pour savoir quel téléphone a créé un personnage
// donné et ainsi restreindre certaines pages au créateur.
const DEVICE_ID_KEY = 'realornot-device-id';

export const getDeviceId = (): string => {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
        id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
        localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
};
