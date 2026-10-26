package ir.frfro.app;

import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.location.LocationManager;
import android.provider.Settings;
import androidx.core.location.LocationManagerCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * The map's «همین‌جا که هستم» (app/shared/lib/deviceLocation.js on the site): with the phone's
 * location switched off the WebView just waits until it times out, so the site asks first.
 *  - status(): { enabled } whether the phone's location is on;
 *  - openSettings(): opens the phone's location settings so the person can switch it on. The site
 *    looks again when the app comes back to the front.
 */
@CapacitorPlugin(name = "DeviceLocation")
public class DeviceLocationPlugin extends Plugin {

    @PluginMethod
    public void status(PluginCall call) {
        LocationManager manager = (LocationManager) getContext().getSystemService(Context.LOCATION_SERVICE);
        JSObject result = new JSObject();
        result.put("enabled", manager != null && LocationManagerCompat.isLocationEnabled(manager));
        call.resolve(result);
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(intent);
            call.resolve();
        } catch (ActivityNotFoundException e) {
            call.reject("No location settings", "UNAVAILABLE");
        }
    }
}
