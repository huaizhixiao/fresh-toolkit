package com.toolkit.app;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.eclipse.paho.client.mqttv3.IMqttDeliveryToken;
import org.eclipse.paho.client.mqttv3.MqttCallback;
import org.eclipse.paho.client.mqttv3.MqttClient;
import org.eclipse.paho.client.mqttv3.MqttConnectOptions;
import org.eclipse.paho.client.mqttv3.MqttException;
import org.eclipse.paho.client.mqttv3.MqttMessage;
import org.eclipse.paho.client.mqttv3.persist.MemoryPersistence;

import java.io.BufferedReader;
import java.io.InputStreamReader;

import android.content.ContentValues;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import android.util.Base64;

import java.io.OutputStream;

public class MainActivity extends Activity {
    private WebView webView;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private ValueCallback<Uri[]> uploadMessage;
    private static final int FILE_CHOOSER_REQUEST_CODE = 100;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        setContentView(webView);

        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setAllowFileAccess(true);
        webView.getSettings().setAllowContentAccess(true);

        WebView.setWebContentsDebuggingEnabled(true);

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView wv, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                if (uploadMessage != null) {
                    uploadMessage.onReceiveValue(null);
                    uploadMessage = null;
                }
                uploadMessage = filePathCallback;
                Intent intent = fileChooserParams.createIntent();
                try {
                    startActivityForResult(intent, FILE_CHOOSER_REQUEST_CODE);
                } catch (Exception e) {
                    uploadMessage.onReceiveValue(null);
                    uploadMessage = null;
                    return false;
                }
                return true;
            }
        });
        webView.setWebViewClient(new WebViewClient());

        webView.addJavascriptInterface(new NativePing(), "NativePing");
        webView.addJavascriptInterface(new NativeMQTT(), "NativeMQTT");
        webView.addJavascriptInterface(new NativeTraceroute(), "NativeTraceroute");
        webView.addJavascriptInterface(new NativeGallery(), "NativeGallery");

        webView.loadUrl("file:///android_asset/www/index.html");
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_CHOOSER_REQUEST_CODE) {
            if (uploadMessage == null) return;
            Uri[] results = null;
            if (resultCode == Activity.RESULT_OK) {
                if (data != null) {
                    String dataString = data.getDataString();
                    if (dataString != null) {
                        results = new Uri[]{Uri.parse(dataString)};
                    } else if (data.getClipData() != null) {
                        int count = data.getClipData().getItemCount();
                        results = new Uri[count];
                        for (int i = 0; i < count; i++) {
                            results[i] = data.getClipData().getItemAt(i).getUri();
                        }
                    }
                }
            }
            uploadMessage.onReceiveValue(results);
            uploadMessage = null;
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    protected void onPause() {
        super.onPause();
        webView.resumeTimers();
    }

    @Override
    protected void onResume() {
        super.onResume();
        webView.resumeTimers();
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    // ===== 原生 Ping（异步回调） =====
    public class NativePing {
        private Process activeProcess = null;

        @JavascriptInterface
        public void asyncPing(final String host, final int timeoutSec) {
            new Thread(() -> {
                try {
                    Process process = Runtime.getRuntime().exec(
                        new String[]{"ping", "-c", "1", "-W", String.valueOf(timeoutSec), host}
                    );
                    activeProcess = process;
                    BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
                    StringBuilder output = new StringBuilder();
                    String line;
                    while ((line = reader.readLine()) != null) output.append(line).append("\n");
                    int exitCode = process.waitFor();
                    activeProcess = null;
                    if (exitCode == 0) {
                        java.util.regex.Matcher m = java.util.regex.Pattern.compile("time[=:]\\s*([0-9.]+)\\s*ms").matcher(output.toString());
                        final String delay = m.find() ? m.group(1) : "0";
                        mainHandler.post(() -> webView.evaluateJavascript("window._pingCallback(" + delay + ")", null));
                    } else {
                        mainHandler.post(() -> webView.evaluateJavascript("window._pingCallback(-1)", null));
                    }
                } catch (Exception e) {
                    mainHandler.post(() -> webView.evaluateJavascript("window._pingCallback(-2)", null));
                }
            }).start();
        }

        @JavascriptInterface
        public void cancelPing() {
            try { if (activeProcess != null) activeProcess.destroy(); } catch (Exception ignored) {}
        }
    }

    // ===== 原生 MQTT 桥接 =====
    public class NativeMQTT {
        private MqttClient mqttClient = null;
        private boolean connected = false;

        @JavascriptInterface
        public String connect(final String host, final int port, final String clientId,
                              final String username, final String password, final boolean useTLS) {
            try {
                disconnectSync();
                String protocol = useTLS ? "ssl" : "tcp";
                String serverUri = protocol + "://" + host + ":" + port;
                MqttConnectOptions opts = new MqttConnectOptions();
                opts.setCleanSession(true);
                opts.setConnectionTimeout(10);
                opts.setKeepAliveInterval(30);
                opts.setAutomaticReconnect(false);
                if (username != null && !username.isEmpty()) opts.setUserName(username);
                if (password != null && !password.isEmpty()) opts.setPassword(password.toCharArray());
                mqttClient = new MqttClient(serverUri, clientId, new MemoryPersistence());
                mqttClient.setCallback(new MqttCallback() {
                    @Override
                    public void connectionLost(Throwable cause) {
                        connected = false;
                        mainHandler.post(() -> webView.evaluateJavascript("window._mqttOnStatus('disconnected')", null));
                    }
                    @Override
                    public void messageArrived(String topic, MqttMessage message) {
                        final String payload = new String(message.getPayload());
                        final String t = topic;
                        mainHandler.post(() -> webView.evaluateJavascript(
                            "window._mqttOnMessage('" + escapeJS(t) + "','" + escapeJS(payload) + "')", null));
                    }
                    @Override
                    public void deliveryComplete(IMqttDeliveryToken token) {}
                });
                mqttClient.connect(opts);
                connected = true;
                mainHandler.post(() -> webView.evaluateJavascript("window._mqttOnStatus('connected')", null));
                return "OK";
            } catch (Exception e) {
                return "FAIL:" + e.getMessage();
            }
        }

        @JavascriptInterface
        public void disconnect() { disconnectSync(); }

        private void disconnectSync() {
            try {
                if (mqttClient != null) {
                    if (mqttClient.isConnected()) mqttClient.disconnect();
                    mqttClient.close();
                }
            } catch (Exception ignored) {}
            mqttClient = null;
            connected = false;
        }

        @JavascriptInterface
        public void subscribe(String topic, int qos) {
            try { if (mqttClient != null && mqttClient.isConnected()) mqttClient.subscribe(topic, qos); } catch (Exception ignored) {}
        }
        @JavascriptInterface
        public void unsubscribe(String topic) {
            try { if (mqttClient != null && mqttClient.isConnected()) mqttClient.unsubscribe(topic); } catch (Exception ignored) {}
        }
        @JavascriptInterface
        public void publish(String topic, String message, int qos) {
            try {
                if (mqttClient != null && mqttClient.isConnected()) {
                    MqttMessage msg = new MqttMessage(message.getBytes());
                    msg.setQos(qos);
                    mqttClient.publish(topic, msg);
                }
            } catch (Exception ignored) {}
        }
        @JavascriptInterface
        public boolean isConnected() { return connected && mqttClient != null && mqttClient.isConnected(); }
        private String escapeJS(String s) {
            return s.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n").replace("\r", "\\r");
        }
    }

    // ===== 原生路由追踪 =====
    public class NativeTraceroute {
        private boolean tracing = false;

        @JavascriptInterface
        public void startTrace(final String host, final int maxHops, final int timeoutSec) {
            tracing = true;
            new Thread(() -> {
                try {
                    // 先解析目标域名到 IP（可选）
                    java.net.InetAddress targetAddr = java.net.InetAddress.getByName(host);
                    final String targetIP = targetAddr.getHostAddress();

                    for (int hop = 1; hop <= maxHops && tracing; hop++) {
                        final int currentHop = hop;
                        try {
                            final long hopStart = System.currentTimeMillis();
                            // 用 ping -t <ttl> 发送递增 TTL 的包
                            Process process = Runtime.getRuntime().exec(
                                new String[]{"ping", "-t", String.valueOf(hop), "-c", "1",
                                    "-W", String.valueOf(timeoutSec), host}
                            );
                            BufferedReader reader = new BufferedReader(
                                new InputStreamReader(process.getInputStream())
                            );
                            StringBuilder output = new StringBuilder();
                            String line;
                            while ((line = reader.readLine()) != null) {
                                output.append(line).append("\n");
                            }
                            int exitCode = process.waitFor();
                            final long hopElapsed = System.currentTimeMillis() - hopStart;
                            if (!tracing) break;

                            String outStr = output.toString();
                            String hopIP = "*";
                            long delay = hopElapsed;
                            boolean timeout = true;

                            if (exitCode == 0) {
                                // 到达目标
                                java.util.regex.Matcher m = java.util.regex.Pattern.compile(
                                    "time[=:]\\s*([0-9.]+)\\s*ms"
                                ).matcher(outStr);
                                if (m.find()) {
                                    delay = Math.round(Double.parseDouble(m.group(1)));
                                }
                                hopIP = targetIP;
                                timeout = false;
                                final String fHopIP = hopIP;
                                final long fDelay = delay;
                                mainHandler.post(() -> {
                                    webView.evaluateJavascript(
                                        "window._trCallback(" + currentHop + ",'" + fHopIP + "','" + host + "',"
                                            + fDelay + ",false,true)", null
                                    );
                                });
                                break; // 到达目标，结束
                            } else {
                                // TTL 超时 → 解析中间跳点的 IP
                                // Android ping 输出: "From 192.168.1.1: icmp_seq=1 Time to live exceeded"
                                java.util.regex.Matcher fromM = java.util.regex.Pattern.compile(
                                    "From\\s+([0-9.]+)"
                                ).matcher(outStr);
                                String hopName = "";
                                if (fromM.find()) {
                                    hopIP = fromM.group(1);
                                    // 反向解析主机名
                                    try {
                                        java.net.InetAddress addr = java.net.InetAddress.getByName(hopIP);
                                        hopName = addr.getCanonicalHostName();
                                        if (hopName.equals(hopIP)) hopName = "";
                                    } catch (Exception ignored) {}
                                    timeout = false;
                                }
                                final String fHopIP = hopIP;
                                final String fHopName = hopName;
                                final long fDelay2 = delay;
                                mainHandler.post(() -> {
                                    webView.evaluateJavascript(
                                        "window._trCallback(" + currentHop + ",'" + fHopIP + "','" + fHopName + "',"
                                            + fDelay2 + ",false,false)", null
                                    );
                                });
                            }
                        } catch (Exception e) {
                            if (!tracing) break;
                            mainHandler.post(() -> {
                                webView.evaluateJavascript(
                                    "window._trCallback(" + currentHop + ",'*','',0,true,false)", null
                                );
                            });
                        }

                        // 每次跳点间等待 100ms
                        try { Thread.sleep(100); } catch (InterruptedException e) { break; }
                    }
                } catch (final Exception e) {
                    mainHandler.post(() -> {
                        webView.evaluateJavascript("window._trDone('" + e.getMessage() + "')", null);
                    });
                    return;
                }
                mainHandler.post(() -> {
                    webView.evaluateJavascript("window._trDone('')", null);
                });
            }).start();
        }

        @JavascriptInterface
        public void stopTrace() {
            tracing = false;
        }
    }

    // ===== 原生图片保存到相册 =====
    public class NativeGallery {
        @JavascriptInterface
        public void saveImage(final String base64Data) {
            saveBitmapFromBase64(base64Data, "QR_" + System.currentTimeMillis() + ".png");
        }

        private void saveBitmapFromBase64(final String base64Data, final String filename) {
            new Thread(() -> {
                try {
                    String data = base64Data;
                    if (data.contains(",")) {
                        data = data.substring(data.indexOf(",") + 1);
                    }
                    byte[] imageBytes = Base64.decode(data, Base64.DEFAULT);
                    Bitmap bitmap = BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.length);
                    saveBitmapToGallery(bitmap, filename);
                } catch (Exception e) {
                    mainHandler.post(() ->
                        webView.evaluateJavascript(
                            "window._galleryCallback && window._galleryCallback(false)", null));
                }
            }).start();
        }

        private void saveBitmapToGallery(Bitmap bitmap, String filename) {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.Images.Media.DISPLAY_NAME, filename);
                    values.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
                    values.put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/小宝工具箱");
                    values.put(MediaStore.Images.Media.IS_PENDING, 1);

                    Uri uri = getContentResolver().insert(
                        MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
                    if (uri != null) {
                        try (OutputStream os = getContentResolver().openOutputStream(uri)) {
                            if (os != null) {
                                bitmap.compress(Bitmap.CompressFormat.PNG, 100, os);
                            }
                        }
                        values.clear();
                        values.put(MediaStore.Images.Media.IS_PENDING, 0);
                        getContentResolver().update(uri, values, null, null);
                    }
                } else {
                    MediaStore.Images.Media.insertImage(
                        getContentResolver(), bitmap, filename, "QR Code");
                }

                mainHandler.post(() ->
                    webView.evaluateJavascript(
                        "window._galleryCallback && window._galleryCallback(true)", null));
            } catch (Exception e) {
                mainHandler.post(() ->
                    webView.evaluateJavascript(
                        "window._galleryCallback && window._galleryCallback(false)", null));
            }
        }
    }
}
