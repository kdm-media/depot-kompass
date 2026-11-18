package app.depotkompass;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.app.job.JobService;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * Benachrichtigungen (ab 0.46, nur fuer Online-Nutzer, ab Werk aus).
 *
 * Android selbst startet diesen Dienst alle paar Stunden (JobScheduler, nur mit Netz) - kein Server,
 * keine Google-Dienste, kein Push von aussen. Er prueft nur die Werte aus wachter.bin:
 *  - Kursbewegung seit dem Vortag ueber der eingestellten Schwelle (Yahoo, oeffentlicher Kurs),
 *  - Earnings-Termin heute oder morgen (Termine aus der App, ohne Abruf),
 *  - neue Schlagzeilen seit der letzten Pruefung (Google News RSS, Suche nach dem Namen),
 *  - (0.64) Earnings-Ergebnis, sobald die Zahlen da sind (Yahoo earningsHistory: EPS Ist gegen Erwartung),
 *  - (0.64) Kursbewegung seit der letzten Pruefung.
 * 0.64: Jede Meldung landet zusaetzlich im Verlauf (verlauf.bin, gleicher Keystore-Schluessel, max. 300 Eintraege / 90 Tage).
 * wachter.bin enthaelt nur Namen, Ticker, Termine und Texte - verschluesselt mit einem eigenen
 * Android-Keystore-Schluessel (verlaesst das Geraet nie). Keine Betraege, Stueckzahlen oder Konten.
 */
public class Wachter extends JobService {
    static final int JOB_ID = 4711;
    static final String KANAL = "depotkompass-hinweise";
    private static final String ALIAS = "depotkompass-wachter";
    private volatile Thread lauf;

    // ------------------------------------------------------------ Steuerung aus der App
    static File datei(Context c) { return new File(c.getFilesDir(), "wachter.bin"); }

    /** Liste speichern (verschluesselt) und Pruefung planen; leer = aus und Liste loeschen. */
    static boolean setzen(Context c, String json) {
        JobScheduler js = (JobScheduler) c.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        if (json == null || json.trim().isEmpty()) {
            if (js != null) js.cancel(JOB_ID);
            datei(c).delete();
            return true;
        }
        letzterFehler = "";
        try {
            JSONObject k = new JSONObject(json);
            try {
                schreiben(datei(c), json);
            } catch (Exception e1) {
                Protokoll.fehler(c, "Wächter: Schreiben (1. Versuch)", e1);
                // 0.58: Schluessel im Android-Keystore kaputt/ungueltig (z. B. nach Wiederherstellung) -> einmal neu anlegen
                KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
                ks.load(null);
                ks.deleteEntry(ALIAS);
                schreiben(datei(c), json);
            }
            long stunden = Math.max(1, Math.min(24, k.optInt("stunden", 12)));   // 0.64: ab 1 Std. (Android-Minimum 15 Min.)
            if (js != null) {
                // 0.59: nur neu einplanen, wenn noch nicht (oder mit anderem Abstand) geplant - Android begrenzt,
                // wie oft eine App schedule() aufrufen darf; nach "Aktualisieren" wurde bei jedem Speichern neu geplant.
                long ms = stunden * 3600000L;
                JobInfo da = null;
                for (JobInfo j : js.getAllPendingJobs()) if (j.getId() == JOB_ID) da = j;
                if (da == null || da.getIntervalMillis() != ms) {
                    JobInfo info = new JobInfo.Builder(JOB_ID, new ComponentName(c, Wachter.class))
                            .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                            .setPeriodic(ms)
                            .build();
                    int r = js.schedule(info);
                    if (r != JobScheduler.RESULT_SUCCESS) {
                        letzterFehler = "JobScheduler hat die Hintergrund-Prüfung abgelehnt (RESULT_FAILURE)";
                        Protokoll.schreiben(c, "Wächter", letzterFehler + " · " + Protokoll.geraet());
                        return false;
                    }
                }
            }
            return true;
        } catch (Exception e) {
            letzterFehler = e.getClass().getSimpleName() + (e.getMessage() != null ? ": " + e.getMessage() : "");
            Protokoll.fehler(c, "Wächter: Einrichten fehlgeschlagen", e);
            return false;
        }
    }

    /** 0.58: Grund des letzten Fehlschlags (fuer die Meldung in der App). */
    static volatile String letzterFehler = "";

    static boolean geplant(Context c) {
        JobScheduler js = (JobScheduler) c.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        if (js == null) return false;
        for (JobInfo j : js.getAllPendingJobs()) if (j.getId() == JOB_ID) return true;
        return false;
    }

    static boolean erlaubt(Context c) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        return nm != null && (Build.VERSION.SDK_INT < 24 || nm.areNotificationsEnabled());
    }

    /** 0.63: neutraler Text fuer den Sperrbildschirm (Sprache aus der App, siehe pruefen()). */
    static volatile String sperrText = "Neuer Hinweis – zum Ansehen entsperren";

    /** Beispiel-Hinweis sofort zeigen (Knopf "Test-Benachrichtigung"). */
    static void zeigen(Context c, String kanalName, String titel, String text, int nr) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel ch = new NotificationChannel(KANAL, kanalName == null || kanalName.isEmpty() ? "Depot-Kompass" : kanalName,
                    NotificationManager.IMPORTANCE_DEFAULT);
            ch.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);   // 0.63: Inhalt nicht auf dem Sperrbildschirm
            nm.createNotificationChannel(ch);
        }
        Intent oeffnen = new Intent(c, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(c, 0, oeffnen, PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0));
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, KANAL) : new Notification.Builder(c);
        b.setSmallIcon(c.getApplicationInfo().icon).setContentTitle(titel).setContentText(text)
                .setStyle(new Notification.BigTextStyle().bigText(text)).setContentIntent(pi).setAutoCancel(true);
        // 0.63 (Sicherheit): auf dem Sperrbildschirm nur ein neutraler Hinweis - keine Werte, Kurse oder Namen
        if (Build.VERSION.SDK_INT >= 21) {
            Notification.Builder offen = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, KANAL) : new Notification.Builder(c);
            offen.setSmallIcon(c.getApplicationInfo().icon).setContentTitle("Depot-Kompass").setContentText(sperrText);
            b.setVisibility(Notification.VISIBILITY_PRIVATE).setPublicVersion(offen.build());
        }
        nm.notify(nr, b.build());
    }

    // ------------------------------------------------------------ 0.64: Verlauf + Pruefprotokoll
    static File verlaufDatei(Context c) { return new File(c.getFilesDir(), "verlauf.bin"); }
    private static final Object VERLAUF_SPERRE = new Object();

    /** Verlauf lesen: {"eintraege":[{"t":ms,"art":"alarm|kurs|lauf|earnings|ergebnis|news","titel","text"}], "laeufe":[{"t","werte","meldungen","fehler"}]} */
    static String verlaufLesen(Context c) {
        synchronized (VERLAUF_SPERRE) {
            try {
                File f = verlaufDatei(c);
                if (!f.isFile()) return "{\"eintraege\":[],\"laeufe\":[]}";
                return lesenDatei(f);
            } catch (Exception e) {
                return "{\"eintraege\":[],\"laeufe\":[]}";
            }
        }
    }

    static void verlaufLeeren(Context c) { synchronized (VERLAUF_SPERRE) { verlaufDatei(c).delete(); } }

    /** Eintrag oder Lauf anhaengen; aelter als 90 Tage bzw. mehr als 300/60 Eintraege fallen raus. */
    private static void verlaufMerken(Context c, JSONObject eintrag, JSONObject lauf) {
        synchronized (VERLAUF_SPERRE) {
            try {
                JSONObject v = new JSONObject(verlaufLesen(c));
                long grenze = System.currentTimeMillis() - 90L * 86400000L;
                JSONArray alt = v.optJSONArray("eintraege"), neu = new JSONArray();
                if (eintrag != null) neu.put(eintrag);
                for (int i = 0; alt != null && i < alt.length() && neu.length() < 300; i++) {
                    JSONObject e = alt.optJSONObject(i);
                    if (e != null && e.optLong("t") >= grenze) neu.put(e);
                }
                JSONArray altL = v.optJSONArray("laeufe"), neuL = new JSONArray();
                if (lauf != null) neuL.put(lauf);
                for (int i = 0; altL != null && i < altL.length() && neuL.length() < 60; i++) neuL.put(altL.opt(i));
                v.put("eintraege", neu).put("laeufe", neuL);
                schreiben(verlaufDatei(c), v.toString());
            } catch (Exception e) {
                Protokoll.fehler(c, "Wächter: Verlauf", e);
            }
        }
    }

    private int gemeldetLauf = 0;

    /** Benachrichtigung zeigen und im Verlauf merken. */
    private void melden(String art, String kanal, String titel, String text, int nr) {
        zeigen(this, kanal, titel, text, nr);
        gemeldetLauf++;
        try { verlaufMerken(this, new JSONObject().put("t", System.currentTimeMillis()).put("art", art).put("titel", titel).put("text", text), null); }
        catch (Exception ignored) { }
    }

    // ------------------------------------------------------------ Hintergrund-Pruefung
    @Override
    public boolean onStartJob(final JobParameters p) {
        lauf = new Thread(new Runnable() {
            @Override
            public void run() {
                try { pruefen(); } catch (Exception e) { Protokoll.fehler(Wachter.this, "Wächter: Hintergrund-Prüfung", e); }
                jobFinished(p, false);
            }
        });
        lauf.start();
        return true;
    }

    @Override
    public boolean onStopJob(JobParameters p) {
        if (lauf != null) lauf.interrupt();
        return true;
    }

    private void pruefen() throws Exception {
        if (getSharedPreferences("einstellungen", MODE_PRIVATE).getBoolean("netzAus", false)) return;   // Internet in der App aus
        File f = datei(this);
        if (!f.isFile()) return;
        JSONObject k = new JSONObject(lesenDatei(f));
        JSONObject t = k.optJSONObject("texte");
        if (t == null) t = new JSONObject();
        SharedPreferences gemeldet = getSharedPreferences("wachter", MODE_PRIVATE);
        String heute = new SimpleDateFormat("yyyy-MM-dd", Locale.ROOT).format(new Date());
        String morgen = new SimpleDateFormat("yyyy-MM-dd", Locale.ROOT).format(new Date(System.currentTimeMillis() + 86400000L));
        double schwelle = k.optDouble("schwelle", 5);
        boolean kurse = k.optBoolean("kurse", true), earnings = k.optBoolean("earnings", true), news = k.optBoolean("news", false),
                markenAn = k.optBoolean("marken", true);
        java.util.HashMap<String, Double> fx = new java.util.HashMap<>();   // 0.61: Euro-Umrechnung je Waehrung, einmal pro Lauf
        fx.put("EUR", 1.0);
        Locale ort = "en".equals(k.optString("sprache")) ? Locale.US : Locale.GERMANY;
        long letzteNews = gemeldet.getLong("newsStand", System.currentTimeMillis() - 12 * 3600000L);
        String kanal = t.optString("kanal", "Depot-Kompass");
        sperrText = t.optString("entsperren", sperrText);
        JSONArray werte = k.optJSONArray("werte");
        if (werte == null) return;
        int nr = 100, geprueft = 0, fehler = 0;
        gemeldetLauf = 0;
        boolean ergebnisse = k.optBoolean("ergebnisse", true);
        double schwelleLauf = k.optDouble("schwelleLauf", 0);   // 0.64: Bewegung seit der letzten Pruefung (0 = aus)
        long vorgestern = System.currentTimeMillis() - 4L * 86400000L;
        String grenzeErgebnis = new SimpleDateFormat("yyyy-MM-dd", Locale.ROOT).format(new Date(vorgestern));
        for (int i = 0; i < werte.length() && i < 60; i++) {
            if (Thread.currentThread().isInterrupted()) return;
            JSONObject w = werte.getJSONObject(i);
            String name = w.optString("name"), ticker = w.optString("ticker");
            geprueft++;
            // 1) Earnings heute/morgen - ohne Abruf, aus den Terminen der App
            if (earnings) {
                JSONArray e = w.optJSONArray("earnings");
                for (int j = 0; e != null && j < e.length(); j++) {
                    String d = e.optString(j);
                    String schl = "e:" + name + ":" + d;
                    if ((d.equals(heute) || d.equals(morgen)) && !gemeldet.getBoolean(schl, false)) {
                        melden("earnings", kanal, "📊 " + name, d.equals(heute) ? t.optString("earningsHeute", "Earnings heute") : t.optString("earningsMorgen", "Earnings morgen"), nr++);
                        gemeldet.edit().putBoolean(schl, true).apply();
                    }
                }
            }
            // 1b) 0.64: Earnings-Ergebnis - Termin heute oder in den letzten 4 Tagen, Zahlen schon da?
            if (ergebnisse && ticker.matches("[A-Za-z0-9.^=-]{1,20}")) {
                JSONArray e = w.optJSONArray("earnings");
                String termin = null;
                for (int j = 0; e != null && j < e.length(); j++) {
                    String d = e.optString(j);
                    if (d.compareTo(grenzeErgebnis) >= 0 && d.compareTo(heute) <= 0) termin = d;
                }
                if (termin != null) {
                    try {
                        JSONObject erg = ergebnis(ticker, termin);
                        if (erg != null) {
                            String schl = "er:" + ticker + ":" + erg.optString("quartal");
                            if (!gemeldet.getBoolean(schl, false)) {
                                double ist = erg.optDouble("ist"), soll = erg.optDouble("soll", Double.NaN);
                                String text = t.optString("zahlenDa", "Zahlen sind da") + ": EPS " + String.format(ort, "%.2f", ist);
                                if (!Double.isNaN(soll)) {
                                    double ab = soll != 0 ? (ist / Math.abs(soll) - Math.signum(soll)) * 100 : Double.NaN;
                                    text += " · " + t.optString("erwartet", "erwartet") + " " + String.format(ort, "%.2f", soll)
                                            + " · " + (ist >= soll ? t.optString("beat", "über Erwartung") : t.optString("miss", "unter Erwartung"))
                                            + (Double.isNaN(ab) || Double.isInfinite(ab) ? "" : " (" + String.format(ort, "%+.1f %%", ab) + ")");
                                }
                                melden("ergebnis", kanal, "📊 " + name, text, nr++);
                                gemeldet.edit().putBoolean(schl, true).apply();
                            }
                        }
                    } catch (Exception ex) { fehler++; }
                }
            }
            // 2) Kursbewegung seit dem Vortag und (0.61) Kurs-Marken - ein Abruf je Ticker (oeffentlicher Kurs, nur der Ticker geht raus)
            JSONArray marken = markenAn ? w.optJSONArray("marken") : null;
            boolean mitMarken = marken != null && marken.length() > 0;
            if ((kurse || mitMarken) && ticker.matches("[A-Za-z0-9.^=-]{1,20}")) {
                try {
                    JSONObject meta = new JSONObject(holen("https://query1.finance.yahoo.com/v8/finance/chart/" + Uri.encode(ticker) + "?range=5d&interval=1d"))
                            .getJSONObject("chart").getJSONArray("result").getJSONObject(0).getJSONObject("meta");
                    double jetzt = meta.optDouble("regularMarketPrice", Double.NaN), vorher = meta.optDouble("chartPreviousClose", Double.NaN);
                    if (meta.has("previousClose")) vorher = meta.optDouble("previousClose", vorher);
                    double pct = (jetzt / vorher - 1) * 100;
                    String schl = "k:" + ticker + ":" + heute;
                    if (kurse && !Double.isNaN(pct) && !Double.isInfinite(pct) && Math.abs(pct) >= schwelle && !gemeldet.getBoolean(schl, false)) {
                        String zahl = String.format(ort, "%+.1f %%", pct);
                        melden("kurs", kanal, (pct > 0 ? "📈 " : "📉 ") + name, zahl + " " + t.optString("seitGestern", "seit dem letzten Schlusskurs"), nr++);
                        gemeldet.edit().putBoolean(schl, true).apply();
                    }
                    // 0.64: Bewegung seit der letzten Pruefung (Kurs je Ticker gemerkt, nur Marktkurs - keine Bestaende)
                    if (schwelleLauf > 0 && !Double.isNaN(jetzt) && jetzt > 0) {
                        float alt = gemeldet.getFloat("p:" + ticker, -1f);
                        if (alt > 0) {
                            double seit = (jetzt / alt - 1) * 100;
                            if (Math.abs(seit) >= schwelleLauf)
                                melden("kurs", kanal, (seit > 0 ? "⏫ " : "⏬ ") + name, String.format(ort, "%+.1f %%", seit) + " " + t.optString("seitPruefung", "seit der letzten Prüfung"), nr++);
                        }
                        gemeldet.edit().putFloat("p:" + ticker, (float) jetzt).apply();
                    }
                    if (mitMarken) {
                        double eur = inEuro(jetzt, meta.optString("currency", "EUR"), fx);
                        if (!Double.isNaN(eur) && eur > 0) {
                            // 0.62: benannte Alarme - Marke unter/ueber, Zone von-bis, Bewegung in % seit dem Setzen
                            for (int j = 0; j < marken.length(); j++) {
                                JSONObject mk = marken.optJSONObject(j);
                                if (mk == null) continue;
                                String art = mk.optString("art");
                                boolean erreicht;
                                if (art.equals("unter")) erreicht = eur <= mk.optDouble("wert", -1);
                                else if (art.equals("ueber")) { double wert = mk.optDouble("wert", Double.NaN); erreicht = !Double.isNaN(wert) && wert > 0 && eur >= wert; }
                                else if (art.equals("zone")) {
                                    double von = mk.optDouble("von", Double.NaN), bis = mk.optDouble("bis", Double.NaN);
                                    erreicht = !Double.isNaN(von) && !Double.isNaN(bis) && eur >= Math.min(von, bis) && eur <= Math.max(von, bis);
                                } else if (art.equals("prozent")) {
                                    double basis = mk.optDouble("basis", Double.NaN), soll = mk.optDouble("prozent", Double.NaN);
                                    double ist = (eur / basis - 1) * 100;
                                    erreicht = basis > 0 && !Double.isNaN(soll) && soll != 0 && (soll < 0 ? ist <= soll + 1e-9 : ist >= soll - 1e-9);
                                } else continue;
                                String mschl = "m:" + mk.optString("id") + ":" + art + ":" + mk.optString("wert") + ":" + mk.optString("von") + ":" + mk.optString("bis") + ":" + mk.optString("prozent");
                                if (erreicht && !gemeldet.getBoolean(mschl, false)) {
                                    String alarmName = mk.optString("name", "");
                                    melden("alarm", kanal, "🔔 " + name + (alarmName.isEmpty() ? "" : " – " + alarmName),
                                            mk.optString("text", art) + " · " + t.optString("kursJetzt", "Kurs jetzt") + " " + String.format(ort, "%,.2f €", eur), nr++);
                                    gemeldet.edit().putBoolean(mschl, true).apply();
                                } else if (!erreicht && gemeldet.getBoolean(mschl, false)) {
                                    gemeldet.edit().remove(mschl).apply();   // wieder scharf, sobald der Kurs Marke/Zone verlassen hat
                                }
                            }
                        }
                    }
                } catch (Exception ex) { fehler++; }
            }
            // 3) Neue Schlagzeilen seit der letzten Pruefung (Google News, Suche nach dem Namen)
            if (news && w.optBoolean("news", true) && !name.isEmpty()) {
                try {
                    String rss = holen("https://news.google.com/rss/search?hl=" + (ort == Locale.US ? "en-US&gl=US&ceid=US:en" : "de&gl=DE&ceid=DE:de")
                            + "&q=" + Uri.encode("\"" + w.optString("suche", name) + "\""));
                    Matcher m = Pattern.compile("<item>[\\s\\S]*?<title>([\\s\\S]*?)</title>[\\s\\S]*?<pubDate>([^<]+)</pubDate>").matcher(rss);
                    SimpleDateFormat rfc = new SimpleDateFormat("EEE, dd MMM yyyy HH:mm:ss zzz", Locale.US);
                    int neu = 0;
                    String erste = null;
                    while (m.find() && neu < 20) {
                        try {
                            if (rfc.parse(m.group(2).trim()).getTime() > letzteNews) {
                                if (erste == null) erste = m.group(1).replace("<![CDATA[", "").replace("]]>", "").replace("&amp;", "&").trim();
                                neu++;
                            }
                        } catch (Exception ignored) { }
                    }
                    if (neu > 0) melden("news", kanal, "📰 " + name, (neu == 1 ? t.optString("eineSchlagzeile", "1 neue Schlagzeile")
                            : String.format(ort, t.optString("schlagzeilen", "%d neue Schlagzeilen"), neu)) + (erste != null ? ": " + erste : ""), nr++);
                } catch (Exception ignored) { }
            }
        }
        if (news) gemeldet.edit().putLong("newsStand", System.currentTimeMillis()).apply();
        try { verlaufMerken(this, null, new JSONObject().put("t", System.currentTimeMillis()).put("werte", geprueft).put("meldungen", gemeldetLauf).put("fehler", fehler)); }
        catch (Exception ignored) { }
        // alte Merker (aelter als ~2 Wochen) aufraeumen
        if (gemeldet.getAll().size() > 600) gemeldet.edit().clear().putLong("newsStand", System.currentTimeMillis()).apply();
    }

    // ------------------------------------------------------------ Hilfen
    private static String crumbWert;

    /** Yahoo verlangt fuer quoteSummary Cookie + crumb (wie MainActivity). */
    private static synchronized String crumb() throws Exception {
        if (crumbWert != null) return crumbWert;
        if (java.net.CookieHandler.getDefault() == null) java.net.CookieHandler.setDefault(new java.net.CookieManager());
        try { holen("https://fc.yahoo.com"); } catch (Exception ignored) { }
        String c = holen("https://query2.finance.yahoo.com/v1/test/getcrumb").trim();
        if (c.isEmpty() || c.length() > 40 || c.contains("<")) throw new Exception("kein crumb");
        crumbWert = c;
        return c;
    }

    /** 0.64: juengstes Quartal aus earningsHistory, wenn es zum Termin passt (Quartalsende 0-120 Tage vor dem Termin)
     *  und schon ein Ist-Wert da ist. {"quartal","ist","soll"} oder null. Nur der Ticker geht raus. */
    static JSONObject ergebnis(String ticker, String termin) throws Exception {
        String url = "https://query2.finance.yahoo.com/v10/finance/quoteSummary/" + Uri.encode(ticker) + "?modules=earningsHistory&crumb=" + Uri.encode(crumb());
        JSONArray h = new JSONObject(holen(url)).getJSONObject("quoteSummary").getJSONArray("result").getJSONObject(0)
                .getJSONObject("earningsHistory").optJSONArray("history");
        if (h == null) return null;
        long t = new SimpleDateFormat("yyyy-MM-dd", Locale.ROOT).parse(termin).getTime() / 1000;
        JSONObject best = null;
        long bestQ = 0;
        for (int i = 0; i < h.length(); i++) {
            JSONObject q = h.optJSONObject(i);
            if (q == null) continue;
            long qe = q.optJSONObject("quarter") != null ? q.getJSONObject("quarter").optLong("raw") : 0;
            JSONObject ist = q.optJSONObject("epsActual");
            if (qe <= 0 || ist == null || !ist.has("raw")) continue;
            if (qe > t || t - qe > 120L * 86400) continue;
            if (qe > bestQ) { bestQ = qe; best = q; }
        }
        if (best == null) return null;
        JSONObject r = new JSONObject().put("quartal", bestQ).put("ist", best.getJSONObject("epsActual").getDouble("raw"));
        JSONObject soll = best.optJSONObject("epsEstimate");
        if (soll != null && soll.has("raw")) r.put("soll", soll.getDouble("raw"));
        return r;
    }

    /** 0.61: Kurs in Euro wie in der App (Pence/Cent teilen, Wechselkurs EUR<W>=X von Yahoo). NaN, wenn nicht umrechenbar. */
    private static double inEuro(double preis, String w, java.util.HashMap<String, Double> fx) {
        if (Double.isNaN(preis)) return Double.NaN;
        if (w.equals("GBp") || w.equals("GBX")) { preis /= 100; w = "GBP"; }
        else if (w.equals("ZAc")) { preis /= 100; w = "ZAR"; }
        else if (w.equals("ILA")) { preis /= 100; w = "ILS"; }
        if (!w.matches("[A-Z]{3}")) return Double.NaN;
        if (!fx.containsKey(w)) {
            double f = Double.NaN;
            try {
                f = new JSONObject(holen("https://query1.finance.yahoo.com/v8/finance/chart/EUR" + w + "=X?range=1d&interval=1d"))
                        .getJSONObject("chart").getJSONArray("result").getJSONObject(0).getJSONObject("meta").optDouble("regularMarketPrice", Double.NaN);
            } catch (Exception ignored) { }
            fx.put(w, f);
        }
        double f = fx.get(w);
        return Double.isNaN(f) || f <= 0 ? Double.NaN : preis / f;
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
        in.close();
        return puffer.toString("UTF-8");
    }

    private static SecretKey schluessel() throws Exception {
        KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
        ks.load(null);
        if (ks.containsAlias(ALIAS)) return (SecretKey) ks.getKey(ALIAS, null);
        KeyGenerator g = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        g.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
        return g.generateKey();
    }

    private static void schreiben(File f, String text) throws Exception {
        Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
        c.init(Cipher.ENCRYPT_MODE, schluessel());
        byte[] iv = c.getIV(), roh = c.doFinal(text.getBytes(StandardCharsets.UTF_8));
        FileOutputStream o = new FileOutputStream(f);
        o.write(Base64.encode(iv, Base64.NO_WRAP));
        o.write('\n');
        o.write(Base64.encode(roh, Base64.NO_WRAP));
        o.close();
    }

    private static String lesenDatei(File f) throws Exception {
        String[] teile = lesen(new FileInputStream(f)).split("\n");
        Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
        c.init(Cipher.DECRYPT_MODE, schluessel(), new GCMParameterSpec(128, Base64.decode(teile[0], Base64.NO_WRAP)));
        return new String(c.doFinal(Base64.decode(teile[1], Base64.NO_WRAP)), StandardCharsets.UTF_8);
    }
}
