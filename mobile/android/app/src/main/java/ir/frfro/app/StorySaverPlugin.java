package ir.frfro.app;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.OutputStream;

/**
 * «ذخیره و کپی لینک» on the ready stories (InstagramStorySheet on the site): the WebView ignores
 * download links, so the picture is written straight into the gallery (Pictures/frfro). Android 10
 * and newer need no permission for this; older phones are told to use the browser instead.
 *
 * From the site: Capacitor.nativePromise("StorySaver", "save", { data: base64Png, name })
 * -> { saved: true }, or rejected with code "OLD_ANDROID" / "FAILED".
 */
@CapacitorPlugin(name = "StorySaver")
public class StorySaverPlugin extends Plugin {

    @PluginMethod
    public void save(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            call.reject("Android 9 or older", "OLD_ANDROID");
            return;
        }
        String data = call.getString("data", "");
        String name = call.getString("name", "frfro-story");
        if (data == null || data.isEmpty()) {
            call.reject("No picture", "FAILED");
            return;
        }
        byte[] bytes;
        try {
            bytes = Base64.decode(data, Base64.DEFAULT);
        } catch (IllegalArgumentException e) {
            call.reject("Bad picture", "FAILED");
            return;
        }

        ContentResolver resolver = getContext().getContentResolver();
        ContentValues values = new ContentValues();
        values.put(MediaStore.Images.Media.DISPLAY_NAME, name + "-" + System.currentTimeMillis() + ".png");
        values.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
        values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/frfro");
        values.put(MediaStore.Images.Media.IS_PENDING, 1);
        Uri uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
        if (uri == null) {
            call.reject("Gallery refused", "FAILED");
            return;
        }
        try (OutputStream out = resolver.openOutputStream(uri)) {
            if (out == null) throw new java.io.IOException("No stream");
            out.write(bytes);
        } catch (Exception e) {
            resolver.delete(uri, null, null);
            call.reject("Not written", "FAILED");
            return;
        }
        values.clear();
        values.put(MediaStore.Images.Media.IS_PENDING, 0);
        resolver.update(uri, values, null, null);

        JSObject result = new JSObject();
        result.put("saved", true);
        call.resolve(result);
    }
}
