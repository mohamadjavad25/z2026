package ir.frfro.app;

import com.getcapacitor.BridgeActivity;

/** «فرفرو مدیر» only: the wallpaper and "always on" switches (AdminDevicePlugin). */
final class FlavorPlugins {
    private FlavorPlugins() {}

    static void register(BridgeActivity activity) {
        activity.registerPlugin(AdminDevicePlugin.class);
    }
}
