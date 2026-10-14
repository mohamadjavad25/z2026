package ir.frfro.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.ContactsContract.CommonDataKinds.Phone;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * «مخاطبین» on the customers page: opens the phone's own contact list (the web Contact Picker API
 * does not exist in the WebView). The system picker hands back only the one number the person
 * taps, so no READ_CONTACTS permission is needed and frfro never sees the rest of the address book.
 *
 * From the site: Capacitor.nativePromise("ContactPicker", "pick") -> { name, phones: [number] },
 * or { cancelled: true } when nothing was picked.
 */
@CapacitorPlugin(name = "ContactPicker")
public class ContactPickerPlugin extends Plugin {

    @PluginMethod
    public void pick(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_PICK, Phone.CONTENT_URI);
        try {
            startActivityForResult(call, intent, "onPicked");
        } catch (ActivityNotFoundException e) {
            call.reject("No contacts app", "UNAVAILABLE");
        }
    }

    @ActivityCallback
    private void onPicked(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent data = result.getData();
        Uri uri = data == null ? null : data.getData();
        if (result.getResultCode() != Activity.RESULT_OK || uri == null) {
            JSObject cancelled = new JSObject();
            cancelled.put("cancelled", true);
            call.resolve(cancelled);
            return;
        }
        String[] columns = { Phone.DISPLAY_NAME, Phone.NUMBER };
        try (Cursor cursor = getContext().getContentResolver().query(uri, columns, null, null, null)) {
            if (cursor == null || !cursor.moveToFirst()) {
                call.reject("Contact not readable");
                return;
            }
            String name = cursor.getString(0);
            String number = cursor.getString(1);
            JSArray phones = new JSArray();
            if (number != null && !number.trim().isEmpty()) phones.put(number.trim());
            JSObject contact = new JSObject();
            contact.put("name", name == null ? "" : name.trim());
            contact.put("phones", phones);
            call.resolve(contact);
        } catch (SecurityException e) {
            call.reject("Contact not readable");
        }
    }
}
