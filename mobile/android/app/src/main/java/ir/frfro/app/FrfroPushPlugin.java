package ir.frfro.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Helps @capacitor/push-notifications (app/shared/lib/nativePush.js on the site):
 *  - creates the "frfro" channel at every start, high importance so a new booking request sounds
 *    and pops up like a message (the server sends to this channel, app/lib/fcm.js);
 *  - status(): { ready } says whether this build has Firebase (google-services.json). Without it
 *    PushNotifications.register() would crash the app, so the site only registers when ready.
 */
@CapacitorPlugin(name = "FrfroPush")
public class FrfroPushPlugin extends Plugin {

    @Override
    public void load() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        Context context = getContext();
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null) return;
        NotificationChannel channel = new NotificationChannel(
            context.getString(R.string.frfro_channel_id),
            context.getString(R.string.frfro_channel_name),
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription(context.getString(R.string.frfro_channel_description));
        channel.enableVibration(true);
        channel.enableLights(true);
        channel.setLightColor(context.getColor(R.color.frfro_notification));
        channel.setSound(
            RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),
            new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION).build()
        );
        manager.createNotificationChannel(channel);
    }

    @PluginMethod
    public void status(PluginCall call) {
        Context context = getContext();
        boolean ready = context.getResources().getIdentifier("google_app_id", "string", context.getPackageName()) != 0;
        JSObject result = new JSObject();
        result.put("ready", ready);
        call.resolve(result);
    }
}
