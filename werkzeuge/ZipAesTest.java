package app.depotkompass;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/** Test der AES-ZIP ohne Android: schreibt test.zip (zum Gegenpruefen mit 7-Zip) und liest sie zurueck.
 *  javac -d k src/app/depotkompass/ZipAes.java werkzeuge/ZipAesTest.java && java -cp k app.depotkompass.ZipAesTest test.zip */
public class ZipAesTest {
    public static void main(String[] a) throws Exception {
        List<ZipAes.Eintrag> l = new ArrayList<ZipAes.Eintrag>();
        l.add(new ZipAes.Eintrag("depot-kompass.json", "{\"test\":\"Grüße € ✓\"}".getBytes(StandardCharsets.UTF_8)));
        byte[] gross = new byte[300000];
        new java.util.Random(7).nextBytes(gross);
        l.add(new ZipAes.Eintrag("originale/Trade Republic/2026-11-13_Bild ä.png", gross));
        l.add(new ZipAes.Eintrag("leer.txt", new byte[0]));
        byte[] zip = ZipAes.schreiben(l, "Test-Passwort 123");
        Files.write(Paths.get(a[0]), zip);
        List<ZipAes.Eintrag> z = ZipAes.lesen(zip, "Test-Passwort 123");
        boolean ok = z.size() == 3;
        for (int i = 0; i < 3 && ok; i++) ok = z.get(i).name.equals(l.get(i).name) && Arrays.equals(z.get(i).daten, l.get(i).daten);
        String falsch;
        try { ZipAes.lesen(zip, "falsch"); falsch = "NICHT erkannt"; } catch (Exception e) { falsch = e.getMessage(); }
        zip[zip.length / 2] ^= 1;
        String kaputt;
        try { ZipAes.lesen(zip, "Test-Passwort 123"); kaputt = "NICHT erkannt"; } catch (Exception e) { kaputt = e.getMessage(); }
        System.out.println("rueckwaerts " + (ok ? "OK" : "FEHLER") + " · falsches Passwort: " + falsch + " · Manipulation: " + kaputt + " · Groesse " + zip.length);
    }
}
