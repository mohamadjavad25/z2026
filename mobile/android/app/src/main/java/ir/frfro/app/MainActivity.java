package ir.frfro.app;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.webkit.WebView;
import android.widget.Toast;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

public class MainActivity extends BridgeActivity {
    private static final long FIRST_LOAD_TIMEOUT_MS = 15000;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private volatile boolean firstPageLoaded = false;
    private final Runnable showOfflineIfStuck = () -> {
        if (firstPageLoaded || getBridge() == null) return;
        WebView web = getBridge().getWebView();
        if (web != null) web.loadUrl("file:///android_asset/public/offline.html" + (vpnOn() ? "?vpn=1" : ""));
    };

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // App-local plugins must be registered before the bridge starts.
        registerPlugin(ContactPickerPlugin.class);
        registerPlugin(FrfroPushPlugin.class);
        registerPlugin(DeviceLocationPlugin.class);
        registerPlugin(StorySaverPlugin.class);
        registerPlugin(StorySharePlugin.class);
        super.onCreate(savedInstanceState);
        // frfro is served from Iran, so a VPN makes it slow or keeps it from opening (owner's report 2026-10-30):
        // say so once at start, before the person waits.
        if (vpnOn()) Toast.makeText(this, "فیلترشکنت روشنه. فرفرو بدون فیلترشکن سریع‌تر باز می‌شه.", Toast.LENGTH_LONG).show();
        // A connection that never answers (a VPN or a filtered network) raises no load error, so Capacitor's errorPath
        // never shows and the visitor stares at a dark blank screen. If the first page has not finished loading after
        // 15 seconds, show the "try again" page instead (2026-10-30), naming the VPN when one is on. Only the first
        // load is watched: a later slow page inside a working app is left alone.
        if (getBridge() != null) {
            getBridge().addWebViewListener(new WebViewListener() {
                @Override
                public void onPageLoaded(WebView webView) {
                    firstPageLoaded = true;
                }
            });
        }
        handler.postDelayed(showOfflineIfStuck, FIRST_LOAD_TIMEOUT_MS);
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacks(showOfflineIfStuck);
        super.onDestroy();
    }

    private boolean vpnOn() {
        try {
            ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm == null) return false;
            Network network = cm.getActiveNetwork();
            NetworkCapabilities caps = network == null ? null : cm.getNetworkCapabilities(network);
            return caps != null && caps.hasTransport(NetworkCapabilities.TRANSPORT_VPN);
        } catch (SecurityException e) {
            return false;
        }
    }
}
