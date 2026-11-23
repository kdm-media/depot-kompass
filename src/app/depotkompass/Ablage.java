package app.depotkompass;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.HashMap;
import java.util.Map;

/**
 * Originale aller Importe (PDF, CSV, Screenshots) im App-Speicher (ab 0.44, Vorgabe 13.11.2026:
 * "alle hochgeladenen Dokumente im Original mit exportieren").
 * Datei je Original: erstes Byte 'K' = Klartext (ohne App-PIN) oder 'T' = mit dem Hauptschluessel
 * des Tresors verschluesselt (mit App-PIN). Beim Ein-/Ausschalten der PIN wird umgeschluesselt.
 * Nur im eigenen App-Speicher (getFilesDir), nicht im geteilten Speicher.
 */
final class Ablage {
    private Ablage() { }

    static File ordner(File basis) {
        File o = new File(basis, "originale");
        if (!o.isDirectory()) o.mkdirs();
        return o;
    }

    static boolean gueltig(String id) { return id != null && id.matches("[a-z0-9]{8,40}"); }

    static String neueId() {
        byte[] b = new byte[10];
        new SecureRandom().nextBytes(b);
        StringBuilder s = new StringBuilder("o");
        for (byte x : b) s.append(String.format("%02x", x & 0xff));
        return s.toString();
    }

    static void schreiben(File basis, String id, byte[] daten, boolean tresor) throws Exception {
        if (!gueltig(id)) throw new Exception("id");
        File neu = new File(ordner(basis), id + ".neu"), ziel = new File(ordner(basis), id);
        try (OutputStream o = new FileOutputStream(neu)) {
            if (tresor) { o.write('T'); o.write(Tresor.datenEinpacken(daten).getBytes(StandardCharsets.UTF_8)); }
            else { o.write('K'); o.write(daten); }
        }
        if (!neu.renameTo(ziel)) throw new Exception("Umbenennen fehlgeschlagen");
    }

    static byte[] lesen(File basis, String id) throws Exception {
        if (!gueltig(id)) throw new Exception("id");
        File f = new File(ordner(basis), id);
        if (!f.isFile()) return null;
        byte[] roh;
        try (InputStream in = new FileInputStream(f)) {
            ByteArrayOutputStream b = new ByteArrayOutputStream();
            byte[] p = new byte[65536];
            for (int n; (n = in.read(p)) > 0; ) b.write(p, 0, n);
            roh = b.toByteArray();
        }
        if (roh.length == 0) return new byte[0];
        byte[] rest = java.util.Arrays.copyOfRange(roh, 1, roh.length);
        return roh[0] == 'T' ? Tresor.datenAuspacken(new String(rest, StandardCharsets.UTF_8)) : rest;
    }

    static void loeschen(File basis, String id) {
        if (gueltig(id)) new File(ordner(basis), id).delete();
    }

    /** Alle Originale lesen (vor dem Ausschalten der PIN, solange der Tresor offen ist). */
    static Map<String, byte[]> alleLesen(File basis) {
        Map<String, byte[]> m = new HashMap<String, byte[]>();
        File[] l = ordner(basis).listFiles();
        if (l != null) for (File f : l) {
            if (!gueltig(f.getName())) continue;
            try { byte[] d = lesen(basis, f.getName()); if (d != null) m.put(f.getName(), d); } catch (Exception ignored) { }
        }
        return m;
    }

    static void alleSchreiben(File basis, Map<String, byte[]> m, boolean tresor) {
        for (Map.Entry<String, byte[]> e : m.entrySet()) {
            try { schreiben(basis, e.getKey(), e.getValue(), tresor); } catch (Exception ignored) { }
        }
    }

    static void allesLoeschen(File basis) {
        File[] l = ordner(basis).listFiles();
        if (l != null) for (File f : l) f.delete();
    }
}
