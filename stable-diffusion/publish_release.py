"""
Publie une nouvelle version de l'app : copie l'APK compilé, met à jour
version.json, puis notifie tous les téléphones enregistrés par notification
push (même app fermée), via Firebase Cloud Messaging.

Usage : ./venv/bin/python publish_release.py <versionCode> <versionName>
"""
import json
import os
import shutil
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
APK_SOURCE = os.path.expanduser(
    "~/Documents/Realornot/android/app/build/outputs/apk/debug/app-debug.apk"
)
RELEASES_DIR = os.path.join(BASE_DIR, "app_releases")
VERSION_JSON_PATH = os.path.join(RELEASES_DIR, "version.json")
TOKENS_PATH = os.path.join(RELEASES_DIR, "fcm_tokens.json")
SERVICE_ACCOUNT_PATH = os.path.join(RELEASES_DIR, "firebase_service_account.json")


def load_tokens():
    if not os.path.exists(TOKENS_PATH):
        return []
    with open(TOKENS_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def send_notifications(version_name):
    if not os.path.exists(SERVICE_ACCOUNT_PATH):
        print("Pas de clé de service Firebase trouvée, notification non envoyée.")
        return

    tokens = load_tokens()
    if not tokens:
        print("Aucun téléphone enregistré, notification non envoyée.")
        return

    import firebase_admin
    from firebase_admin import credentials, messaging

    if not firebase_admin._apps:
        cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
        firebase_admin.initialize_app(cred)

    for token in tokens:
        message = messaging.Message(
            notification=messaging.Notification(
                title="RealOrNot",
                body=f"Version {version_name} disponible.",
            ),
            token=token,
        )
        try:
            messaging.send(message)
            print(f"Notification envoyée à {token[:16]}...")
        except Exception as e:
            print(f"Échec d'envoi à {token[:16]}...: {e}")


def main():
    if len(sys.argv) != 3:
        print("Usage : publish_release.py <versionCode> <versionName>")
        sys.exit(1)

    version_code = int(sys.argv[1])
    version_name = sys.argv[2]

    os.makedirs(RELEASES_DIR, exist_ok=True)
    shutil.copy(APK_SOURCE, os.path.join(RELEASES_DIR, "app-debug.apk"))

    with open(VERSION_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump({"versionCode": version_code, "versionName": version_name}, f)

    print(f"Version {version_name} (code {version_code}) publiée.")
    send_notifications(version_name)


if __name__ == "__main__":
    main()
