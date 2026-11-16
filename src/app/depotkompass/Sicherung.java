package app.depotkompass;

import android.content.ContentResolver;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;
import android.util.Base64;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.List;
import java.util.Locale;

import javax.crypto.Cipher;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;

/**
 * Verschluesselte Sicherung - nur lokal (Vorgabe 07.11.2026: kein Server).
 *
 * Format (.dksafe, JSON): Schluessel aus dem Passwort per PBKDF2-SHA256,
 * Inhalt mit AES-256-GCM. Ohne Passwort ist die Datei wertlos; mit falschem
 * Passwort schlaegt GCM fehl, statt Unsinn zu liefern.
 */
final class Sicherung {
    static final String PRAEFIX = "Depot-Kompass-Sicherung-";
    static final int BEHALTEN = 10;
    private static final int RUNDEN = 200000;

    private Sicherung() { }

    static String verschluesseln(String json, String passwort) throws Exception {
        SecureRandom z = new SecureRandom();
        byte[] salz = new byte[16], iv = new byte[12];
        z.nextBytes(salz);
        z.nextBytes(iv);
        Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
        c.init(Cipher.ENCRYPT_MODE, schluessel(passwort, salz, RUNDEN), new GCMParameterSpec(128, iv));
        byte[] daten = c.doFinal(json.getBytes(StandardCharsets.UTF_8));
        return "{\"format\":\"depot-kompass-sicherung\",\"version\":1,\"kdf\":\"PBKDF2-SHA256\",\"runden\":" + RUNDEN
                + ",\"erstellt\":\"" + new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.ROOT).format(new Date())
                + "\",\"salz\":\"" + b64(salz) + "\",\"iv\":\"" + b64(iv) + "\",\"daten\":\"" + b64(daten) + "\"}";
    }

    /** Liefert den Inhalt oder null bei falschem Passwort / kaputter Datei. */
    static String entschluesseln(String datei, String passwort) {
        try {
            int runden = Integer.parseInt(feld(datei, "runden"));
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.DECRYPT_MODE, schluessel(passwort, unb64(feld(datei, "salz")), runden),
                    new GCMParameterSpec(128, unb64(feld(datei, "iv"))));
            return new String(c.doFinal(unb64(feld(datei, "daten"))), StandardCharsets.UTF_8);
        } catch (Exception e) {
            return null;
        }
    }

    /** Schreibt eine neue Sicherung in den gewaehlten Ordner und loescht alte
     *  ueber die letzten BEHALTEN hinaus. Gibt den Dateinamen zurueck. */
    static String inOrdner(ContentResolver r, Uri baum, String inhalt) throws Exception {
        Uri ordner = DocumentsContract.buildDocumentUriUsingTree(baum, DocumentsContract.getTreeDocumentId(baum));
        String name = PRAEFIX + new SimpleDateFormat("yyyy-MM-dd_HH-mm", Locale.ROOT).format(new Date()) + ".dksafe";
        Uri neu = DocumentsContract.createDocument(r, ordner, "application/octet-stream", name);
        if (neu == null) throw new Exception("Datei nicht anlegbar");
        try (OutputStream o = r.openOutputStream(neu)) {
            o.write(inhalt.getBytes(StandardCharsets.UTF_8));
        }
        aufraeumen(r, baum);
        return name;
    }

    private static void aufraeumen(ContentResolver r, Uri baum) {
        Uri kinder = DocumentsContract.buildChildDocumentsUriUsingTree(baum, DocumentsContract.getTreeDocumentId(baum));
        List<String[]> alte = new ArrayList<>();
        try (Cursor c = r.query(kinder, new String[]{DocumentsContract.Document.COLUMN_DOCUMENT_ID,
                DocumentsContract.Document.COLUMN_DISPLAY_NAME}, null, null, null)) {
            while (c != null && c.moveToNext()) {
                String n = c.getString(1);
                if (n != null && n.startsWith(PRAEFIX) && n.endsWith(".dksafe")) alte.add(new String[]{n, c.getString(0)});
            }
        } catch (Exception ignored) {
            return;
        }
        if (alte.size() <= BEHALTEN) return;
        // Namen enthalten Datum und Uhrzeit - alphabetisch = zeitlich
        Collections.sort(alte, new java.util.Comparator<String[]>() {
            @Override
            public int compare(String[] a, String[] b) { return a[0].compareTo(b[0]); }
        });
        for (int i = 0; i < alte.size() - BEHALTEN; i++) {
            try {
                DocumentsContract.deleteDocument(r, DocumentsContract.buildDocumentUriUsingTree(baum, alte.get(i)[1]));
            } catch (Exception ignored) { }
        }
    }

    private static SecretKeySpec schluessel(String passwort, byte[] salz, int runden) throws Exception {
        PBEKeySpec s = new PBEKeySpec(passwort.toCharArray(), salz, runden, 256);
        return new SecretKeySpec(SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(s).getEncoded(), "AES");
    }

    private static String feld(String json, String name) {
        int i = json.indexOf("\"" + name + "\":");
        if (i < 0) throw new IllegalArgumentException(name);
        int a = i + name.length() + 3;
        if (json.charAt(a) == '"') return json.substring(a + 1, json.indexOf('"', a + 1));
        int e = a;
        while (e < json.length() && Character.isDigit(json.charAt(e))) e++;
        return json.substring(a, e);
    }

    private static String b64(byte[] b) { return Base64.encodeToString(b, Base64.NO_WRAP); }

    private static byte[] unb64(String s) { return Base64.decode(s, Base64.NO_WRAP); }
}
