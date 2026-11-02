package com.philippe.realornot;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// Ferme complètement l'application (pas juste le menu), à la demande du
// bouton "Fermer" du menu burger.
@CapacitorPlugin(name = "AppCloser")
public class AppCloserPlugin extends Plugin {

    @PluginMethod
    public void exitApp(PluginCall call) {
        call.resolve();
        getActivity().finishAndRemoveTask();
        System.exit(0);
    }
}
