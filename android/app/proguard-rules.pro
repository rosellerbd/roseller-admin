# ============================================================
# Capacitor
# ============================================================
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keep class * extends com.getcapacitor.Plugin { *; }
-keepclassmembers class * {
    @com.getcapacitor.PluginMethod public *;
}

# ============================================================
# Google Auth plugin (codetrix)
# ============================================================
-keep class com.codetrixstudio.capacitor.GoogleAuth.** { *; }

# ============================================================
# Cordova plugins
# ============================================================
-keep class org.apache.cordova.** { *; }

# ============================================================
# WebView bridge
# ============================================================
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# ============================================================
# Firebase (auth only — App Distribution removed)
# ============================================================
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }

# ============================================================
# Don't warn about reflection-heavy libs
# ============================================================
-dontwarn com.getcapacitor.**
-dontwarn com.codetrixstudio.**
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**
-dontwarn org.apache.cordova.**