package app.depotkompass;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.zip.Deflater;
import java.util.zip.Inflater;

import javax.crypto.Cipher;
import javax.crypto.Mac;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;

/**
 * ZIP mit AES-256-Verschluesselung nach WinZip-AES (AE-2) - laesst sich am PC mit 7-Zip,
 * WinZip, Keka oder macOS-Werkzeugen mit dem Passwort oeffnen (Vorgabe 13.11.2026:
 * "Export als verschluesselte ZIP mit allen Originalen").
 *
 * Je Datei: Salz (16), Passwort-Pruefwert (2), AES-256-CTR (Zaehler little-endian, Start 1),
 * HMAC-SHA1 (10 Byte). Schluessel per PBKDF2-HMAC-SHA1, 1000 Runden (so verlangt es das Format).
 * Inhalt vorher mit Deflate gepackt. Dateinamen in UTF-8 (Flag 0x0800).
 * Kein Android-Code - laeuft auch mit normalem Java (Test: werkzeuge/ZipAesTest.java).
 */
final class ZipAes {
    private ZipAes() { }

    static final class Eintrag {
        final String name;
        final byte[] daten;
        Eintrag(String name, byte[] daten) { this.name = name; this.daten = daten; }
    }

    // ------------------------------------------------------------ Schreiben
    static byte[] schreiben(List<Eintrag> eintraege, String passwort) throws Exception {
        ByteArrayOutputStream aus = new ByteArrayOutputStream();
        ByteArrayOutputStream verz = new ByteArrayOutputStream();
        SecureRandom z = new SecureRandom();
        int[] zeit = dosZeit();
        for (Eintrag e : eintraege) {
            byte[] gepackt = deflate(e.daten);
            byte[] salz = new byte[16];
            z.nextBytes(salz);
            byte[][] k = schluessel(passwort, salz);            // [aes, hmac, pruefwert]
            byte[] verschl = ctr(k[0], gepackt);
            Mac mac = Mac.getInstance("HmacSHA1");
            mac.init(new SecretKeySpec(k[1], "HmacSHA1"));
            byte[] auth = Arrays.copyOf(mac.doFinal(verschl), 10);
            byte[] name = e.name.getBytes(StandardCharsets.UTF_8);
            long groesse = 16 + 2 + verschl.length + 10;
            byte[] extra = aesExtra();
            int lage = aus.size();
            // Lokaler Kopf
            int32(aus, 0x04034b50); int16(aus, 51); int16(aus, 0x0801); int16(aus, 99);
            int16(aus, zeit[0]); int16(aus, zeit[1]); int32(aus, 0);           // CRC bei AE-2 = 0
            int32(aus, (int) groesse); int32(aus, e.daten.length); int16(aus, name.length); int16(aus, extra.length);
            aus.write(name); aus.write(extra);
            aus.write(salz); aus.write(k[2]); aus.write(verschl); aus.write(auth);
            // Zentralverzeichnis
            int32(verz, 0x02014b50); int16(verz, 51); int16(verz, 51); int16(verz, 0x0801); int16(verz, 99);
            int16(verz, zeit[0]); int16(verz, zeit[1]); int32(verz, 0);
            int32(verz, (int) groesse); int32(verz, e.daten.length); int16(verz, name.length); int16(verz, extra.length);
            int16(verz, 0); int16(verz, 0); int16(verz, 0); int32(verz, 0); int32(verz, lage);
            verz.write(name); verz.write(extra);
        }
        int start = aus.size();
        byte[] v = verz.toByteArray();
        aus.write(v);
        int32(aus, 0x06054b50); int16(aus, 0); int16(aus, 0); int16(aus, eintraege.size()); int16(aus, eintraege.size());
        int32(aus, v.length); int32(aus, start); int16(aus, 0);
        return aus.toByteArray();
    }

    // ------------------------------------------------------------ Lesen (nur eigene Dateien: Groessen im lokalen Kopf)
    /** Liest alle Eintraege; wirft bei falschem Passwort "passwort" bzw. bei Manipulation "beschaedigt". */
    static List<Eintrag> lesen(byte[] zip, String passwort) throws Exception {
        List<Eintrag> l = new ArrayList<Eintrag>();
        int p = 0;
        while (p + 30 <= zip.length && i32(zip, p) == 0x04034b50) {
            int flags = i16(zip, p + 6), methode = i16(zip, p + 8);
            int gr = i32(zip, p + 18), roh = i32(zip, p + 22), nl = i16(zip, p + 26), xl = i16(zip, p + 28);
            String name = new String(zip, p + 30, nl, StandardCharsets.UTF_8);
            int d = p + 30 + nl + xl;
            if ((flags & 1) == 0 || methode != 99) throw new Exception("keine verschluesselte Depot-Kompass-ZIP");
            byte[] salz = Arrays.copyOfRange(zip, d, d + 16);
            byte[][] k = schluessel(passwort, salz);
            if (zip[d + 16] != k[2][0] || zip[d + 17] != k[2][1]) throw new Exception("passwort");
            byte[] verschl = Arrays.copyOfRange(zip, d + 18, d + gr - 10);
            Mac mac = Mac.getInstance("HmacSHA1");
            mac.init(new SecretKeySpec(k[1], "HmacSHA1"));
            if (!Arrays.equals(Arrays.copyOf(mac.doFinal(verschl), 10), Arrays.copyOfRange(zip, d + gr - 10, d + gr))) throw new Exception("beschaedigt");
            byte[] daten = inflate(ctr(k[0], verschl), roh);
            l.add(new Eintrag(name, daten));
            p = d + gr;
        }
        return l;
    }

    // ------------------------------------------------------------ Bausteine
    private static byte[][] schluessel(String passwort, byte[] salz) throws Exception {
        PBEKeySpec s = new PBEKeySpec(passwort.toCharArray(), salz, 1000, (32 + 32 + 2) * 8);
        byte[] k = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA1").generateSecret(s).getEncoded();
        return new byte[][]{Arrays.copyOfRange(k, 0, 32), Arrays.copyOfRange(k, 32, 64), Arrays.copyOfRange(k, 64, 66)};
    }

    /** AES-CTR wie WinZip: Zaehler 16 Byte little-endian, beginnt bei 1. */
    private static byte[] ctr(byte[] schl, byte[] ein) throws Exception {
        Cipher c = Cipher.getInstance("AES/ECB/NoPadding");
        c.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(schl, "AES"));
        byte[] aus = new byte[ein.length], zaehler = new byte[16];
        for (int i = 0; i < ein.length; i += 16) {
            for (int j = 0; j < 16; j++) if (++zaehler[j] != 0) break;
            byte[] block = c.doFinal(zaehler);
            for (int j = 0; j < 16 && i + j < ein.length; j++) aus[i + j] = (byte) (ein[i + j] ^ block[j]);
        }
        return aus;
    }

    private static byte[] deflate(byte[] b) {
        Deflater d = new Deflater(Deflater.DEFAULT_COMPRESSION, true);
        d.setInput(b);
        d.finish();
        ByteArrayOutputStream o = new ByteArrayOutputStream();
        byte[] puffer = new byte[65536];
        while (!d.finished()) o.write(puffer, 0, d.deflate(puffer));
        d.end();
        return o.toByteArray();
    }

    private static byte[] inflate(byte[] b, int roh) throws Exception {
        Inflater i = new Inflater(true);
        i.setInput(b);
        byte[] aus = new byte[roh];
        int n = 0;
        while (n < roh && !i.finished()) { int k = i.inflate(aus, n, roh - n); if (k == 0 && (i.needsInput() || i.needsDictionary())) break; n += k; }
        i.end();
        if (n != roh) throw new Exception("beschaedigt");
        return aus;
    }

    /** Extra-Feld 0x9901: AE-2, "AE", AES-256, eigentliche Methode Deflate (8). */
    private static byte[] aesExtra() {
        return new byte[]{0x01, (byte) 0x99, 7, 0, 2, 0, 'A', 'E', 3, 8, 0};
    }

    private static int[] dosZeit() {
        java.util.Calendar c = java.util.Calendar.getInstance();
        int t = (c.get(java.util.Calendar.HOUR_OF_DAY) << 11) | (c.get(java.util.Calendar.MINUTE) << 5) | (c.get(java.util.Calendar.SECOND) / 2);
        int d = ((c.get(java.util.Calendar.YEAR) - 1980) << 9) | ((c.get(java.util.Calendar.MONTH) + 1) << 5) | c.get(java.util.Calendar.DAY_OF_MONTH);
        return new int[]{t, d};
    }

    private static void int16(ByteArrayOutputStream o, int v) { o.write(v & 0xff); o.write((v >>> 8) & 0xff); }
    private static void int32(ByteArrayOutputStream o, int v) { int16(o, v & 0xffff); int16(o, (v >>> 16) & 0xffff); }
    private static int i16(byte[] b, int p) { return (b[p] & 0xff) | ((b[p + 1] & 0xff) << 8); }
    private static int i32(byte[] b, int p) { return i16(b, p) | (i16(b, p + 2) << 16); }
}
