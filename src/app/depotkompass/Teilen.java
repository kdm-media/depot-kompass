package app.depotkompass;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;

import java.io.File;
import java.io.FileNotFoundException;

/**
 * Teilen aus der App (ab 0.47): gibt genau EINE gerade erzeugte Datei aus dem Cache-Ordner "teilen"
 * an die App weiter, die der Nutzer im Teilen-Menue waehlt - nur lesend und nur mit erteilter Freigabe
 * (FLAG_GRANT_READ_URI_PERMISSION). Eigener kleiner Ersatz fuer FileProvider (keine Fremdbibliothek).
 */
public class Teilen extends ContentProvider {
    static final String AUTORITAET = "app.depotkompass.teilen";

    static File ordner(android.content.Context c) {
        File o = new File(c.getCacheDir(), "teilen");
        o.mkdirs();
        return o;
    }

    private File datei(Uri uri) throws FileNotFoundException {
        String name = uri.getLastPathSegment();
        if (name == null || !name.matches("[A-Za-z0-9._ -]{1,120}") || name.contains("..")) throw new FileNotFoundException();
        File f = new File(ordner(getContext()), name);
        if (!f.isFile()) throw new FileNotFoundException();
        return f;
    }

    @Override public boolean onCreate() { return true; }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        if (!"r".equals(mode)) throw new FileNotFoundException("nur lesen");
        return ParcelFileDescriptor.open(datei(uri), ParcelFileDescriptor.MODE_READ_ONLY);
    }

    @Override
    public String getType(Uri uri) {
        String n = String.valueOf(uri.getLastPathSegment()).toLowerCase();
        if (n.endsWith(".csv")) return "text/csv";
        if (n.endsWith(".zip")) return "application/zip";
        if (n.endsWith(".pdf")) return "application/pdf";
        return "application/octet-stream";
    }

    @Override
    public Cursor query(Uri uri, String[] spalten, String auswahl, String[] werte, String sortierung) {
        File f;
        try { f = datei(uri); } catch (FileNotFoundException e) { return null; }
        MatrixCursor c = new MatrixCursor(new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE});
        c.addRow(new Object[]{f.getName(), f.length()});
        return c;
    }

    @Override public Uri insert(Uri uri, ContentValues v) { return null; }
    @Override public int delete(Uri uri, String a, String[] w) { return 0; }
    @Override public int update(Uri uri, ContentValues v, String a, String[] w) { return 0; }
}
