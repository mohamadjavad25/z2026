package ir.frfro.app;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // App-local plugins must be registered before the bridge starts.
        registerPlugin(ContactPickerPlugin.class);
        registerPlugin(FrfroPushPlugin.class);
        registerPlugin(DeviceLocationPlugin.class);
        registerPlugin(StorySaverPlugin.class);
        registerPlugin(StorySharePlugin.class);
        super.onCreate(savedInstanceState);
        // A connection that never answers (a VPN or a filtered network) raises no load error, so Capacitor's errorPath
        // never shows and the visitor stares at a dark blank screen. After 15 seconds without a finished load, show
        // the "try again" page instead (2026-10-30).
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            if (getBridge() == null) return;
            WebView web = getBridge().getWebView();
            if (web != null && web.getProgress() < 100) web.loadUrl("file:///android_asset/public/offline.html");
        }, 15000);
    }
}
