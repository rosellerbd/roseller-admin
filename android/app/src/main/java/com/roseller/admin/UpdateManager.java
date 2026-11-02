package com.roseller.admin;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;

public class UpdateManager {
    private static final String TAG = "UpdateManager";
    private static final String VERSION_URL =
        "https://roseller-cdn.rainfowbd-dev.workers.dev/admin/version.json";

    public static void checkForUpdate(Activity activity) {
        new Thread(() -> {
            try {
                URL url = new URL(VERSION_URL);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("GET");
                conn.setConnectTimeout(5000);
                conn.setReadTimeout(5000);
                conn.setRequestProperty("Cache-Control", "no-cache");

                int status = conn.getResponseCode();
                if (status != 200) {
                    Log.d(TAG, "version.json fetch failed: " + status);
                    return;
                }

                StringBuilder sb = new StringBuilder();
                try (BufferedReader br = new BufferedReader(new InputStreamReader(conn.getInputStream()))) {
                    String line;
                    while ((line = br.readLine()) != null) sb.append(line);
                }
                conn.disconnect();

                JSONObject json = new JSONObject(sb.toString());
                int remoteCode   = json.optInt("versionCode", 0);
                String remoteName = json.optString("versionName", "");
                String apkUrl     = json.optString("apkUrl", "");
                String notes      = json.optString("notes", "");

                PackageInfo pi = activity.getPackageManager()
                    .getPackageInfo(activity.getPackageName(), 0);
                int localCode = pi.versionCode;

                Log.d(TAG, "local=" + localCode + " remote=" + remoteCode);

                if (remoteCode <= localCode) return;
                if (apkUrl.isEmpty()) return;

                new Handler(Looper.getMainLooper()).post(() ->
                    showDialog(activity, remoteName, notes, apkUrl)
                );
            } catch (Exception e) {
                Log.d(TAG, "Update check error: " + e.getMessage());
            }
        }).start();
    }

    private static void showDialog(Activity activity, String newVersion,
                                   String notes, String apkUrl) {
        try {
            String message = "A new version (" + newVersion + ") is available.";
            if (notes != null && !notes.isEmpty()) {
                message += "\n\n" + notes;
            }

            new AlertDialog.Builder(activity)
                .setTitle("Update available")
                .setMessage(message)
                .setPositiveButton("Update", (dialog, which) -> {
                    try {
                        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(apkUrl));
                        activity.startActivity(i);
                    } catch (Exception e) {
                        Log.d(TAG, "Open URL failed: " + e.getMessage());
                    }
                })
                .setNegativeButton("Later", null)
                .setCancelable(true)
                .show();
        } catch (Exception e) {
            Log.d(TAG, "Dialog failed: " + e.getMessage());
        }
    }
}