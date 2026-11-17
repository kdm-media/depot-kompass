package app.depotkompass;

import android.app.Activity;
import android.app.KeyguardManager;
import android.os.Build;
import android.view.View;
import android.view.WindowManager;
import android.content.Intent;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * Huelle der Depot-App: ein WebView mit der Oberflaeche aus assets/.
 * Die Daten liegen als depot.json im privaten App-Speicher, nicht im Netz.
 * Java liefert nur, was der WebView selbst nicht kann: Datei speichern,
 * Datei waehlen, Kurse abrufen, API-Schluessel verschluesselt halten und
 * die KI anfragen. Schluessel verlassen Java nie Richtung Oberflaeche.
 */
public class MainActivity extends Activity {
    static final String KONTAKT = "depot-kompass.breach557@passmail.net";
    private static final int WAHL = 1, SPEICHERN = 2, ORDNER = 3;
    private WebView web;
    private boolean gesperrt;
    private long imHintergrundSeit;
    private boolean eigenerDialog;          // Dateiauswahl/Ordner/Fingerabdruck: kein "Verlassen" der App
    private ValueCallback<Uri[]> dateiRueckruf;
    private String speicherText;
    private byte[] speicherBytes;           // ZIP-Export (Binaerdaten)

    @Override
    protected void onCreate(Bundle zustand) {
        super.onCreate(zustand);
        getWindow().setStatusBarColor(Color.rgb(20, 18, 28));
        getWindow().setNavigationBarColor(Color.rgb(29, 26, 40));
        // Haertung (0.16): die Oberflaeche darf nur ihre eigenen Dateien aus
        // assets/ laden. Kein Datei-/Inhaltszugriff, keine Fern-Inhalte, kein
        // Debugging - alles Netz laeuft ueber Java (Knopfdruck).
        WebView.setWebContentsDebuggingEnabled(false);
        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);                 // file:///android_asset geht trotzdem
        s.setAllowFileAccessFromFileURLs(false);
        s.setAllowUniversalAccessFromFileURLs(false);
        s.setGeolocationEnabled(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setSupportMultipleWindows(false);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        if (Build.VERSION.SDK_INT >= 26) s.setSafeBrowsingEnabled(false);   // sonst fragt Google nach jeder Adresse
        web.setWebViewClient(new WebViewClient() {
            // Links ins Internet (z. B. "Gratis-Schluessel holen") im Browser oeffnen,
            // nicht in der App - die App selbst laedt nur ihre eigenen Seiten.
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, String url) {
                if (url.startsWith("https://") || url.startsWith("http://")) {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)).addCategory(Intent.CATEGORY_BROWSABLE));
                    } catch (Exception keinBrowser) { }
                    return true;
                }
                // Nur die Kontakt-Adresse der App darf eine E-Mail oeffnen (Fehler melden) - nichts anderes
                if (url.startsWith("mailto:" + KONTAKT)) {
                    try { startActivity(new Intent(Intent.ACTION_SENDTO, Uri.parse(url))); } catch (Exception keinMail) { }
                    return true;
                }
                return !eigeneSeite(url);                     // intent:, content:, file:/sdcard ... blocken
            }

            /** Jede Anfrage der Oberflaeche: nur eigene assets/, data: und blob:. */
            @Override
            public android.webkit.WebResourceResponse shouldInterceptRequest(WebView v, android.webkit.WebResourceRequest r) {
                String url = r.getUrl().toString();
                if (eigeneSeite(url)) return null;
                return new android.webkit.WebResourceResponse("text/plain", "utf-8", 403, "gesperrt",
                        new java.util.HashMap<String, String>(), new java.io.ByteArrayInputStream(new byte[0]));
            }

            @Override
            public void onPageFinished(WebView v, String url) { seiteGeladen = true; }
        });
        final Thread.UncaughtExceptionHandler vorher = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler(new Thread.UncaughtExceptionHandler() {
            @Override
            public void uncaughtException(Thread th, Throwable ex) {
                Protokoll.fehler(getApplicationContext(), "Absturz", ex);      // 0.59: Abstuerze ins Fehlerprotokoll
                if (vorher != null) vorher.uncaughtException(th, ex);
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(android.webkit.ConsoleMessage cm) {
                // 0.59: JavaScript-Fehler ins Fehlerprotokoll (nur Fehler-Stufe, Text + Datei:Zeile)
                if (cm.messageLevel() == android.webkit.ConsoleMessage.MessageLevel.ERROR) {
                    String q = cm.sourceId() == null ? "" : cm.sourceId().replaceAll("^.*/", "");
                    Protokoll.schreiben(MainActivity.this, "JavaScript", cm.message() + " · " + q + ":" + cm.lineNumber());
                }
                return super.onConsoleMessage(cm);
            }

            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> rueckruf, FileChooserParams p) {
                if (dateiRueckruf != null) dateiRueckruf.onReceiveValue(null);
                dateiRueckruf = rueckruf;
                Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType("*/*");
                // mehrere CSV-Dateien auf einmal (z. B. alle Broker-Exporte)
                if (p.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                eigenerDialog = true; startActivityForResult(i, WAHL);
                return true;
            }
        });
        web.addJavascriptInterface(new Bruecke(), "Android");
        setContentView(web);
        fingerabdruckAufraeumen();
        schutzAnwenden();
        if (Tresor.aktiv(einst()) && !Tresor.offen()) { gesperrt = true; web.setVisibility(View.INVISIBLE); }
        web.loadUrl("file:///android_asset/index.html");
        geteiltAufnehmen(getIntent());
    }

    // ------------------------------------------------------------ Teilen an die App (ab 0.47)
    /** Mit "Teilen -> Depot-Kompass" empfangene Dateien (.dksafe, Screenshot, PDF, CSV). Die Oberflaeche holt sie
     *  einzeln ab (geteiltHolen) und liest sie wie eine gewaehlte Datei ein - auch erst nach dem Entsperren. */
    private final java.util.List<Uri> geteilt = new java.util.ArrayList<Uri>();

    @Override
    protected void onNewIntent(Intent i) {
        super.onNewIntent(i);
        setIntent(i);
        geteiltAufnehmen(i);
    }

    @SuppressWarnings("deprecation")
    private void geteiltAufnehmen(Intent i) {
        if (i == null) return;
        int vorher = geteilt.size();
        if (Intent.ACTION_SEND.equals(i.getAction())) {
            Uri u = i.getParcelableExtra(Intent.EXTRA_STREAM);
            if (u != null) geteilt.add(u);
        } else if (Intent.ACTION_SEND_MULTIPLE.equals(i.getAction())) {
            java.util.ArrayList<Uri> l = i.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
            if (l != null) for (Uri u : l) if (u != null && geteilt.size() < 30) geteilt.add(u);
        }
        if (geteilt.size() > vorher && web != null) web.evaluateJavascript("window.geteiltBereit && window.geteiltBereit()", null);
    }

    private boolean netzAus() { return einst().getBoolean("netzAus", false); }

    static boolean eigeneSeite(String url) {
        return url.startsWith("file:///android_asset/") && !url.contains("..")
                || url.startsWith("data:") || url.startsWith("blob:");
    }

    // ------------------------------------------------------------ App-Sperre
    private SharedPreferences einst() { return getSharedPreferences("einstellungen", MODE_PRIVATE); }

    /** Bildschirmschutz: Inhalt in der App-Uebersicht und auf Screenshots schwarz. */
    private void schutzAnwenden() {
        if (einst().getBoolean("schutz", true)) getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
    }

    private boolean geraetGesichert() {
        KeyguardManager k = (KeyguardManager) getSystemService(KEYGUARD_SERVICE);
        return k != null && k.isDeviceSecure();
    }

    /** Sperren: Hauptschluessel aus dem Speicher werfen und die Oberflaeche
     *  neu laden - dann liegen auch im WebView keine Daten mehr. Die Seite
     *  bekommt beim Laden "gesperrt" und zeigt das PIN-Feld. */
    private boolean seiteGeladen;
    private String zuletzt;                 // letzter gespeicherter Stand (fuer die Sicherung beim Verlassen)
    private boolean ungesichert;

    private void sperren() {
        if (!Tresor.aktiv(einst())) return;
        Tresor.schliessen();
        gesperrt = true;
        zuletzt = null;
        web.setVisibility(View.INVISIBLE);
        if (seiteGeladen) web.reload();
    }

    private void entsperrtMelden() {
        gesperrt = false;
        einst().edit().putInt("fehlversuche", 0).putLong("sperreBis", 0).apply();
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                web.setVisibility(View.VISIBLE);
                web.evaluateJavascript("window.entsperrt && window.entsperrt()", null);
            }
        });
    }

    /** Fingerabdruck gibt es seit 0.38 nicht mehr (Vorgabe 11.11.2026: Absturz beim Einrichten, und private
     *  Finanzdaten nur mit PIN). Wer ihn frueher eingerichtet hatte: Huelle und Keystore-Schluessel wegraeumen. */
    private void fingerabdruckAufraeumen() {
        SharedPreferences e = einst();
        if (e.contains("bio") || e.contains("bioHuelle")) e.edit().remove("bioHuelle").remove("bio").apply();
        Tresor.bioSchluesselLoeschen();
    }

    @Override
    protected void onPause() {
        super.onPause();
        imHintergrundSeit = System.currentTimeMillis();
        automatischSichern();
    }

    @Override
    protected void onResume() {
        super.onResume();
        // Eigene Dialoge (Datei waehlen, Ordner, Speichern) bis 10 Min. nicht als Verlassen zaehlen
        boolean dialog = eigenerDialog && System.currentTimeMillis() - imHintergrundSeit < 600000;
        eigenerDialog = false;
        if (!dialog && !gesperrt && Tresor.aktiv(einst()) && imHintergrundSeit > 0
                && System.currentTimeMillis() - imHintergrundSeit >= einst().getLong("sperreNach", 60) * 1000) sperren();
    }

    // ------------------------------------------------------------ Sicherung
    /** Beim Verlassen: neue Sicherung, wenn sich depot.json seit der letzten
     *  geaendert hat und Ordner + Passwort eingerichtet sind. */
    private void automatischSichern() {
        final String ordner = einst().getString("ordner", null);
        final String inhalt = zuletzt;
        if (ordner == null || inhalt == null || !ungesichert) return;
        new Thread(new Runnable() {
            @Override
            public void run() { sichernJetzt(ordner, inhalt); }
        }).start();
    }

    private synchronized String sichernJetzt(String ordner, String inhalt) {
        try {
            String pw = schluessel("sicherung");
            if (pw == null) return "kein Passwort";
            if (inhalt == null) return "nichts zu sichern";
            String name = Sicherung.inOrdner(getContentResolver(), Uri.parse(ordner), Sicherung.verschluesseln(inhalt, pw));
            einst().edit().putLong("letzteSicherung", System.currentTimeMillis()).putString("letzteDatei", name).apply();
            ungesichert = false;
            return "ok:" + name;
        } catch (Exception e) {
            return "Fehler: " + e.getMessage();
        }
    }

    private File geheim() { return new File(getFilesDir(), "depot.enc"); }

    @Override
    public void onBackPressed() {
        // Keine Lambdas: das android.jar von Termux kennt LambdaMetafactory nicht.
        web.evaluateJavascript("window.zurueck && window.zurueck()", new ValueCallback<String>() {
            @Override
            public void onReceiveValue(String wert) {
                if (!"true".equals(wert)) MainActivity.super.onBackPressed();
            }
        });
    }

    @Override
    protected void onActivityResult(int code, int ergebnis, Intent daten) {
        Uri uri = (ergebnis == RESULT_OK && daten != null) ? daten.getData() : null;
        if (code == ORDNER) {
            boolean ok = false;
            if (uri != null) {
                try {
                    getContentResolver().takePersistableUriPermission(uri,
                            Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
                    einst().edit().putString("ordner", uri.toString()).apply();
                    ok = true;
                } catch (Exception ignored) { }
            }
            web.evaluateJavascript("window.ordnerGewaehlt && window.ordnerGewaehlt(" + ok + ")", null);
            return;
        }
        if (code == WAHL && dateiRueckruf != null) {
            Uri[] liste = uri == null ? null : new Uri[]{uri};
            if (ergebnis == RESULT_OK && daten != null && daten.getClipData() != null) {
                liste = new Uri[daten.getClipData().getItemCount()];
                for (int k = 0; k < liste.length; k++) liste[k] = daten.getClipData().getItemAt(k).getUri();
            }
            dateiRueckruf.onReceiveValue(liste);
            dateiRueckruf = null;
        } else if (code == SPEICHERN) {
            boolean ok = false;
            if (uri != null && (speicherText != null || speicherBytes != null)) {
                try (OutputStream o = getContentResolver().openOutputStream(uri)) {
                    o.write(speicherBytes != null ? speicherBytes : speicherText.getBytes(StandardCharsets.UTF_8));
                    ok = true;
                } catch (Exception ignored) { }
            }
            speicherText = null; speicherBytes = null;
            web.evaluateJavascript("window.gespeichert && window.gespeichert(" + ok + ")", null);
        }
    }

    private File datei() { return new File(getFilesDir(), "depot.json"); }

    private class Bruecke {
        /** Anzahl empfangener, noch nicht eingelesener Dateien. */
        @JavascriptInterface
        public int geteiltAnzahl() { return geteilt.size(); }

        /** Eine empfangene Datei: {"name","typ","b64"} - hoechstens 40 MB. */
        @JavascriptInterface
        public String geteiltHolen(int k) {
            try {
                Uri u = geteilt.get(k);
                String name = "geteilt";
                try (android.database.Cursor c = getContentResolver().query(u, new String[]{android.provider.OpenableColumns.DISPLAY_NAME}, null, null, null)) {
                    if (c != null && c.moveToFirst() && c.getString(0) != null) name = c.getString(0);
                } catch (Exception ignored) { }
                String typ = getContentResolver().getType(u);
                InputStream in = getContentResolver().openInputStream(u);
                ByteArrayOutputStream p = new ByteArrayOutputStream();
                byte[] b = new byte[65536];
                int n;
                while ((n = in.read(b)) > 0) { p.write(b, 0, n); if (p.size() > 40000000) throw new Exception("zu gross"); }
                in.close();
                org.json.JSONObject o = new org.json.JSONObject();
                o.put("name", name);
                o.put("typ", typ == null ? "" : typ);
                o.put("b64", Base64.encodeToString(p.toByteArray(), Base64.NO_WRAP));
                return o.toString();
            } catch (Exception e) {
                return "";
            }
        }

        /** Empfangene Dateien sind eingelesen - Liste leeren. */
        @JavascriptInterface
        public void geteiltFertig() { geteilt.clear(); }

        /** Aus der App teilen (ab 0.47): Datei im Cache ablegen und das Android-Teilen-Menue oeffnen. */
        @JavascriptInterface
        public boolean teilen(String name, String mime, String inhalt, boolean istB64) {
            try {
                if (name == null || !name.matches("[A-Za-z0-9._ -]{1,120}") || name.contains("..")) return false;
                java.io.File ordner = Teilen.ordner(MainActivity.this);
                java.io.File[] alt = ordner.listFiles();
                if (alt != null) for (java.io.File f : alt) f.delete();          // nur die gerade geteilte Datei liegt bereit
                byte[] daten = istB64 ? Base64.decode(inhalt, Base64.NO_WRAP) : inhalt.getBytes(StandardCharsets.UTF_8);
                try (OutputStream o = new FileOutputStream(new java.io.File(ordner, name))) { o.write(daten); }
                Uri u = Uri.parse("content://" + Teilen.AUTORITAET + "/" + Uri.encode(name));
                final Intent i = new Intent(Intent.ACTION_SEND);
                i.setType(mime == null || mime.isEmpty() ? "application/octet-stream" : mime);
                i.putExtra(Intent.EXTRA_STREAM, u);
                i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() { eigenerDialog = true; startActivity(Intent.createChooser(i, null)); }
                });
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        /** Benachrichtigungen (ab 0.46): Liste setzen (leer = aus). Fragt beim ersten Einschalten nach der Erlaubnis (Android 13+). */
        @JavascriptInterface
        public boolean wachterSetzen(final String json) {
            boolean an = json != null && !json.trim().isEmpty();
            if (an && netzAus()) { Wachter.letzterFehler = "netzAus"; Protokoll.schreiben(MainActivity.this, "Wächter", "abgelehnt: Internet in der App aus"); return false; }
            if (an && Build.VERSION.SDK_INT >= 33 && checkSelfPermission("android.permission.POST_NOTIFICATIONS") != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() { eigenerDialog = true; requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, 77); }
                });
            }
            boolean ok = Wachter.setzen(MainActivity.this, json);
            if (!ok || an && !Wachter.erlaubt(MainActivity.this))
                Protokoll.schreiben(MainActivity.this, "Wächter", "setzen=" + ok + " · Länge " + (json == null ? 0 : json.length()) + " · vom Handy erlaubt=" + Wachter.erlaubt(MainActivity.this)
                        + " · geplant=" + Wachter.geplant(MainActivity.this) + " · Grund=" + Wachter.letzterFehler + " · " + Protokoll.geraet());
            return ok;
        }

        /** 0.59: Fehlerprotokoll - Eintrag aus der Oberflaeche (nur technische Texte). */
        @JavascriptInterface
        public void protokoll(String bereich, String text) {
            Protokoll.schreiben(MainActivity.this, bereich == null ? "App" : bereich.length() > 60 ? bereich.substring(0, 60) : bereich,
                    text == null ? "" : text.length() > 1500 ? text.substring(0, 1500) : text);
        }

        @JavascriptInterface
        public String protokollLesen() { return Protokoll.lesen(MainActivity.this); }

        @JavascriptInterface
        public void protokollLeeren() { Protokoll.leeren(MainActivity.this); }

        @JavascriptInterface
        public String protokollGeraet() { return Protokoll.geraet(); }

        /** {"erlaubt": Benachrichtigungen vom System erlaubt, "geplant": Pruefung ist eingeplant} */
        @JavascriptInterface
        public String wachterStatus() {
            return "{\"erlaubt\":" + Wachter.erlaubt(MainActivity.this) + ",\"geplant\":" + Wachter.geplant(MainActivity.this) + "}";
        }

        /** 0.58: Grund, warum das Einrichten zuletzt fehlschlug ("" = kein Fehler, "netzAus" = Internet in der App aus). */
        @JavascriptInterface
        public String wachterFehler() { return Wachter.letzterFehler == null ? "" : Wachter.letzterFehler; }

        /** 0.58: Android-Einstellungen der App fuer Benachrichtigungen oeffnen (wenn das Handy sie verbietet). */
        @JavascriptInterface
        public void benachrichtigungEinstellungen() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        Intent i = Build.VERSION.SDK_INT >= 26
                                ? new Intent("android.settings.APP_NOTIFICATION_SETTINGS").putExtra("android.provider.extra.APP_PACKAGE", getPackageName())
                                : new Intent("android.settings.APPLICATION_DETAILS_SETTINGS", android.net.Uri.parse("package:" + getPackageName()));
                        startActivity(i);
                    } catch (Exception e) { /* kein Einstellungs-Bildschirm vorhanden */ }
                }
            });
        }

        /** Beispiel-Benachrichtigung sofort zeigen. */
        @JavascriptInterface
        public void wachterTest(String kanal, String titel, String text) {
            Wachter.zeigen(MainActivity.this, kanal, titel, text, 99);
        }

        /** Text in die Zwischenablage (Spenden-Adressen, ab 0.45). Nur Text, nichts geht ins Netz. */
        @JavascriptInterface
        public void kopieren(final String text) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    android.content.ClipboardManager cm = (android.content.ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
                    if (cm != null) cm.setPrimaryClip(android.content.ClipData.newPlainText("Depot-Kompass", text));
                }
            });
        }

        /** Gesamter App-Zustand als JSON, leer beim ersten Start. */
        @JavascriptInterface
        public String laden() {
            try {
                if (Tresor.aktiv(einst())) {
                    if (!Tresor.offen()) return "\u0000GESPERRT";
                    zuletzt = geheim().isFile() ? Tresor.lesen(geheim()) : "";
                    return zuletzt;
                }
                File f = datei();
                if (!f.isFile()) return "";
                try (InputStream in = new FileInputStream(f)) { zuletzt = lesen(in); }
                return zuletzt;
            } catch (Exception e) {
                return "";
            }
        }

        /** Speichern - mit PIN verschluesselt, sonst als Zwischendatei + Umbenennen,
         *  damit ein Absturz mitten im Schreiben den alten Stand nicht zerstoert. */
        @JavascriptInterface
        public boolean sichern(String json) {
            try {
                if (Tresor.aktiv(einst())) {
                    if (!Tresor.offen()) return false;
                    Tresor.schreiben(geheim(), json);
                } else {
                    File neu = new File(getFilesDir(), "depot.json.neu");
                    try (OutputStream o = new FileOutputStream(neu)) { o.write(json.getBytes(StandardCharsets.UTF_8)); }
                    if (!neu.renameTo(datei())) return false;
                }
                zuletzt = json;
                ungesichert = true;
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        /** Datei ueber den Android-Dialog irgendwo ablegen (Sicherung, CSV). */
        @JavascriptInterface
        public void exportieren(String name, String mime, String text) {
            speicherText = text;
            final Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            i.addCategory(Intent.CATEGORY_OPENABLE);
            i.setType(mime);
            i.putExtra(Intent.EXTRA_TITLE, name);
            runOnUiThread(new Runnable() {
                @Override
                public void run() { eigenerDialog = true; startActivityForResult(i, SPEICHERN); }
            });
        }

        /** Letzter Kurs von Yahoo, Antwort roh an die Oberflaeche. */
        @JavascriptInterface
        public void kurs(final String ticker, final String id) {
            abrufen("https://query1.finance.yahoo.com/v8/finance/chart/" + Uri.encode(ticker)
                    + "?range=5d&interval=1d", id);
        }

        /** Ticker zu einer ISIN oder einem Namen suchen (Yahoo-Suche). */
        @JavascriptInterface
        public void suche(final String begriff, final String id) {
            abrufen("https://query1.finance.yahoo.com/v1/finance/search?quotesCount=10&newsCount=0&q="
                    + Uri.encode(begriff), id);
        }

        /** Kursverlauf 1 Jahr (Wochen) mit Dividenden-Ereignissen - fuer den Mini-Chart. */
        @JavascriptInterface
        public void verlauf(final String ticker, final String id) {
            abrufen("https://query1.finance.yahoo.com/v8/finance/chart/" + Uri.encode(ticker)
                    + "?range=1y&interval=1wk&events=div", id);
        }

        /** Zertifikate, Optionsscheine, Anleihen (ab 0.42): Onvista kennt sie, Yahoo meist nicht.
         *  Suche per ISIN, WKN oder Name - liefert Art (entityType) und ISIN. */
        @JavascriptInterface
        public void onvistaSuche(final String begriff, final String id) {
            if (begriff == null || begriff.trim().isEmpty() || begriff.length() > 80) { antworten(id, ""); return; }
            abrufen("https://api.onvista.de/api/v1/instruments/query?limit=5&searchValue=" + Uri.encode(begriff.trim()), id);
        }

        /** Letzter Kurs bei Onvista - nur mit gueltiger Art und ISIN, sonst keine Anfrage. */
        @JavascriptInterface
        public void onvistaKurs(final String art, final String isin, final String id) {
            if (art == null || !art.matches("[A-Z_]{2,20}") || isin == null || !isin.matches("[A-Z]{2}[A-Z0-9]{9}[0-9]")) { antworten(id, ""); return; }
            abrufen("https://api.onvista.de/api/v1/instruments/" + art + "/ISIN:" + isin + "/snapshot", id);
        }

        /** Termine und Quartalszahlen. Yahoo verlangt dafuer seit 2023 ein
         *  Cookie plus "crumb" - beides holt die App selbst, ohne Konto. */
        @JavascriptInterface
        public void termine(final String ticker, final String id) {
            abrufen(null, id, ticker);
        }

        /** Nachrichten zu einem Namen: Yahoo-Suche (JSON, englisch). */
        @JavascriptInterface
        public void yahooNews(final String begriff, final String id) {
            abrufen("https://query1.finance.yahoo.com/v1/finance/search?quotesCount=0&newsCount=10&q=" + Uri.encode(begriff), id);
        }

        /** Nachrichten zu einem Namen: Google News als RSS (XML, deutsch). */
        @JavascriptInterface
        public void googleNews(final String begriff, final String id) {
            abrufen("https://news.google.com/rss/search?hl=de&gl=DE&ceid=DE:de&q=" + Uri.encode("\"" + begriff + "\""), id);
        }

        /** Versionsname aus dem Manifest (fuer "Version 0.30 · Beta" und Fehlermeldungen von Testern). */
        @JavascriptInterface
        public String version() {
            try {
                return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
            } catch (Exception e) {
                return "";
            }
        }

        /** Eigene News-Quelle (RSS/Atom), vom Nutzer eingetragen. Nur HTTPS. */
        @JavascriptInterface
        public void rss(final String adresse, final String id) {
            if (adresse == null || !adresse.startsWith("https://") || adresse.length() > 500) { antworten(id, ""); return; }
            abrufen(adresse, id);
        }

        /** Stand von Sperre und Sicherung fuer die Einstellungsseite (ohne Geheimnisse). */
        @JavascriptInterface
        public String sicherheitStatus() {
            SharedPreferences e = einst();
            String ordner = e.getString("ordner", null);
            return "{\"sperre\":" + Tresor.aktiv(e) + ",\"schutz\":" + e.getBoolean("schutz", true)
                    + ",\"pin\":" + Tresor.aktiv(e)
                    + ",\"netzAus\":" + netzAus() + ",\"sperreNach\":" + einst().getLong("sperreNach", 60) + ",\"geraetGesichert\":" + geraetGesichert() + ",\"passwort\":" + (schluessel("sicherung") != null)
                    + ",\"ordner\":" + (ordner == null ? "null" : "\"" + Uri.decode(Uri.parse(ordner).getLastPathSegment()).replace("\"", "") + "\"")
                    + ",\"letzte\":" + e.getLong("letzteSicherung", 0)
                    + ",\"datei\":\"" + e.getString("letzteDatei", "").replace("\"", "") + "\"}";
        }

        /** Neue 6-stellige App-PIN (nur Ziffern). Erstes Setzen verschluesselt die Daten. */
        @JavascriptInterface
        public boolean pinSetzen(String pin) {
            if (pin == null || !pin.matches("\\d{6}")) return false;
            try {
                boolean neu = !Tresor.aktiv(einst());
                java.util.Map<String, String> klar = neu ? alleSchluessel() : null;
                java.util.Map<String, byte[]> originale = neu ? Ablage.alleLesen(getFilesDir()) : null;
                Tresor.pinSetzen(einst(), datei(), geheim(), pin);
                if (neu) schluesselNeuAblegen(klar);      // ab jetzt im PIN-Tresor
                if (neu) Ablage.alleSchreiben(getFilesDir(), originale, true);
                einst().edit().putInt("fehlversuche", 0).apply();
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        /** "ok", "falsch:<rest>" oder "warten:<sekunden>". Nach 5 Fehlversuchen
         *  30 s Pause, danach verdoppelt sie sich. */
        @JavascriptInterface
        public String pinPruefen(String pin) {
            SharedPreferences e = einst();
            long bis = e.getLong("sperreBis", 0), jetzt = System.currentTimeMillis();
            if (jetzt < bis) return "warten:" + ((bis - jetzt) / 1000 + 1);
            if (Tresor.mitPinOeffnen(e, pin == null ? "" : pin)) {
                entsperrtMelden();
                return "ok";
            }
            int f = e.getInt("fehlversuche", 0) + 1;
            SharedPreferences.Editor ed = e.edit().putInt("fehlversuche", f);
            long pause = f >= 5 ? 30000L * (1L << Math.min(f - 5, 6)) : 0;
            if (pause > 0) ed.putLong("sperreBis", jetzt + pause);
            ed.apply();
            return pause > 0 ? "warten:" + pause / 1000 : "falsch:" + (5 - f);
        }

        /** Sperre ganz aus (Daten werden wieder unverschluesselt) - nur mit richtiger PIN. */
        @JavascriptInterface
        public boolean sperreAufheben(String pin) {
            try {
                if (!Tresor.mitPinOeffnen(einst(), pin)) return false;
                java.util.Map<String, String> klar = alleSchluessel();
                java.util.Map<String, byte[]> originale = Ablage.alleLesen(getFilesDir());
                Tresor.aufheben(einst(), datei(), geheim());
                schluesselNeuAblegen(klar);                  // zurueck in den Keystore
                Ablage.alleSchreiben(getFilesDir(), originale, false);
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        /** Vom PIN-Feld: jetzt sichtbar machen. */
        @JavascriptInterface
        public void sperrBildschirmBereit() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    web.setVisibility(View.VISIBLE);
                }
            });
        }

        /** PIN vergessen: ALLE App-Daten loeschen (Depots, Schluessel, Einstellungen).
         *  Sicherungsdateien im gewaehlten Ordner bleiben - die gehoeren dem Nutzer. */
        @JavascriptInterface
        public void allesLoeschen() {
            Tresor.schliessen();
            Tresor.bioSchluesselLoeschen();
            Tresor.aliasLoeschen(Tresor.GERAET_ALIAS);
            for (String n : new String[]{"depot.enc", "depot.enc.neu", "depot.json", "depot.json.neu"}) new File(getFilesDir(), n).delete();
            Ablage.allesLoeschen(getFilesDir());
            String ordner = einst().getString("ordner", null);
            einst().edit().clear().apply();
            if (ordner != null) einst().edit().putString("ordner", ordner).apply();
            getSharedPreferences("schluessel", MODE_PRIVATE).edit().clear().apply();
            gesperrt = false;
            zuletzt = null;
            runOnUiThread(new Runnable() {
                @Override
                public void run() { web.setVisibility(View.VISIBLE); web.clearCache(true); web.reload(); }
            });
        }

        /** Schalter "Internet ganz aus": dann geht KEIN Abruf mehr raus (Java sperrt, nicht nur die Oberflaeche). */
        /** Sekunden im Hintergrund bis zur PIN (0, 60, 300, 900). */
        @JavascriptInterface
        public void sperreNachSetzen(long sek) {
            if (sek == 0 || sek == 60 || sek == 300 || sek == 900) einst().edit().putLong("sperreNach", sek).apply();
        }

        @JavascriptInterface
        public void netzSetzen(boolean aus) { einst().edit().putBoolean("netzAus", aus).apply(); }

        @JavascriptInterface
        public void schutzSetzen(boolean an) {
            einst().edit().putBoolean("schutz", an).apply();
            runOnUiThread(new Runnable() {
                @Override
                public void run() { schutzAnwenden(); }
            });
        }

        /** Ordner fuer die automatische Sicherung waehlen (bleibt erlaubt). */
        @JavascriptInterface
        public void ordnerWaehlen() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() { eigenerDialog = true; startActivityForResult(new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE), ORDNER); }
            });
        }

        /** Sofort sichern; Ergebnis "ok:<Dateiname>" oder Fehlertext. */
        @JavascriptInterface
        public String jetztSichern() {
            String ordner = einst().getString("ordner", null);
            if (ordner == null) return "kein Ordner";
            if (Tresor.aktiv(einst()) && !Tresor.offen()) return "gesperrt";
            return sichernJetzt(ordner, zuletzt != null ? zuletzt : laden());
        }

        /** Jeder Export verschluesselt (Vorgabe 07.11.): Inhalt (z. B. CSV) mit dem eigenen
         *  Sicherungs-Passwort als .dksafe ueber den Speichern-Dialog. false = kein Passwort. */
        @JavascriptInterface
        public boolean exportVerschluesselt(String name, String text) {
            String pw = schluessel("sicherung");
            if (pw == null) return false;
            try {
                exportieren(name, "application/octet-stream", Sicherung.verschluesseln(text, pw));
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        // ------------------------------------------------ Originale + ZIP-Export (ab 0.44)
        private boolean tresorAn() { return Tresor.aktiv(einst()); }

        /** Original einer importierten Datei ablegen (Base64). Gibt die neue Kennung zurueck, leer bei Fehler/gesperrt. */
        @JavascriptInterface
        public String originalAblegen(String b64) {
            try {
                if (tresorAn() && !Tresor.offen()) return "";
                String id = Ablage.neueId();
                Ablage.schreiben(getFilesDir(), id, Base64.decode(b64, Base64.NO_WRAP), tresorAn());
                return id;
            } catch (Exception e) {
                return "";
            }
        }

        /** Original als Base64 (z. B. zum erneuten Einlesen), leer wenn nicht vorhanden. */
        @JavascriptInterface
        public String originalLesen(String id) {
            try {
                byte[] d = Ablage.lesen(getFilesDir(), id);
                return d == null ? "" : Base64.encodeToString(d, Base64.NO_WRAP);
            } catch (Exception e) {
                return "";
            }
        }

        @JavascriptInterface
        public void originalLoeschen(String id) { Ablage.loeschen(getFilesDir(), id); }

        /** Alles als verschluesselte ZIP (AES-256, Sicherungs-Passwort) ueber den Speichern-Dialog.
         *  index = JSON-Liste [{id, pfad, …}] der Originale (von der Oberflaeche, Pfade nach Depot sortiert).
         *  Rueckgabe "ok", "kein Passwort", "gesperrt" oder Fehlertext. */
        @JavascriptInterface
        public String zipExport(String index, String dateiname, String liesmich) {
            String pw = schluessel("sicherung");
            if (pw == null) return "kein Passwort";
            // 0.63 (Sicherheit): Das ZIP-Format (WinZip-AES) leitet den Schluessel nur mit 1000 Runden ab -
            // darum muss das Passwort selbst stark sein, sonst ist die ZIP per Durchprobieren angreifbar.
            if (pw.length() < 14) return "passwort zu kurz";
            if (tresorAn() && !Tresor.offen()) return "gesperrt";
            try {
                java.util.List<ZipAes.Eintrag> l = new java.util.ArrayList<ZipAes.Eintrag>();
                String daten = zuletzt != null ? zuletzt : laden();
                l.add(new ZipAes.Eintrag("depot-kompass.json", daten.getBytes(StandardCharsets.UTF_8)));
                l.add(new ZipAes.Eintrag("originale.json", index.getBytes(StandardCharsets.UTF_8)));
                l.add(new ZipAes.Eintrag("LIESMICH.txt", liesmich.getBytes(StandardCharsets.UTF_8)));
                org.json.JSONArray a = new org.json.JSONArray(index);
                int fehlt = 0;
                for (int i = 0; i < a.length(); i++) {
                    org.json.JSONObject o = a.getJSONObject(i);
                    byte[] d = Ablage.lesen(getFilesDir(), o.optString("id"));
                    String pfad = o.optString("pfad");
                    if (d == null || !pfad.startsWith("originale/") || pfad.contains("..")) { fehlt++; continue; }
                    l.add(new ZipAes.Eintrag(pfad, d));
                }
                speicherBytes = ZipAes.schreiben(l, pw);
                speicherText = null;
                final Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType("application/zip");
                i.putExtra(Intent.EXTRA_TITLE, dateiname);
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() { eigenerDialog = true; startActivityForResult(i, SPEICHERN); }
                });
                return fehlt == 0 ? "ok" : "ok:" + fehlt;
            } catch (Exception e) {
                return "Fehler: " + e.getMessage();
            }
        }

        /** ZIP-Export wiederherstellen: entschluesselt, legt die Originale (mit ihren Kennungen) wieder ab
         *  und gibt {"daten": "...", "index": "...", "originale": n} zurueck - oder {"fehler": "passwort"|...}. */
        @JavascriptInterface
        public String zipLesen(String b64, String passwort) {
            try {
                if (tresorAn() && !Tresor.offen()) return "{\"fehler\":\"gesperrt\"}";
                java.util.List<ZipAes.Eintrag> l = ZipAes.lesen(Base64.decode(b64, Base64.NO_WRAP), passwort);
                String daten = null, index = "[]";
                for (ZipAes.Eintrag e : l) {
                    // "depotklar.json" = ZIP-Exporte bis 0.44
                    if (e.name.equals("depot-kompass.json") || e.name.equals("depotklar.json")) daten = new String(e.daten, StandardCharsets.UTF_8);
                    if (e.name.equals("originale.json")) index = new String(e.daten, StandardCharsets.UTF_8);
                }
                if (daten == null) return "{\"fehler\":\"keine Depot-Kompass-Sicherung\"}";
                org.json.JSONArray a = new org.json.JSONArray(index);
                int n = 0;
                for (int i = 0; i < a.length(); i++) {
                    org.json.JSONObject o = a.getJSONObject(i);
                    for (ZipAes.Eintrag e : l) if (e.name.equals(o.optString("pfad")) && Ablage.gueltig(o.optString("id"))) {
                        Ablage.schreiben(getFilesDir(), o.optString("id"), e.daten, tresorAn()); n++;
                    }
                }
                return new org.json.JSONObject().put("daten", daten).put("index", index).put("originale", n).toString();
            } catch (Exception e) {
                String m = String.valueOf(e.getMessage());
                return "{\"fehler\":\"" + (m.equals("passwort") || m.equals("beschaedigt") ? m : "nicht lesbar") + "\"}";
            }
        }

        /** Verschluesselte Sicherung als Text (fuer "Datei speichern unter"). */
        @JavascriptInterface
        public String verschluesseln(String json, String passwort) {
            try { return Sicherung.verschluesseln(json, passwort); } catch (Exception e) { return ""; }
        }

        /** Entschluesseln; leer bei falschem Passwort. */
        @JavascriptInterface
        public String entschluesseln(String datei, String passwort) {
            String r = Sicherung.entschluesseln(datei, passwort);
            return r == null ? "" : r;
        }

        /** Liste der OpenRouter-Modelle (oeffentlich, ohne Schluessel). */
        @JavascriptInterface
        public void modelle(final String id) {
            abrufen("https://openrouter.ai/api/v1/models", id);
        }

        /** API-Schluessel speichern (leer = loeschen). Verschluesselt mit einem
         *  Schluessel aus dem Android-Keystore, der das Geraet nie verlaesst. */
        @JavascriptInterface
        public boolean schluesselSetzen(String dienst, String wert) {
            if (dienst == null || !dienst.matches("[a-z]{2,20}")) return false;
            SharedPreferences sp = getSharedPreferences("schluessel", MODE_PRIVATE);
            if (wert == null || wert.trim().isEmpty()) return sp.edit().remove(dienst).commit();
            return ablegen(sp, dienst, wert.trim());
        }

        /** Nur die letzten 4 Zeichen - zum Wiedererkennen, nie der ganze Schluessel. */
        @JavascriptInterface
        public String schluesselEnde(String dienst) {
            String s = schluessel(dienst);
            return s == null ? "" : s.length() > 4 ? s.substring(s.length() - 4) : "****";
        }

        /** Schluessel pruefen (ab 0.52): ein kleiner, fest eingebauter Lese-Abruf je Dienst - nur auf Knopfdruck bzw.
         *  nach dem Speichern, nur wenn Internet erlaubt ist. Antwort: {"status":HTTP-Code,"text":"Anfang der Antwort"}.
         *  Der Schluessel wird hier eingesetzt und erreicht nie die Oberflaeche. */
        @JavascriptInterface
        public void schluesselPruefen(final String dienst, final String id) {
            new Thread(new Runnable() {
                @Override
                public void run() {
                    String antwort;
                    try {
                        if (netzAus()) throw new Exception("Internet ist in der App ausgeschaltet");
                        String k = schluessel(dienst);
                        if (k == null) throw new Exception("kein Schluessel");
                        String kk = java.net.URLEncoder.encode(k, "UTF-8");
                        String adresse;
                        if ("openrouter".equals(dienst)) adresse = "https://openrouter.ai/api/v1/key";
                        else if ("openai".equals(dienst)) adresse = "https://api.openai.com/v1/models";
                        else if ("anthropic".equals(dienst)) adresse = "https://api.anthropic.com/v1/models?limit=1";
                        else if ("google".equals(dienst)) adresse = "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1";
                        else if ("finnhub".equals(dienst)) adresse = "https://finnhub.io/api/v1/quote?symbol=AAPL&token=" + kk;
                        else if ("twelvedata".equals(dienst)) adresse = "https://api.twelvedata.com/api_usage?apikey=" + kk;
                        else if ("fmp".equals(dienst)) adresse = "https://financialmodelingprep.com/stable/quote?symbol=AAPL&apikey=" + kk;
                        else if ("alphavantage".equals(dienst)) throw new Exception("nicht pruefbar");
                        else throw new Exception("unbekannter Dienst");
                        HttpURLConnection c = (HttpURLConnection) new URL(adresse).openConnection();
                        c.setRequestMethod("GET");
                        c.setConnectTimeout(15000);
                        c.setReadTimeout(20000);
                        c.setRequestProperty("Accept", "application/json");
                        if ("anthropic".equals(dienst)) { c.setRequestProperty("x-api-key", k); c.setRequestProperty("anthropic-version", "2023-06-01"); }
                        else if ("google".equals(dienst)) c.setRequestProperty("x-goog-api-key", k);
                        else if ("openrouter".equals(dienst) || "openai".equals(dienst)) c.setRequestProperty("Authorization", "Bearer " + k);
                        int code = c.getResponseCode();
                        InputStream in = code < 400 ? c.getInputStream() : c.getErrorStream();
                        String text = in == null ? "" : lesen(in);
                        if (text.length() > 300) text = text.substring(0, 300);
                        antwort = "{\"status\":" + code + ",\"text\":\"" + text.replaceAll("[^\\w .:,-]", " ") + "\"}";
                    } catch (Exception e) {
                        antwort = "{\"error\":{\"message\":\"" + String.valueOf(e.getMessage()).replaceAll("[^\\w .:-]", "") + "\"}}";
                    }
                    antworten(id, antwort);
                }
            }).start();
        }

        /** Alte Schnittstelle (bis 0.45): Chat an OpenRouter. */
        @JavascriptInterface
        public void ki(final String koerper, final String id) { kiAnfrage("openrouter", "", koerper, id); }

        /** KI-Abruf (ab 0.46) fuer OpenRouter, Anthropic, OpenAI, Google. Adressen sind fest eingebaut,
         *  den Koerper baut die Oberflaeche, den Schluessel setzt erst Java ein (er erreicht nie die Oberflaeche).
         *  Leerer Koerper = Modell-Liste holen. Antwort: roher JSON-Text des Anbieters. */
        @JavascriptInterface
        public void kiAnfrage(final String anbieter, final String modell, final String koerper, final String id) {
            new Thread(new Runnable() {
                @Override
                public void run() {
                    String antwort;
                    try {
                        if (netzAus()) throw new Exception("Internet ist in der App ausgeschaltet");
                        boolean liste = koerper == null || koerper.isEmpty();
                        String k = schluessel(anbieter);
                        if (k == null && !(liste && "openrouter".equals(anbieter))) throw new Exception("kein Schluessel");
                        if (modell != null && !modell.isEmpty() && !modell.matches("[A-Za-z0-9._:/-]{1,120}")) throw new Exception("ungueltiges Modell");
                        String adresse;
                        if ("openrouter".equals(anbieter)) adresse = liste ? "https://openrouter.ai/api/v1/models" : "https://openrouter.ai/api/v1/chat/completions";
                        else if ("openai".equals(anbieter)) adresse = liste ? "https://api.openai.com/v1/models" : "https://api.openai.com/v1/chat/completions";
                        else if ("anthropic".equals(anbieter)) adresse = liste ? "https://api.anthropic.com/v1/models?limit=100" : "https://api.anthropic.com/v1/messages";
                        else if ("google".equals(anbieter)) {
                            if (!liste && (modell == null || !modell.matches("[A-Za-z0-9._-]{1,80}"))) throw new Exception("ungueltiges Modell");
                            adresse = liste ? "https://generativelanguage.googleapis.com/v1beta/models?pageSize=200"
                                            : "https://generativelanguage.googleapis.com/v1beta/models/" + modell + ":generateContent";
                        } else throw new Exception("unbekannter Anbieter");
                        HttpURLConnection c = (HttpURLConnection) new URL(adresse).openConnection();
                        c.setRequestMethod(liste ? "GET" : "POST");
                        c.setConnectTimeout(20000);
                        c.setReadTimeout(180000);
                        c.setRequestProperty("Accept", "application/json");
                        if (k != null) {
                            if ("anthropic".equals(anbieter)) { c.setRequestProperty("x-api-key", k); c.setRequestProperty("anthropic-version", "2023-06-01"); }
                            else if ("google".equals(anbieter)) c.setRequestProperty("x-goog-api-key", k);
                            else c.setRequestProperty("Authorization", "Bearer " + k);
                        }
                        if ("openrouter".equals(anbieter)) c.setRequestProperty("X-Title", "Depot-Kompass");
                        if (!liste) {
                            c.setDoOutput(true);
                            c.setRequestProperty("Content-Type", "application/json");
                            OutputStream o = c.getOutputStream();
                            o.write(koerper.getBytes(StandardCharsets.UTF_8));
                            o.close();
                        }
                        int code = c.getResponseCode();
                        InputStream in = code < 400 ? c.getInputStream() : c.getErrorStream();
                        antwort = in == null ? "" : lesen(in);
                        // Fehler: HTTP-Code immer mitgeben, die Original-Meldung des Anbieters bleibt unter "roh"
                        if (code >= 400) antwort = antwort.trim().startsWith("{")
                                ? "{\"status\":" + code + ",\"roh\":" + antwort + "}"
                                : "{\"status\":" + code + ",\"roh\":{}}";
                    } catch (Exception e) {
                        antwort = "{\"error\":{\"message\":\"" + String.valueOf(e.getMessage()).replaceAll("[^\\w .:-]", "") + "\"}}";
                    }
                    antworten(id, antwort);
                }
            }).start();
        }

        private void abrufen(final String adresse, final String id) { abrufen(adresse, id, null); }

        private void abrufen(final String adresse, final String id, final String termineFuer) {
            new Thread(new Runnable() {
                @Override
                public void run() {
                    String antwort;
                    try {
                        if (netzAus()) throw new Exception("aus");     // leer = "keine Verbindung"
                        if (termineFuer == null) {
                            antwort = holen(adresse);
                        } else {
                            // Laeuft der crumb ab (401), einmal neu holen und wiederholen.
                            try {
                                antwort = holen(termineAdresse(termineFuer));
                            } catch (Exception abgelaufen) {
                                crumbWert = null;
                                antwort = holen(termineAdresse(termineFuer));
                            }
                        }
                    } catch (Exception e) {
                        antwort = "";
                    }
                    antworten(id, antwort);
                }
            }).start();
        }
    }

    private void antworten(String id, String antwort) {
        final String js = "window.kursAntwort('" + id.replaceAll("[^a-z0-9]", "") + "','"
                + Base64.encodeToString(antwort.getBytes(StandardCharsets.UTF_8), Base64.NO_WRAP) + "')";
        runOnUiThread(new Runnable() {
            @Override
            public void run() { web.evaluateJavascript(js, null); }
        });
    }

    private SecretKey tresor() throws Exception {
        KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
        ks.load(null);
        if (ks.containsAlias("dk-schluessel")) return (SecretKey) ks.getKey("dk-schluessel", null);
        KeyGenerator g = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        g.init(new KeyGenParameterSpec.Builder("dk-schluessel",
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
        return g.generateKey();
    }

    /** Ablegen: mit App-PIN im Tresor ("t:..."), sonst mit dem Keystore-Schluessel. */
    private boolean ablegen(SharedPreferences sp, String dienst, String wert) {
        try {
            if (Tresor.aktiv(einst())) {
                if (!Tresor.offen()) return false;
                return sp.edit().putString(dienst, "t:" + Tresor.textEinpacken(wert)).commit();
            }
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.ENCRYPT_MODE, tresor());
            byte[] iv = c.getIV(), roh = c.doFinal(wert.getBytes(StandardCharsets.UTF_8));
            byte[] alles = new byte[iv.length + roh.length];
            System.arraycopy(iv, 0, alles, 0, iv.length);
            System.arraycopy(roh, 0, alles, iv.length, roh.length);
            return sp.edit().putString(dienst, Base64.encodeToString(alles, Base64.NO_WRAP)).commit();
        } catch (Exception e) {
            return false;
        }
    }

    /** Gesperrt gibt es keine Schluessel - weder fuer KI noch fuer die Sicherung. */
    private String schluessel(String dienst) {
        String b = getSharedPreferences("schluessel", MODE_PRIVATE).getString(dienst, null);
        if (b == null) return null;
        try {
            if (b.startsWith("t:")) return Tresor.offen() ? Tresor.textAuspacken(b.substring(2)) : null;
            byte[] alles = Base64.decode(b, Base64.NO_WRAP);
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.DECRYPT_MODE, tresor(), new GCMParameterSpec(128, alles, 0, 12));
            return new String(c.doFinal(alles, 12, alles.length - 12), StandardCharsets.UTF_8);
        } catch (Exception e) {
            return null;
        }
    }

    /** Beim Ein-/Ausschalten der PIN: alle Schluessel kurz entpacken ... */
    private java.util.Map<String, String> alleSchluessel() {
        java.util.Map<String, String> m = new java.util.HashMap<String, String>();
        for (String d : getSharedPreferences("schluessel", MODE_PRIVATE).getAll().keySet()) {
            String w = schluessel(d);
            if (w != null) m.put(d, w);
        }
        return m;
    }

    /** ... und passend zum neuen Zustand wieder ablegen. */
    private void schluesselNeuAblegen(java.util.Map<String, String> m) {
        SharedPreferences sp = getSharedPreferences("schluessel", MODE_PRIVATE);
        for (java.util.Map.Entry<String, String> e : m.entrySet()) ablegen(sp, e.getKey(), e.getValue());
    }

    private static String crumbWert;

    private static String termineAdresse(String ticker) throws Exception {
        return "https://query2.finance.yahoo.com/v10/finance/quoteSummary/" + Uri.encode(ticker)
                + "?modules=calendarEvents,earnings,earningsHistory,summaryDetail,financialData,recommendationTrend,upgradeDowngradeHistory&crumb=" + Uri.encode(crumb());
    }

    private static synchronized String crumb() throws Exception {
        if (crumbWert != null) return crumbWert;
        if (java.net.CookieHandler.getDefault() == null)
            java.net.CookieHandler.setDefault(new java.net.CookieManager());
        try { holen("https://fc.yahoo.com"); } catch (Exception ignored) { }   // setzt nur das Cookie
        String c = holen("https://query2.finance.yahoo.com/v1/test/getcrumb").trim();
        if (c.isEmpty() || c.length() > 40 || c.contains("<")) throw new Exception("kein crumb");
        crumbWert = c;
        return crumbWert;
    }

    private static String holen(String adresse) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(adresse).openConnection();
        c.setRequestProperty("User-Agent", "Mozilla/5.0");
        c.setConnectTimeout(15000);
        c.setReadTimeout(15000);
        return lesen(c.getInputStream());
    }

    private static String lesen(InputStream in) throws Exception {
        ByteArrayOutputStream puffer = new ByteArrayOutputStream();
        byte[] b = new byte[8192];
        int n;
        while ((n = in.read(b)) > 0) puffer.write(b, 0, n);
        return puffer.toString("UTF-8");
    }
}
