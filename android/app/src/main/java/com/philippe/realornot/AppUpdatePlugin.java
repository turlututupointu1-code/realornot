package com.philippe.realornot;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInstaller;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

// Télécharge l'APK et l'installe via la session PackageInstaller du système,
// ce qui affiche directement l'écran de confirmation système "Installer cette
// appli ?" sans passer par un chooser d'appli tierce (ex: APK Pure).
@CapacitorPlugin(name = "AppUpdate")
public class AppUpdatePlugin extends Plugin {

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String urlStr = call.getString("url");
        if (urlStr == null) {
            call.reject("URL manquante");
            return;
        }

        new Thread(() -> {
            PackageInstaller.Session session = null;
            try {
                URL url = new URL(urlStr);
                HttpURLConnection connection = (HttpURLConnection) url.openConnection();
                connection.connect();
                int length = connection.getContentLength();

                Context context = getContext();
                PackageInstaller packageInstaller = context.getPackageManager().getPackageInstaller();
                PackageInstaller.SessionParams params = new PackageInstaller.SessionParams(
                        PackageInstaller.SessionParams.MODE_FULL_INSTALL
                );
                if (length > 0) {
                    params.setSize(length);
                }
                int sessionId = packageInstaller.createSession(params);
                session = packageInstaller.openSession(sessionId);

                try (InputStream input = connection.getInputStream();
                     OutputStream output = session.openWrite("update", 0, -1)) {
                    byte[] buffer = new byte[8192];
                    int bytesRead;
                    long totalRead = 0;
                    int lastPercent = -1;
                    while ((bytesRead = input.read(buffer)) != -1) {
                        output.write(buffer, 0, bytesRead);
                        totalRead += bytesRead;
                        if (length > 0) {
                            int percent = (int) (totalRead * 100 / length);
                            if (percent != lastPercent) {
                                lastPercent = percent;
                                JSObject progress = new JSObject();
                                progress.put("percent", percent);
                                notifyListeners("downloadProgress", progress);
                            }
                        }
                    }
                    session.fsync(output);
                }

                Intent receiverIntent = new Intent(context, InstallResultReceiver.class);
                PendingIntent pendingIntent = PendingIntent.getBroadcast(
                        context,
                        sessionId,
                        receiverIntent,
                        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE
                );

                session.commit(pendingIntent.getIntentSender());
                session.close();

                JSObject ret = new JSObject();
                ret.put("started", true);
                call.resolve(ret);
            } catch (Exception e) {
                if (session != null) {
                    try {
                        session.abandon();
                    } catch (Exception ignored) {
                    }
                }
                call.reject("Mise à jour impossible : " + e.getMessage(), e);
            }
        }).start();
    }
}
