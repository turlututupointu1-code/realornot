package com.philippe.realornot;

import android.graphics.Color;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// Couleur de la barre de navigation Android (les 3 boutons en bas de l'écran).
// La transparence seule (styles.xml) ne suffit pas sur certains appareils
// (MIUI/Xiaomi notamment, qui affiche une barre blanche par défaut malgré
// l'edge-to-edge) : on la force explicitement pour suivre le thème actif.
@CapacitorPlugin(name = "NavigationBar")
public class NavigationBarPlugin extends Plugin {

    @PluginMethod
    public void setColor(PluginCall call) {
        String couleur = call.getString("color");
        if (couleur == null) {
            call.reject("Couleur manquante");
            return;
        }
        getActivity().runOnUiThread(() -> {
            getActivity().getWindow().setNavigationBarColor(Color.parseColor(couleur));
            call.resolve();
        });
    }
}
