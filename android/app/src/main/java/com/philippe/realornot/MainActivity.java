package com.philippe.realornot;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import java.util.Locale;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;
import com.google.firebase.messaging.FirebaseMessaging;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "AppFCM";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Le thème de lancement (AppTheme.NoActionBarLaunch, fond = splash.png)
        // ne sert que pour l'écran de démarrage ; sans ce changement il reste actif
        // pendant toute la durée de vie de l'activité, et son fond (l'image de
        // démarrage) transparaît partout où rien d'autre n'a encore peint par-dessus
        // (ex. l'espace entre la caméra et le bandeau de contrôles).
        setTheme(R.style.AppTheme_NoActionBar);
        registerPlugin(AppUpdatePlugin.class);
        registerPlugin(VoicePlugin.class);
        registerPlugin(AppCloserPlugin.class);
        registerPlugin(NavigationBarPlugin.class);
        super.onCreate(savedInstanceState);

        // Edge-to-edge explicite sur toutes les versions d'Android (obligatoire
        // à partir d'Android 15/API 35 de toute façon) : comportement identique
        // sur tous les téléphones, le WebView dessine sa propre couleur de fond
        // (celle du thème actif) derrière les barres système transparentes.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        // Désactive le remplissage automatique (autofill) du système sur la
        // WebView : constaté en pratique, il réinjecte le mot de passe d'un
        // AUTRE compte déjà utilisé (ex. celui de "Philippe 1") dans le champ
        // mot de passe du formulaire de connexion "Philippe", malgré
        // autocomplete="off" côté HTML (ignoré par Chrome/WebView sur les
        // champs de mot de passe).
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_NO);
        }

        // Filet de sécurité pour env(safe-area-inset-top/bottom) et pour la
        // détection du clavier virtuel côté CSS/JS : sur certains WebView
        // anciens/mal à jour (constaté sur une tablette bas de gamme), ni
        // env() ni window.visualViewport ne rapportent la bonne valeur, ce
        // qui cache des éléments (flèche retour, barre de saisie du chat...)
        // sous la barre de statut/nav ou sous le clavier. On lit ici les
        // vraies WindowInsets Android (barres système + clavier IME) et on
        // les pousse dans le WebView comme variables CSS
        // (--native-safe-top/bottom, --native-keyboard-height ; voir
        // base.css) ; le CSS prend le max avec les valeurs déjà en place,
        // donc ça ne change rien là où elles fonctionnent déjà.
        ViewCompat.setOnApplyWindowInsetsListener(getWindow().getDecorView(), (view, windowInsets) -> {
            Insets bars = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars());
            Insets ime = windowInsets.getInsets(WindowInsetsCompat.Type.ime());
            float density = getResources().getDisplayMetrics().density;
            float topPx = bars.top / density;
            float bottomPx = bars.bottom / density;
            float keyboardPx = ime.bottom / density;
            String js = String.format(Locale.US,
                "document.documentElement.style.setProperty('--native-safe-top','%.1fpx');"
                + "document.documentElement.style.setProperty('--native-safe-bottom','%.1fpx');"
                + "document.documentElement.style.setProperty('--native-keyboard-height','%.1fpx');",
                topPx, bottomPx, keyboardPx);
            if (getBridge() != null && getBridge().getWebView() != null) {
                getBridge().getWebView().post(() -> getBridge().getWebView().evaluateJavascript(js, null));
            }
            return windowInsets;
        });

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.POST_NOTIFICATIONS}, 1001);
            }
        }

        FirebaseMessaging.getInstance().getToken().addOnCompleteListener(task -> {
            if (!task.isSuccessful()) {
                Log.w(TAG, "Echec récupération du jeton FCM", task.getException());
                return;
            }
            String token = task.getResult();
            Log.i(TAG, "Jeton FCM : " + token);
            MyFirebaseMessagingService.sendTokenToServer(token);
        });
    }
}
