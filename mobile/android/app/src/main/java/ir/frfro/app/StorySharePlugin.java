package ir.frfro.app;

import android.Manifest;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;

/**
 * The ready story's two buttons (app/shared/lib/storyShare.js on the site): the WebView has neither
 * navigator.share for files nor downloads, so the app does both.
 *  - share({ data, link }): copies the link, then opens the phone's share list with the picture;
 *    Instagram's «استوری» there puts it straight into the story editor;
 *  - save({ data, link }): saves the picture to the gallery (Pictures/frfro) and copies the link.
 * data is the PNG as base64 without the "data:" prefix. Both resolve { copied } (the link reached
 * the clipboard); save rejects with "DENIED" when Android 9 or older refused the storage permission.
 */
@CapacitorPlugin(
    name = "StoryShare",
    permissions = {
        @Permission(alias = "storage", strings = { Manifest.permission.WRITE_EXTERNAL_STORAGE })
    }
)
public class StorySharePlugin extends Plugin {

    private static final String FOLDER = "frfro";

    @PluginMethod
    public void share(PluginCall call) {
        byte[] png = decode(call);
        if (png == null) return;
        try {
            File dir = new File(getContext().getCacheDir(), "story");
            if (!dir.exists() && !dir.mkdirs()) throw new IOException("No cache folder");
            File file = new File(dir, "frfro-story.png");
            try (FileOutputStream out = new FileOutputStream(file)) {
                out.write(png);
            }
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);
            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType("image/png");
            send.putExtra(Intent.EXTRA_STREAM, uri);
            // The ClipData carries the read grant through the chooser to the app the person picks.
            send.setClipData(ClipData.newRawUri("", uri));
            send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            boolean copied = copyLink(call);
            Intent chooser = Intent.createChooser(send, null);
            chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().startActivity(chooser);
            call.resolve(copied(copied));
        } catch (IOException | IllegalArgumentException | ActivityNotFoundException e) {
            call.reject("Not shared", "UNAVAILABLE");
        }
    }

    @PluginMethod
    public void save(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q && getPermissionState("storage") != PermissionState.GRANTED) {
            requestPermissionForAlias("storage", call, "onStorage");
            return;
        }
        saveNow(call);
    }

    @PermissionCallback
    private void onStorage(PluginCall call) {
        if (getPermissionState("storage") == PermissionState.GRANTED) saveNow(call);
        else call.reject("Storage refused", "DENIED");
    }

    private void saveNow(PluginCall call) {
        byte[] png = decode(call);
        if (png == null) return;
        String name = "frfro-story-" + System.currentTimeMillis() + ".png";
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentResolver resolver = getContext().getContentResolver();
                ContentValues values = new ContentValues();
                values.put(MediaStore.Images.Media.DISPLAY_NAME, name);
                values.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
                values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/" + FOLDER);
                values.put(MediaStore.Images.Media.IS_PENDING, 1);
                Uri uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
                if (uri == null) throw new IOException("No gallery");
                try (OutputStream out = resolver.openOutputStream(uri)) {
                    if (out == null) throw new IOException("No gallery");
                    out.write(png);
                } catch (IOException e) {
                    resolver.delete(uri, null, null);
                    throw e;
                }
                values.clear();
                values.put(MediaStore.Images.Media.IS_PENDING, 0);
                resolver.update(uri, values, null, null);
            } else {
                File dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES), FOLDER);
                if (!dir.exists() && !dir.mkdirs()) throw new IOException("No gallery folder");
                File file = new File(dir, name);
                try (FileOutputStream out = new FileOutputStream(file)) {
                    out.write(png);
                }
                MediaScannerConnection.scanFile(getContext(), new String[] { file.getAbsolutePath() }, new String[] { "image/png" }, null);
            }
            call.resolve(copied(copyLink(call)));
        } catch (IOException | SecurityException e) {
            call.reject("Not saved", "UNAVAILABLE");
        }
    }

    private byte[] decode(PluginCall call) {
        String data = call.getString("data");
        if (data == null || data.isEmpty()) {
            call.reject("No picture");
            return null;
        }
        try {
            return Base64.decode(data, Base64.DEFAULT);
        } catch (IllegalArgumentException e) {
            call.reject("Bad picture");
            return null;
        }
    }

    private boolean copyLink(PluginCall call) {
        String link = call.getString("link");
        if (link == null || link.isEmpty()) return false;
        ClipboardManager clipboard = (ClipboardManager) getContext().getSystemService(Context.CLIPBOARD_SERVICE);
        if (clipboard == null) return false;
        clipboard.setPrimaryClip(ClipData.newPlainText("frfro", link));
        return true;
    }

    private static JSObject copied(boolean copied) {
        JSObject result = new JSObject();
        result.put("copied", copied);
        return result;
    }
}
