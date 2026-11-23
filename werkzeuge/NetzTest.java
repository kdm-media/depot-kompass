import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

/**
 * Vorab-Test der Netzwege der App - dieselbe Logik wie MainActivity
 * (CookieManager + crumb, holen(), OpenRouter-POST), aber ohne Android,
 * damit sie in Termux auf dem echten Handy laeuft.
 *
 *   java werkzeuge/NetzTest.java
 */
public class NetzTest {
    static String crumbWert;

    public static void main(String[] a) throws Exception {
        pruefe("Kurs RHM.DE (chart)", () -> {
            String j = holen("https://query1.finance.yahoo.com/v8/finance/chart/RHM.DE?range=5d&interval=1d");
            return wert(j, "\"regularMarketPrice\":") + " " + wert(j, "\"currency\":");
        });
        pruefe("Jahres-Chart 7974.T (Wochen + Dividenden)", () -> {
            String j = holen("https://query1.finance.yahoo.com/v8/finance/chart/7974.T?range=1y&interval=1wk&events=div");
            return (j.split("\\d{10},").length - 1) + " Zeitpunkte, Dividenden: " + j.contains("\"dividends\"");
        });
        pruefe("Suche ISIN IE000BI8OT95", () -> {
            String j = holen("https://query1.finance.yahoo.com/v1/finance/search?quotesCount=10&newsCount=0&q=IE000BI8OT95");
            return j.replaceAll(".*?\"symbol\":\"([^\"]+)\".*", "$1");
        });
        pruefe("Suche WKN 723610 (Siemens)", () -> {
            String j = holen("https://query1.finance.yahoo.com/v1/finance/search?quotesCount=10&newsCount=0&q=723610");
            return j.contains("\"symbol\"") ? j.replaceAll(".*?\"symbol\":\"([^\"]+)\".*", "$1") : "kein Treffer";
        });
        pruefe("Earnings + Quartale AAPL (mit crumb)", () -> {
            String j = holen(termineAdresse("AAPL"));
            return "naechste Earnings " + j.contains("earningsDate") + ", Quartale " + j.contains("earningsHistory")
                    + ", crumb " + (crumbWert != null ? crumbWert.length() + " Zeichen" : "fehlt");
        });
        pruefe("crumb erneuern nach Ablauf", () -> {
            crumbWert = "kaputt";
            String j;
            try { j = holen(termineAdresse("MSFT")); } catch (Exception abgelaufen) { crumbWert = null; j = holen(termineAdresse("MSFT")); }
            return "zweiter Versuch ok: " + j.contains("earningsDate");
        });
        pruefe("OpenRouter Modell-Liste (ohne Schluessel)", () -> {
            String j = holen("https://openrouter.ai/api/v1/models");
            int frei = j.split(":free\"").length - 1;
            return frei + " Gratis-Modelle";
        });
        pruefe("OpenRouter Anfrage OHNE gueltigen Schluessel", () -> {
            HttpURLConnection c = (HttpURLConnection) new URL("https://openrouter.ai/api/v1/chat/completions").openConnection();
            c.setRequestMethod("POST"); c.setDoOutput(true);
            c.setRequestProperty("Content-Type", "application/json");
            c.setRequestProperty("Authorization", "Bearer sk-or-v1-ungueltig");
            try (OutputStream o = c.getOutputStream()) { o.write("{\"model\":\"x:free\",\"messages\":[]}".getBytes(StandardCharsets.UTF_8)); }
            InputStream in = c.getResponseCode() < 400 ? c.getInputStream() : c.getErrorStream();
            return "HTTP " + c.getResponseCode() + " -> App zeigt: " + wert(lesen(in), "\"message\":");
        });
    }

    interface Schritt { String los() throws Exception; }

    static void pruefe(String name, Schritt s) {
        long t = System.currentTimeMillis();
        try {
            System.out.println("OK    " + name + ": " + s.los() + "  (" + (System.currentTimeMillis() - t) + " ms)");
        } catch (Exception e) {
            System.out.println("FEHLER " + name + ": " + e);
        }
    }

    static String wert(String j, String schluessel) {
        int i = j.indexOf(schluessel);
        if (i < 0) return "?";
        String r = j.substring(i + schluessel.length());
        return r.substring(0, Math.min(r.length(), Math.max(1, r.indexOf(r.startsWith("\"") ? "\"," : ","))));
    }

    // --- ab hier 1:1 wie in MainActivity ---
    static String termineAdresse(String ticker) throws Exception {
        return "https://query2.finance.yahoo.com/v10/finance/quoteSummary/" + URLEncoder.encode(ticker, "UTF-8")
                + "?modules=calendarEvents,earnings,earningsHistory,summaryDetail&crumb=" + URLEncoder.encode(crumb(), "UTF-8");
    }

    static synchronized String crumb() throws Exception {
        if (crumbWert != null) return crumbWert;
        if (java.net.CookieHandler.getDefault() == null)
            java.net.CookieHandler.setDefault(new java.net.CookieManager());
        try { holen("https://fc.yahoo.com"); } catch (Exception ignored) { }
        String c = holen("https://query2.finance.yahoo.com/v1/test/getcrumb").trim();
        if (c.isEmpty() || c.length() > 40 || c.contains("<")) throw new Exception("kein crumb");
        crumbWert = c;
        return crumbWert;
    }

    static String holen(String adresse) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(adresse).openConnection();
        c.setRequestProperty("User-Agent", "Mozilla/5.0");
        c.setConnectTimeout(15000);
        c.setReadTimeout(15000);
        return lesen(c.getInputStream());
    }

    static String lesen(InputStream in) throws Exception {
        ByteArrayOutputStream puffer = new ByteArrayOutputStream();
        byte[] b = new byte[8192];
        int n;
        while ((n = in.read(b)) > 0) puffer.write(b, 0, n);
        return puffer.toString("UTF-8");
    }
}
