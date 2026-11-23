package app.depotkompass;

import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.security.SecureRandom;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;

/**
 * App-Daten verschluesselt ablegen - PIN weg = Daten weg (Vorgabe 07.11.2026).
 *
 * Ein zufaelliger Hauptschluessel verschluesselt depot.enc (AES-256-GCM).
 * Er liegt nur "eingepackt" auf dem Geraet:
 *   - mit der PIN  (PBKDF2-SHA256, 200 000 Runden) -> "pinHuelle"
 *   - optional mit dem Fingerabdruck (Keystore-Schluessel, der nur nach
 *     Biometrie-Freigabe arbeitet und bei neuen Fingerabdruecken ungueltig wird) -> "bioHuelle"
 * Eine falsche PIN laesst GCM scheitern; es gibt keinen Hash zum Vergleichen
 * und keine Hintertuer. Entsperrt liegt der Hauptschluessel nur im Arbeitsspeicher.
 *
 * Seit 0.16 liegt um die PIN-Huelle noch ein Geraeteschluessel aus dem
 * Keystore (StrongBox, wenn vorhanden). Eine kopierte Datei laesst sich so
 * nicht auf einem fremden Rechner durchprobieren - jeder PIN-Versuch muss
 * auf diesem Handy laufen. API-Schluessel und Sicherungs-Passwort werden mit
 * dem Hauptschluessel verpackt (textEinpacken) und sind gesperrt unbrauchbar.
 */
final class Tresor {
    static final String BIO_ALIAS = "dk-bio", GERAET_ALIAS = "dk-geraet";
    private static final int RUNDEN = 200000;
    private static byte[] haupt;                      // nur solange entsperrt

    private Tresor() { }

    static boolean aktiv(SharedPreferences e) { return e.getString("pinHuelle", null) != null; }

    static boolean offen() { return haupt != null; }

    static void schliessen() {
        if (haupt != null) java.util.Arrays.fill(haupt, (byte) 0);
        haupt = null;
    }

    /** Neue PIN. Ohne Tresor: Hauptschluessel erzeugen und vorhandene Klartext-
     *  Daten verschluesseln. Mit offenem Tresor: nur neu einpacken (PIN aendern). */
    static void pinSetzen(SharedPreferences e, File klar, File geheim, String pin) throws Exception {
        if (aktiv(e) && !offen()) throw new IllegalStateException("gesperrt");
        if (!aktiv(e)) {
            haupt = new byte[32];
            new SecureRandom().nextBytes(haupt);
            if (klar.isFile()) {
                schreiben(geheim, lesenText(klar));
                // Klartext ueberschreiben, dann loeschen (RandomAccessFile: kuerzt nicht
                // vorher auf 0 wie FileOutputStream)
                int laenge = (int) klar.length();
                try (java.io.RandomAccessFile o = new java.io.RandomAccessFile(klar, "rws")) {
                    o.seek(0);
                    o.write(new byte[laenge]);
                }
                klar.delete();
                new File(klar.getPath() + ".neu").delete();
            }
        }
        pinEinpacken(e, pin);
    }

    private static void pinEinpacken(SharedPreferences e, String pin) throws Exception {
        byte[] salz = zufall(16);
        String innen = einpackenRoh(pinSchluessel(pin, salz), haupt);
        e.edit().putString("pinHuelle", "v2:" + b64(salz) + ":"
                + einpackenRoh(geraetSchluessel(), innen.getBytes(StandardCharsets.UTF_8))).apply();
    }

    /** true = PIN richtig, Tresor offen. */
    static boolean mitPinOeffnen(SharedPreferences e, String pin) {
        String h = e.getString("pinHuelle", "");
        try {
            if (h.startsWith("v2:")) {
                String[] t = h.split(":", 3);
                String innen = new String(auspackenRoh(geraetSchluessel(), t[2]), StandardCharsets.UTF_8);
                haupt = auspackenRoh(pinSchluessel(pin, unb64(t[1])), innen);
            } else {
                // Huelle aus 0.15 ohne Geraeteschluessel: oeffnen und gleich neu einpacken
                String[] t = h.split(":", 2);
                if (t.length < 2) return false;
                haupt = auspackenRoh(pinSchluessel(pin, unb64(t[0])), t[1]);
                pinEinpacken(e, pin);
            }
            return true;
        } catch (Exception ex) {
            return false;
        }
    }

    /** Kleine Geheimnisse (API-Schluessel, Sicherungs-Passwort) mit dem Hauptschluessel. */
    static String textEinpacken(String klar) throws Exception {
        if (!offen()) throw new IllegalStateException("gesperrt");
        return einpackenRoh(new SecretKeySpec(haupt, "AES"), klar.getBytes(StandardCharsets.UTF_8));
    }

    static String textAuspacken(String geheim) throws Exception {
        if (!offen()) throw new IllegalStateException("gesperrt");
        return new String(auspackenRoh(new SecretKeySpec(haupt, "AES"), geheim), StandardCharsets.UTF_8);
    }

    /** Sperre ganz aus: Daten zurueck in Klartext, alle Huellen weg. */
    static void aufheben(SharedPreferences e, File klar, File geheim) throws Exception {
        if (!offen()) throw new IllegalStateException("gesperrt");
        if (geheim.isFile()) {
            try (OutputStream o = new FileOutputStream(klar)) { o.write(lesen(geheim).getBytes(StandardCharsets.UTF_8)); }
            geheim.delete();
        }
        e.edit().remove("pinHuelle").remove("bioHuelle").putBoolean("bio", false).apply();
        bioSchluesselLoeschen();
        aliasLoeschen(GERAET_ALIAS);
        schliessen();
    }

    /** Rohdaten (Originale von Importen) mit dem Hauptschluessel - Ergebnis als Text (IV + Daten). */
    static String datenEinpacken(byte[] daten) throws Exception {
        if (!offen()) throw new IllegalStateException("gesperrt");
        return einpackenRoh(new SecretKeySpec(haupt, "AES"), daten);
    }

    static byte[] datenAuspacken(String text) throws Exception {
        if (!offen()) throw new IllegalStateException("gesperrt");
        return auspackenRoh(new SecretKeySpec(haupt, "AES"), text);
    }

    // ------------------------------------------------------------ Daten
    static String lesen(File geheim) throws Exception {
        if (!offen()) throw new IllegalStateException("gesperrt");
        return new String(auspackenRoh(new SecretKeySpec(haupt, "AES"), lesenText(geheim)), StandardCharsets.UTF_8);
    }

    static void schreiben(File geheim, String inhalt) throws Exception {
        if (!offen()) throw new IllegalStateException("gesperrt");
        File neu = new File(geheim.getPath() + ".neu");
        try (OutputStream o = new FileOutputStream(neu)) {
            o.write(einpackenRoh(new SecretKeySpec(haupt, "AES"), inhalt.getBytes(StandardCharsets.UTF_8)).getBytes(StandardCharsets.UTF_8));
        }
        if (!neu.renameTo(geheim)) throw new Exception("Umbenennen fehlgeschlagen");
    }

    // ------------------------------------------------------------ Fingerabdruck
    /** Cipher zum Einpacken - muss per BiometricPrompt freigegeben werden. */
    static Cipher bioCipherEinpacken() throws Exception {
        bioSchluesselLoeschen();
        KeyGenerator g = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        g.init(new KeyGenParameterSpec.Builder(BIO_ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setUserAuthenticationRequired(true)
                .setInvalidatedByBiometricEnrollment(true)
                .build());
        Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
        c.init(Cipher.ENCRYPT_MODE, g.generateKey());
        return c;
    }

    static void bioEinpacken(SharedPreferences e, Cipher freigegeben) throws Exception {
        if (!offen()) throw new IllegalStateException("gesperrt");
        byte[] ct = freigegeben.doFinal(haupt);
        e.edit().putString("bioHuelle", b64(freigegeben.getIV()) + ":" + b64(ct)).putBoolean("bio", true).apply();
    }

    static Cipher bioCipherAuspacken(SharedPreferences e) throws Exception {
        String[] t = e.getString("bioHuelle", "").split(":", 2);
        KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
        ks.load(null);
        Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
        c.init(Cipher.DECRYPT_MODE, (SecretKey) ks.getKey(BIO_ALIAS, null), new GCMParameterSpec(128, unb64(t[0])));
        return c;
    }

    static void mitBioOeffnen(SharedPreferences e, Cipher freigegeben) throws Exception {
        haupt = freigegeben.doFinal(unb64(e.getString("bioHuelle", "").split(":", 2)[1]));
    }

    static void bioSchluesselLoeschen() { aliasLoeschen(BIO_ALIAS); }

    static void aliasLoeschen(String alias) {
        try {
            KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
            ks.load(null);
            if (ks.containsAlias(alias)) ks.deleteEntry(alias);
        } catch (Exception ignored) { }
    }

    // ------------------------------------------------------------ Geraeteschluessel
    /** Bindet die PIN-Huelle an dieses Handy. Ohne Nutzer-Abfrage (die PIN ist
     *  die Abfrage), aber nicht auslesbar - nur auf dem Geraet benutzbar. */
    private static java.security.Key geraetSchluessel() throws Exception {
        KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
        ks.load(null);
        if (ks.containsAlias(GERAET_ALIAS)) return ks.getKey(GERAET_ALIAS, null);
        try {
            return geraetErzeugen(true);
        } catch (Exception ohneStrongBox) {
            return geraetErzeugen(false);
        }
    }

    private static SecretKey geraetErzeugen(boolean strongBox) throws Exception {
        KeyGenParameterSpec.Builder b = new KeyGenParameterSpec.Builder(GERAET_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE);
        if (strongBox && android.os.Build.VERSION.SDK_INT >= 28) b.setIsStrongBoxBacked(true);
        else if (strongBox) throw new Exception("kein StrongBox");
        KeyGenerator g = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        g.init(b.build());
        return g.generateKey();
    }

    // ------------------------------------------------------------ Hilfen
    private static SecretKeySpec pinSchluessel(String pin, byte[] salz) throws Exception {
        PBEKeySpec s = new PBEKeySpec(pin.toCharArray(), salz, RUNDEN, 256);
        return new SecretKeySpec(SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(s).getEncoded(), "AES");
    }

    private static String einpackenRoh(java.security.Key k, byte[] daten) throws Exception {
        Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
        // Keystore-Schluessel waehlen den IV selbst (eigener IV ist dort verboten)
        if (k instanceof SecretKeySpec) c.init(Cipher.ENCRYPT_MODE, k, new GCMParameterSpec(128, zufall(12)));
        else c.init(Cipher.ENCRYPT_MODE, k);
        byte[] ct = c.doFinal(daten);
        return b64(c.getIV()) + ":" + b64(ct);
    }

    private static byte[] auspackenRoh(java.security.Key k, String text) throws Exception {
        String[] t = text.trim().split(":", 2);
        Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
        c.init(Cipher.DECRYPT_MODE, k, new GCMParameterSpec(128, unb64(t[0])));
        return c.doFinal(unb64(t[1]));
    }

    static String lesenText(File f) throws Exception {
        try (InputStream in = new FileInputStream(f)) {
            java.io.ByteArrayOutputStream p = new java.io.ByteArrayOutputStream();
            byte[] b = new byte[8192];
            int n;
            while ((n = in.read(b)) > 0) p.write(b, 0, n);
            return p.toString("UTF-8");
        }
    }

    private static byte[] zufall(int n) { byte[] b = new byte[n]; new SecureRandom().nextBytes(b); return b; }

    private static String b64(byte[] b) { return Base64.encodeToString(b, Base64.NO_WRAP); }

    private static byte[] unb64(String s) { return Base64.decode(s, Base64.NO_WRAP); }
}
