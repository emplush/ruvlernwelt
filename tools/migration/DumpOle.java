// Schreibt die OLE-Objekte der Spalte ProfilBild als ole/<AccessID>.bin (Aufruf: java DumpOle <datei.accdb>).
import com.healthmarketscience.jackcess.*;
import java.io.*;
public class DumpOle {
  public static void main(String[] a) throws Exception {
    Database db = DatabaseBuilder.open(new File(a.length > 0 ? a[0] : "Uploads/Lernwelt_Test.accdb"));
    for (Row r : db.getTable("Lernwelt")) {
      Object id = r.get("ID"); byte[] b = (byte[]) r.get("ProfilBild");
      if (b == null) continue;
      new File("ole").mkdirs();
      try (FileOutputStream f = new FileOutputStream("ole/" + ((Double)id).intValue() + ".bin")) { f.write(b); }
    }
    db.close();
  }
}
