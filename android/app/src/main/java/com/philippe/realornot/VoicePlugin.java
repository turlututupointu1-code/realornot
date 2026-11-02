package com.philippe.realornot;

import android.speech.tts.TextToSpeech;
import android.speech.tts.Voice;
import android.util.Log;
import java.util.Locale;
import java.util.Set;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// Fait parler le moteur de synthèse vocale natif du téléphone, car l'API web
// speechSynthesis n'est pas disponible dans la WebView Android.
@CapacitorPlugin(name = "Voice")
public class VoicePlugin extends Plugin {

    private TextToSpeech tts;
    private boolean ready = false;

    private void ensureInit() {
        if (tts != null) return;
        tts = new TextToSpeech(getContext(), status -> {
            if (status == TextToSpeech.SUCCESS) {
                ready = true;
            }
        });
    }

    @PluginMethod
    public void speak(PluginCall call) {
        ensureInit();
        String text = call.getString("text");
        Float pitch = call.getFloat("pitch", 1.0f);
        Float rate = call.getFloat("rate", 1.0f);
        String voiceName = call.getString("voiceName");
        String langueTag = call.getString("langueTag", "fr-FR");

        if (text == null) {
            call.reject("Texte manquant");
            return;
        }

        new Thread(() -> {
            int attempts = 0;
            while (!ready && attempts < 40) {
                try {
                    Thread.sleep(50);
                } catch (InterruptedException ignored) {
                }
                attempts++;
            }

            getActivity().runOnUiThread(() -> {
                if (!ready) {
                    call.reject("Synthèse vocale indisponible");
                    return;
                }

                tts.setLanguage(Locale.forLanguageTag(langueTag));

                // Les identifiants de voix distincts homme/femme ne sont
                // définis que pour le français ; pour les autres langues on
                // laisse le moteur choisir sa voix par défaut.
                if (voiceName != null && langueTag.startsWith("fr")) {
                    Set<Voice> voices = tts.getVoices();
                    if (voices != null) {
                        for (Voice v : voices) {
                            if (v.getName().equals(voiceName)) {
                                tts.setVoice(v);
                                break;
                            }
                        }
                    }
                }

                tts.setPitch(pitch);
                tts.setSpeechRate(rate);
                tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "voix-preview");

                JSObject ret = new JSObject();
                ret.put("started", true);
                call.resolve(ret);
            });
        }).start();
    }
}
