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

import android.util.Base64;

import org.eclipse.paho.client.mqttv3.IMqttDeliveryToken;
import org.eclipse.paho.client.mqttv3.MqttCallback;
import org.eclipse.paho.client.mqttv3.MqttClient;
import org.eclipse.paho.client.mqttv3.MqttConnectOptions;
import org.eclipse.paho.client.mqttv3.MqttException;
import org.eclipse.paho.client.mqttv3.MqttMessage;
import org.eclipse.paho.client.mqttv3.persist.MemoryPersistence;

import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.InputStreamReader;
import java.security.KeyFactory;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.cert.Certificate;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.security.spec.PKCS8EncodedKeySpec;

import javax.net.ssl.KeyManagerFactory;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLSocketFactory;
import javax.net.ssl.TrustManagerFactory;

import android.content.ContentValues;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import android.util.Base64;

import java.io.OutputStream;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

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
        webView.addJavascriptInterface(new NativeScanner(), "NativeScanner");

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

    // ===== 原生 MQTT 桥接（支持证书） =====
    public class NativeMQTT {
        private MqttClient mqttClient = null;
        private boolean connected = false;

        @JavascriptInterface
        public void connect(final String host, final int port, final String clientId,
                              final String username, final String password, final boolean useTLS,
                              final String caCert, final String clientCert, final String clientKey,
                              final String alpn) {
            // 后台线程执行，不阻塞 JS 线程
            new Thread(() -> {
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

                    if (useTLS && caCert != null && !caCert.isEmpty()) {
                        SSLSocketFactory sf = createSslFactory(caCert, clientCert, clientKey, alpn);
                        if (sf != null) opts.setSocketFactory(sf);
                    }

                    mqttClient = new MqttClient(serverUri, clientId, new MemoryPersistence());
                    mqttClient.setCallback(new MqttCallback() {
                        @Override
                        public void connectionLost(Throwable cause) {
                            connected = false;
                            mainHandler.post(() -> webView.evaluateJavascript(
                                "window._mqttOnStatus('disconnected')", null));
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
                    mainHandler.post(() -> webView.evaluateJavascript(
                        "window._mqttOnStatus('connected')", null));
                } catch (Exception e) {
                    String msg = "";
                    if (e instanceof MqttException) {
                        MqttException me = (MqttException) e;
                        msg = "MQTT原因码=" + me.getReasonCode();
                        Throwable cause = me.getCause();
                        int depth = 0;
                        while (cause != null && depth < 3) {
                            String cMsg = cause.getMessage();
                            if (cMsg != null && !cMsg.isEmpty()) {
                                msg += " | " + cause.getClass().getSimpleName() + ": " + cMsg;
                                break;
                            }
                            cause = cause.getCause();
                            depth++;
                        }
                    } else {
                        msg = e.getMessage();
                        if (msg == null || msg.isEmpty()) msg = e.toString();
                    }
                    e.printStackTrace();
                    final String errMsg = msg;
                    mainHandler.post(() -> webView.evaluateJavascript(
                        "window._mqttOnConnectError('" + escapeJS(errMsg) + "')", null));
                }
            }).start();
        }

        // SSL 工厂：接收 base64 或 PEM 文本，写入临时文件后解析
        private SSLSocketFactory createSslFactory(String caB64, String certB64, String keyB64, String alpn) throws Exception {
            java.io.File cacheDir = getCacheDir();
            CertificateFactory cf = CertificateFactory.getInstance("X.509");
            KeyStore trustStore = KeyStore.getInstance(KeyStore.getDefaultType());
            trustStore.load(null, null);
            // 将 base64 或 PEM 文本解码为原始字节
            byte[] caBytes = decodeCertInput(caB64);
            byte[] certBytes = decodeCertInput(certB64);
            byte[] keyBytes = decodeCertInput(keyB64);
            // CA 证书
            if (caBytes != null && caBytes.length > 0) {
                java.io.File tmp = new java.io.File(cacheDir, "mqtt_ca_" + System.currentTimeMillis() + ".pem");
                try {
                    java.io.FileOutputStream fos = new java.io.FileOutputStream(tmp);
                    fos.write(caBytes); fos.close();
                    X509Certificate ca = (X509Certificate) cf.generateCertificate(new java.io.FileInputStream(tmp));
                    trustStore.setCertificateEntry("ca", ca);
                } finally { tmp.delete(); }
            }
            TrustManagerFactory tmf = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
            tmf.init(trustStore);
            // 客户端证书 + Key
            KeyManagerFactory kmf = null;
            if (certBytes != null && certBytes.length > 0) {
                if (keyBytes == null || keyBytes.length == 0) throw new Exception("有客户端证书但缺少 Key 文件");
                KeyStore keyStore = KeyStore.getInstance(KeyStore.getDefaultType());
                keyStore.load(null, null);
                java.io.File certTmp = new java.io.File(cacheDir, "mqtt_cert_" + System.currentTimeMillis() + ".pem");
                Certificate clientCert = null;
                try {
                    java.io.FileOutputStream fos = new java.io.FileOutputStream(certTmp);
                    fos.write(certBytes); fos.close();
                    clientCert = cf.generateCertificate(new java.io.FileInputStream(certTmp));
                } finally { certTmp.delete(); }
                PrivateKey privateKey = parseKeyBytes(keyBytes);
                if (privateKey == null) throw new Exception("无法解析 Key 文件，请确认是 PEM 格式私钥");
                keyStore.setKeyEntry("client", privateKey, "".toCharArray(), new Certificate[]{clientCert});
                kmf = KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm());
                kmf.init(keyStore, "".toCharArray());
            }
            SSLContext ctx = SSLContext.getInstance("TLS");
            ctx.init(kmf != null ? kmf.getKeyManagers() : null, tmf.getTrustManagers(), null);
            return ctx.getSocketFactory();
        }
        // 自动识别 base64 或 PEM 文本，返回原始字节
        private byte[] decodeCertInput(String input) {
            if (input == null || input.isEmpty()) return new byte[0];
            String trimmed = input.trim();
            // 如果以 PEM 标记开头，直接取 UTF-8 字节（兼容旧数据）
            if (trimmed.startsWith("-----BEGIN")) {
                try { return trimmed.getBytes("UTF-8"); } catch (Exception e) { return new byte[0]; }
            }
            // 否则当作 base64 解码
            try { return Base64.decode(trimmed, Base64.DEFAULT); } catch (Exception e) { return new byte[0]; }
        }
        // 解析私钥字节（支持 PEM 文本和裸 DER）
        private PrivateKey parseKeyBytes(byte[] data) {
            try {
                String pem = new String(data, "UTF-8");
                // 如果是 PEM 格式，提取 base64 体并解码为 DER
                if (pem.contains("-----BEGIN")) {
                    String raw = pem
                        .replace("-----BEGIN PRIVATE KEY-----", "")
                        .replace("-----END PRIVATE KEY-----", "")
                        .replace("-----BEGIN RSA PRIVATE KEY-----", "")
                        .replace("-----END RSA PRIVATE KEY-----", "")
                        .replace("-----BEGIN EC PRIVATE KEY-----", "")
                        .replace("-----END EC PRIVATE KEY-----", "")
                        .replaceAll("\\s", "");
                    data = Base64.decode(raw, Base64.DEFAULT);
                }
            } catch (Exception ignored) {}
            // 尝试 PKCS#8
            try {
                PKCS8EncodedKeySpec spec = new PKCS8EncodedKeySpec(data);
                try { return KeyFactory.getInstance("RSA").generatePrivate(spec); } catch (Exception e) {}
                try { return KeyFactory.getInstance("EC").generatePrivate(spec); } catch (Exception e) {}
                try { return KeyFactory.getInstance("DSA").generatePrivate(spec); } catch (Exception e) {}
            } catch (Exception ignored) {}
            // 尝试 PKCS#1 -> 手动构建 PKCS#8 包裹
            try {
                byte[] algId = hexToBytes("300D06092A864886F70D0101010500");
                byte[] wrapped = new byte[algId.length + 4 + data.length];
                System.arraycopy(algId, 0, wrapped, 0, algId.length);
                wrapped[algId.length] = 0x04; wrapped[algId.length + 1] = (byte)0x82;
                wrapped[algId.length + 2] = (byte)((data.length >> 8) & 0xFF);
                wrapped[algId.length + 3] = (byte)(data.length & 0xFF);
                System.arraycopy(data, 0, wrapped, algId.length + 4, data.length);
                int total = wrapped.length + 3;
                byte[] pkcs8 = new byte[total + 4];
                pkcs8[0] = 0x30; pkcs8[1] = (byte)0x82;
                pkcs8[2] = (byte)((total >> 8) & 0xFF); pkcs8[3] = (byte)(total & 0xFF);
                pkcs8[4] = 0x02; pkcs8[5] = 0x01; pkcs8[6] = 0x00;
                System.arraycopy(wrapped, 0, pkcs8, 7, wrapped.length);
                return KeyFactory.getInstance("RSA").generatePrivate(new PKCS8EncodedKeySpec(pkcs8));
            } catch (Exception e) { return null; }
        }
        private byte[] hexToBytes(String hex) {
            int len = hex.length(); byte[] data = new byte[len / 2];
            for (int i = 0; i < len; i += 2)
                data[i / 2] = (byte)((Character.digit(hex.charAt(i), 16) << 4) + Character.digit(hex.charAt(i + 1), 16));
            return data;
        }

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
    }
    private String escapeJS(String s) {
        return s.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n").replace("\r", "\\r");
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

        @JavascriptInterface
        public void openUrl(final String url) {
            if (url == null || url.isEmpty()) return;
            mainHandler.post(() -> {
                try {
                    Intent intent = new Intent(Intent.ACTION_VIEW, android.net.Uri.parse(url));
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(intent);
                } catch (Exception e) {}
            });
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

public class NativeScanner {
        private volatile boolean scanning = false;
        private int totalTargets = 0;
        private int scannedCount = 0;
        private int aliveCount = 0;
        private java.util.concurrent.ExecutorService threadPool = null;

        private int[] parsePorts(String portsStr) {
            if (portsStr == null || portsStr.trim().isEmpty()) return null;
            java.util.ArrayList<Integer> portList = new java.util.ArrayList<>();
            String[] parts = portsStr.split(",");
            for (String part : parts) {
                part = part.trim();
                if (part.isEmpty()) continue;
                if (part.contains("-")) {
                    String[] range = part.split("-");
                    try {
                        int start = Integer.parseInt(range[0].trim());
                        int end = Integer.parseInt(range[1].trim());
                        if (start > end) { int t = start; start = end; end = t; }
                        if (end > 65535) end = 65535;
                        for (int p = start; p <= end; p++) portList.add(p);
                    } catch (Exception ignored) {}
                } else {
                    try { portList.add(Integer.parseInt(part)); } catch (Exception ignored) {}
                }
            }
            if (portList.isEmpty()) return null;
            int[] result = new int[portList.size()];
            for (int i = 0; i < portList.size(); i++) result[i] = portList.get(i);
            return result;
        }

        private String getMacFromArp(String targetIp) {
            try {
                java.io.BufferedReader br = new java.io.BufferedReader(new java.io.FileReader("/proc/net/arp"));
                String line;
                while ((line = br.readLine()) != null) {
                    String[] parts = line.trim().split("\\s+");
                    if (parts.length >= 4 && parts[0].equals(targetIp)) {
                        String mac = parts[3];
                        if (!mac.equals("00:00:00:00:00:00")) return mac.toUpperCase();
                    }
                }
                br.close();
            } catch (Exception ignored) {}
            return "";
        }

        private String identifyDevice(String mac) {
            if (mac == null || mac.isEmpty()) return "";
            String oui = mac.replace(":", "").substring(0, 6).toUpperCase();
            if (oui.startsWith("00:") || oui.equals("000000")) return "";
            if (oui.equals("0050B6") || oui.equals("00037F")) return "Cisco";
            if (oui.startsWith("FC:FB") || oui.startsWith("F8:1D")) return "TP-Link";
            if (oui.startsWith("8C:DE") || oui.startsWith("18:FE")) return "Xiaomi";
            if (oui.startsWith("48:22") || oui.startsWith("5C:02")) return "Huawei";
            if (oui.startsWith("34:95") || oui.startsWith("14:14")) return "Xiaomi";
            if (oui.startsWith("4C:AA")) return "Huawei";
            if (oui.startsWith("A4:C1") || oui.startsWith("E0:E2")) return "Hikvision";
            if (oui.startsWith("00:1B") || oui.startsWith("AC:84")) return "D-Link";
            if (oui.startsWith("C0:4A")) return "ASUS";
            if (oui.startsWith("B0:75")) return "ZTE";
            if (oui.startsWith("CC:2D")) return "H3C";
            if (oui.startsWith("D4:61")) return "Intel";
            if (oui.startsWith("B8:27") || oui.startsWith("DC:A6")) return "Raspberry Pi";
            if (oui.startsWith("AA:AA")) return "";
            return "OUI:" + oui;
        }

        private String fetchHttpTitle(String ip, int port) {
            try {
                Socket sock = new Socket();
                sock.connect(new InetSocketAddress(ip, port), 80);
                sock.setSoTimeout(80);
                java.io.OutputStream out = sock.getOutputStream();
                java.io.BufferedReader in = new java.io.BufferedReader(
                    new java.io.InputStreamReader(sock.getInputStream()));
                out.write(("GET / HTTP/1.0\\r\\nHost: " + ip + "\\r\\nConnection: close\\r\\n\\r\\n").getBytes());
                out.flush();
                String line;
                while ((line = in.readLine()) != null) {
                    if (line.contains("<title>") || line.contains("<TITLE>")) {
                        String title = line.replaceAll("(?i)<\\/?title>", "").trim();
                        if (title.length() > 50) title = title.substring(0, 50) + "...";
                        sock.close();
                        return title;
                    }
                }
                sock.close();
            } catch (Exception ignored) {}
            return "";
        }

        private boolean isHostAlive(String ip) {
            int[] probePorts = {80, 443, 22, 8080, 3389, 21, 23, 8443, 9090};
            for (int port : probePorts) {
                try {
                    Socket sock = new Socket();
                    sock.connect(new InetSocketAddress(ip, port), 80);
                    sock.close();
                    return true;
                } catch (Exception ignored) {}
            }
            return false;
        }

        @JavascriptInterface
        public void startScan(final String ipPrefix, final int startIp, final int endIp, final String portsStr) {
            if (scanning) return;
            mainHandler.post(() -> webView.evaluateJavascript("window._scanStart()", null));
            scanning = true;
            scannedCount = 0;
            aliveCount = 0;
            totalTargets = endIp - startIp + 1;
            final int[] ports = parsePorts(portsStr);
            final boolean doPortScan = (ports != null && ports.length > 0);
            threadPool = java.util.concurrent.Executors.newFixedThreadPool(20);
            for (int ip = startIp; ip <= endIp && scanning; ip++) {
                final String targetIp = ipPrefix + "." + ip;
                final int currentIp = ip;
                threadPool.submit(() -> {
                    try {
                        InetAddress addr = InetAddress.getByName(targetIp);
                        StringBuilder openPorts = new StringBuilder();
                        boolean alive = false;
                        // Ping 判断在线
                        try { alive = addr.isReachable(80); } catch (Exception ignored) {}

                        if (alive && doPortScan && scanning) {
                            // 在线 + 有端口列表 → 扫端口
                            for (int port : ports) {
                                if (!scanning) break;
                                try {
                                    Socket sock = new Socket();
                                    sock.connect(new InetSocketAddress(targetIp, port), 80);
                                    sock.close();
                                    if (openPorts.length() > 0) openPorts.append(",");
                                    openPorts.append(port);
                                } catch (Exception ignored) {}
                            }
                        }
                        if (alive && scanning) {
                            aliveCount++;
                            final String fPorts = openPorts.toString();
                            mainHandler.post(() -> webView.evaluateJavascript(
                                "window._scanResult(" + currentIp + ",'" + escapeJS(fPorts) + "')", null));
                        }
                    } catch (Exception e) {
                        final String err = e.getMessage() != null ? e.getMessage() : e.toString();
                        mainHandler.post(() -> webView.evaluateJavascript(
                            "window._scanDebug('" + escapeJS(err) + "')", null));
                    }
                    scannedCount++;
                    int pct = Math.max(1, (scannedCount * 100) / totalTargets);
                    if (pct > 99) pct = 99;
                    final int fpct = pct;
                    mainHandler.post(() -> webView.evaluateJavascript(
                        "window._scanProgress(" + fpct + ")", null));
                });
            }
            new Thread(() -> {
                try { threadPool.shutdown(); threadPool.awaitTermination(5, java.util.concurrent.TimeUnit.MINUTES); } catch (Exception ignored) {}
                scanning = false;
                mainHandler.post(() -> webView.evaluateJavascript("window._scanComplete()", null));
            }).start();
        }

        @JavascriptInterface
        public void stopScan() {
            scanning = false;
            if (threadPool != null) { threadPool.shutdownNow(); threadPool = null; }
        }

        @JavascriptInterface
        public boolean isScanning() { return scanning; }
    }
}
