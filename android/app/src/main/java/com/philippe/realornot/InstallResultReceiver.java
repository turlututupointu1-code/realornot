package com.philippe.realornot;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInstaller;

import java.util.Collections;
import java.util.HashSet;
import java.util.Set;

// Reçoit le résultat de la session PackageInstaller. Quand Android demande une
// confirmation à l'utilisateur (STATUS_PENDING_USER_ACTION), il faut relancer
// l'intent fourni pour afficher l'écran système "Installer cette appli ?" —
// sans passer par un chooser d'appli tierce (ex: APK Pure).
public class InstallResultReceiver extends BroadcastReceiver {
    // Android redélivre parfois STATUS_PENDING_USER_ACTION plusieurs fois pour
    // la même session, ce qui relançait l'écran de confirmation en double
    // (deuxième fenêtre s'ouvrant toute seule). On ne le lance qu'une fois par
    // session d'installation.
    private static final Set<Integer> sessionsDejaConfirmees =
            Collections.synchronizedSet(new HashSet<>());

    @Override
    public void onReceive(Context context, Intent intent) {
        int status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
        int sessionId = intent.getIntExtra(PackageInstaller.EXTRA_SESSION_ID, -1);

        if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            if (sessionId != -1 && !sessionsDejaConfirmees.add(sessionId)) {
                return;
            }
            Intent confirmIntent = intent.getParcelableExtra(Intent.EXTRA_INTENT);
            if (confirmIntent != null) {
                confirmIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(confirmIntent);
            }
        } else if (sessionId != -1) {
            sessionsDejaConfirmees.remove(sessionId);
        }
    }
}
