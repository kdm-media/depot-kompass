package app.depotkompass;

import android.content.Context;
import android.os.Build;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Fehlerprotokoll (ab 0.59: Log-Sammler, der genaue Fehler liefert).
 *
 * Nur im App-Speicher (files/fehler.log), hoechstens ca. 64 KB (aeltere Haelfte faellt weg).
 * Es werden NUR technische Meldungen geschrieben: Zeit, Bereich, Fehlertext, gekuerzter Stacktrace,
 * App- und Android-Version. Keine Betraege, Stueckzahlen, Konten, Schluessel oder Depotnamen.
 * Raus geht die Datei nur, wenn man sie selbst teilt (Mehr → Fehlerprotokoll → Teilen).
 */
final class Protokoll {
    private static final int MAX = 64 * 1024;

    private Protokoll() { }

    static File datei(Context c) { return new File(c.getFilesDir(), "fehler.log"); }

    static synchronized void schreiben(Context c, String bereich, String text) {
        if (c == null) return;
        try {
            File f = datei(c);
            if (f.length() > MAX) {                        // aeltere Haelfte wegwerfen
                String alt = lesen(c);
                int ab = alt.indexOf('\n', alt.length() / 2);
                FileOutputStream o = new FileOutputStream(f);
                o.write(alt.substring(ab < 0 ? 0 : ab + 1).getBytes(StandardCharsets.UTF_8));
                o.close();
            }
            String zeit = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.ROOT).format(new Date());
            String zeile = zeit + " | " + bereich + " | " + (text == null ? "" : text.replace('\n', ' ').replace('\r', ' ')) + "\n";
            FileOutputStream o = new FileOutputStream(f, true);
            o.write(zeile.getBytes(StandardCharsets.UTF_8));
            o.close();
        } catch (Exception ignored) { /* Protokoll darf nie selbst stoeren */ }
    }

    static void fehler(Context c, String bereich, Throwable t) {
        StringWriter sw = new StringWriter();
        t.printStackTrace(new PrintWriter(sw));
        String[] z = sw.toString().split("\n");
        StringBuilder b = new StringBuilder();
        for (int i = 0; i < z.length && i < 8; i++) b.append(i == 0 ? "" : " ⏎ ").append(z[i].trim());
        schreiben(c, bereich, b.toString());
    }

    static synchronized String lesen(Context c) {
        try {
            File f = datei(c);
            if (!f.exists()) return "";
            FileInputStream in = new FileInputStream(f);
            byte[] b = new byte[(int) Math.min(f.length(), MAX * 2L)];
            int n = in.read(b);
            in.close();
            return n <= 0 ? "" : new String(b, 0, n, StandardCharsets.UTF_8);
        } catch (Exception e) {
            return "";
        }
    }

    static synchronized void leeren(Context c) { datei(c).delete(); }

    static String geraet() {
        return "Android " + Build.VERSION.RELEASE + " (API " + Build.VERSION.SDK_INT + ")";
    }
}
