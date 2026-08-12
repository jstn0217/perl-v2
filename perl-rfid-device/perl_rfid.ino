#include <DNSServer.h>
#include <ESP8266HTTPClient.h>
#include <ESP8266WebServer.h>
#include <ESP8266WiFi.h>
#include <LittleFS.h>
#include <MFRC522.h>
#include <SPI.h>

#define RF_RST_PIN D3
#define RF_SDA_PIN D2

const uint8_t GREEN_SIGNAL_PIN = D1;
const uint8_t CONNECTION_LED_PIN = D4;
const uint8_t ACTIVITY_LED_PIN = D0;
const uint8_t RELAY_PIN = D8;

const unsigned long SAVED_WIFI_TIMEOUT_MS = 15000;
const unsigned long PROVISIONED_WIFI_TIMEOUT_MS = 25000;
const unsigned long WIFI_RECONNECT_INTERVAL_MS = 10000;
const unsigned long WIFI_RESTART_AFTER_MS = 60000;
const char *DEVICE_CONFIG_PATH = "/device.conf";
const char *SETUP_AP_PASSWORD = "dcla_2015";

MFRC522 rfid(RF_SDA_PIN, RF_RST_PIN);
DNSServer dnsServer;
ESP8266WebServer setupServer(80);
WiFiClient networkClient;

struct DeviceConfig {
  String apiBaseUrl;
  String deviceKey;
};

DeviceConfig deviceConfig;
unsigned long disconnectedAt = 0;
unsigned long lastReconnectAttempt = 0;

String htmlEscape(const String &value) {
  String escaped;
  escaped.reserve(value.length() + 16);

  for (size_t index = 0; index < value.length(); index++) {
    switch (value[index]) {
      case '&':
        escaped += F("&amp;");
        break;
      case '<':
        escaped += F("&lt;");
        break;
      case '>':
        escaped += F("&gt;");
        break;
      case '"':
        escaped += F("&quot;");
        break;
      case '\'':
        escaped += F("&#39;");
        break;
      default:
        escaped += value[index];
    }
  }

  return escaped;
}

bool isValidApiBaseUrl(const String &value) {
  // https:// is accepted for TLS-capable deployments. Note: the HTTP client below
  // still uses plaintext WiFiClient; a follow-up must switch it to
  // WiFiClientSecure to actually perform TLS for https:// base URLs.
  bool validScheme = value.startsWith("https://") || value.startsWith("http://");
  size_t minLength = value.startsWith("https://") ? 8 : 7;
  return validScheme && value.length() > minLength && value.length() <= 160 &&
         value.indexOf('\n') == -1 && value.indexOf('\r') == -1;
}

bool isValidDeviceKey(const String &value) {
  return value.length() >= 16 && value.length() <= 160 &&
         value.indexOf('\n') == -1 && value.indexOf('\r') == -1;
}

bool loadDeviceConfig() {
  if (!LittleFS.exists(DEVICE_CONFIG_PATH)) {
    return false;
  }

  File file = LittleFS.open(DEVICE_CONFIG_PATH, "r");
  if (!file) {
    return false;
  }

  String version = file.readStringUntil('\n');
  String apiBaseUrl = file.readStringUntil('\n');
  String deviceKey = file.readStringUntil('\n');
  file.close();

  version.trim();
  apiBaseUrl.trim();
  deviceKey.trim();

  if (version != "1" || !isValidApiBaseUrl(apiBaseUrl) || !isValidDeviceKey(deviceKey)) {
    return false;
  }

  deviceConfig.apiBaseUrl = apiBaseUrl;
  deviceConfig.deviceKey = deviceKey;
  return true;
}

bool saveDeviceConfig(const String &apiBaseUrl, const String &deviceKey) {
  File file = LittleFS.open(DEVICE_CONFIG_PATH, "w");
  if (!file) {
    return false;
  }

  bool saved = file.println("1") > 0 &&
               file.println(apiBaseUrl) > 0 &&
               file.println(deviceKey) > 0;
  file.close();

  if (saved) {
    deviceConfig.apiBaseUrl = apiBaseUrl;
    deviceConfig.deviceKey = deviceKey;
  }

  return saved;
}

String renderSetupPage(const String &message = "") {
  int networkCount = WiFi.scanNetworks();
  String page;
  page.reserve(5000);
  page += F(
      "<!doctype html><html><head><meta charset='utf-8'>"
      "<meta name='viewport' content='width=device-width,initial-scale=1'>"
      "<title>PERL RFID setup</title><style>"
      "body{font-family:system-ui,sans-serif;max-width:36rem;margin:2rem auto;padding:0 1rem;color:#172033}"
      "label{display:block;margin-top:1rem;font-weight:600}"
      "input,select,button{box-sizing:border-box;width:100%;font:inherit;padding:.75rem;margin-top:.35rem}"
      "button{background:#0f4c81;color:white;border:0;border-radius:.35rem;margin-top:1.5rem}"
      ".message{padding:.75rem;background:#eef5fb;border-left:4px solid #0f4c81}"
      ".hint{color:#566174;font-size:.9rem}</style></head><body>"
      "<h1>PERL RFID setup</h1>");

  if (message.length() > 0) {
    page += F("<p class='message'>");
    page += htmlEscape(message);
    page += F("</p>");
  }

  page += F(
      "<form method='post' action='/save'>"
      "<label for='ssid'>Wi-Fi network</label><select id='ssid' name='ssid' required>"
      "<option value=''>Select a network</option>");

  for (int index = 0; index < networkCount; index++) {
    String ssid = WiFi.SSID(index);
    page += F("<option value=\"");
    page += htmlEscape(ssid);
    page += F("\">");
    page += htmlEscape(ssid);
    page += F(" (");
    page += String(WiFi.RSSI(index));
    page += F(" dBm)</option>");
  }

  page += F(
      "</select>"
      "<label for='wifiPassword'>Wi-Fi password</label>"
      "<input id='wifiPassword' name='wifiPassword' type='password' maxlength='63' autocomplete='new-password'>"
      "<p class='hint'>Leave blank only when the selected Wi-Fi network is open.</p>"
      "<label for='apiBaseUrl'>PERL API base URL</label>"
      "<input id='apiBaseUrl' name='apiBaseUrl' type='url' maxlength='160' placeholder='http://192.168.1.20:4000' value=\"");
  page += htmlEscape(deviceConfig.apiBaseUrl);
  page += F(
      "\" required>"
      "<p class='hint'>Use the computer's LAN address, not localhost. This firmware accepts HTTP for local deployments.</p>"
      "<label for='deviceKey'>Device key</label>"
      "<input id='deviceKey' name='deviceKey' type='password' minlength='16' maxlength='160' autocomplete='new-password'");

  if (deviceConfig.deviceKey.length() > 0) {
    page += F(" placeholder='Leave blank to keep the saved key'");
  } else {
    page += F(" required");
  }

  page += F(
      "><p class='hint'>Generate this key from the school's Devices page. It is never placed in a URL.</p>"
      "<button type='submit'>Save and connect</button></form></body></html>");
  WiFi.scanDelete();
  return page;
}

void redirectToSetupPage() {
  setupServer.sendHeader("Location", String("http://") + WiFi.softAPIP().toString(), true);
  setupServer.send(302, "text/plain", "");
}

bool waitForWifi(unsigned long timeoutMs) {
  unsigned long startedAt = millis();

  while (WiFi.status() != WL_CONNECTED && millis() - startedAt < timeoutMs) {
    digitalWrite(CONNECTION_LED_PIN, !digitalRead(CONNECTION_LED_PIN));
    delay(250);
    yield();
  }

  digitalWrite(CONNECTION_LED_PIN, WiFi.status() == WL_CONNECTED ? HIGH : LOW);
  return WiFi.status() == WL_CONNECTED;
}

void handleProvisioningSave() {
  String ssid = setupServer.arg("ssid");
  String wifiPassword = setupServer.arg("wifiPassword");
  String apiBaseUrl = setupServer.arg("apiBaseUrl");
  String deviceKey = setupServer.arg("deviceKey");

  ssid.trim();
  apiBaseUrl.trim();
  deviceKey.trim();

  while (apiBaseUrl.endsWith("/")) {
    apiBaseUrl.remove(apiBaseUrl.length() - 1);
  }

  if (deviceKey.length() == 0) {
    deviceKey = deviceConfig.deviceKey;
  }

  if (ssid.length() == 0 || ssid.length() > 32) {
    setupServer.send(400, "text/html", renderSetupPage("Select a valid Wi-Fi network."));
    return;
  }

  if (wifiPassword.length() > 63 || (wifiPassword.length() > 0 && wifiPassword.length() < 8)) {
    setupServer.send(400, "text/html", renderSetupPage("The Wi-Fi password must be empty or 8–63 characters."));
    return;
  }

  if (!isValidApiBaseUrl(apiBaseUrl)) {
    setupServer.send(400, "text/html", renderSetupPage("Enter a valid HTTP API base URL."));
    return;
  }

  if (!isValidDeviceKey(deviceKey)) {
    setupServer.send(400, "text/html", renderSetupPage("Enter a valid device key of at least 16 characters."));
    return;
  }

  setupServer.send(
      200,
      "text/html",
      F("<!doctype html><meta name='viewport' content='width=device-width,initial-scale=1'>"
        "<title>PERL RFID setup</title><p>Connecting to Wi-Fi. The scanner will restart when ready.</p>"));
  delay(200);

  WiFi.persistent(true);
  WiFi.begin(ssid.c_str(), wifiPassword.c_str());
  bool connected = waitForWifi(PROVISIONED_WIFI_TIMEOUT_MS);
  WiFi.persistent(false);

  if (!connected) {
    Serial.println(F("Provisioned Wi-Fi connection failed; setup hotspot remains available."));
    return;
  }

  if (!saveDeviceConfig(apiBaseUrl, deviceKey)) {
    Serial.println(F("Unable to save the API and device configuration."));
    return;
  }

  Serial.println(F("Provisioning complete. Restarting..."));
  delay(1000);
  ESP.restart();
}

void startProvisioningPortal() {
  String setupSsid = "PERL-RFID-Setup-" + String(ESP.getChipId(), HEX);
  setupSsid.toUpperCase();

  WiFi.mode(WIFI_AP_STA);
  WiFi.softAP(setupSsid.c_str(), SETUP_AP_PASSWORD);

  IPAddress setupIp = WiFi.softAPIP();
  dnsServer.start(53, "*", setupIp);

  setupServer.on("/", HTTP_GET, []() {
    setupServer.send(200, "text/html", renderSetupPage());
  });
  setupServer.on("/save", HTTP_POST, handleProvisioningSave);
  setupServer.onNotFound(redirectToSetupPage);
  setupServer.begin();

  Serial.println();
  Serial.println(F("Wi-Fi setup is required."));
  Serial.print(F("Setup network: "));
  Serial.println(setupSsid);
  Serial.print(F("Setup password: "));
  Serial.println(SETUP_AP_PASSWORD);
  Serial.print(F("Setup page: http://"));
  Serial.println(setupIp);

  while (true) {
    dnsServer.processNextRequest();
    setupServer.handleClient();
    yield();
  }
}

bool connectToSavedWifi() {
  WiFi.persistent(false);
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin();

  Serial.print(F("Connecting to saved Wi-Fi"));
  bool connected = waitForWifi(SAVED_WIFI_TIMEOUT_MS);
  Serial.println();

  if (connected) {
    Serial.print(F("Connected. Device IP: "));
    Serial.println(WiFi.localIP());
  }

  return connected;
}

void initializeWifi() {
  bool hasDeviceConfig = loadDeviceConfig();

  if (connectToSavedWifi() && hasDeviceConfig) {
    return;
  }

  if (!hasDeviceConfig) {
    Serial.println(F("API or device configuration is missing."));
  }

  startProvisioningPortal();
}

void maintainWifi() {
  if (WiFi.status() == WL_CONNECTED) {
    disconnectedAt = 0;
    digitalWrite(CONNECTION_LED_PIN, HIGH);
    return;
  }

  digitalWrite(CONNECTION_LED_PIN, LOW);
  unsigned long now = millis();

  if (disconnectedAt == 0) {
    disconnectedAt = now;
  }

  if (now - lastReconnectAttempt >= WIFI_RECONNECT_INTERVAL_MS) {
    lastReconnectAttempt = now;
    Serial.println(F("Wi-Fi disconnected; reconnecting..."));
    WiFi.reconnect();
  }

  if (now - disconnectedAt >= WIFI_RESTART_AFTER_MS) {
    Serial.println(F("Wi-Fi unavailable for too long; restarting into recovery."));
    ESP.restart();
  }
}

void showRfidDetails() {
  byte version = rfid.PCD_ReadRegister(rfid.VersionReg);
  Serial.print(F("MFRC522 firmware version: 0x"));
  Serial.println(version, HEX);

  if (version == 0x00 || version == 0xFF) {
    Serial.println(F("RFID module communication failure. Check the wiring."));
  }
}

void activateAccessSignal() {
  digitalWrite(GREEN_SIGNAL_PIN, HIGH);
  digitalWrite(RELAY_PIN, LOW);
  delay(500);
  digitalWrite(GREEN_SIGNAL_PIN, LOW);
  digitalWrite(RELAY_PIN, HIGH);
}

void indicateDeniedScan() {
  for (uint8_t index = 0; index < 2; index++) {
    digitalWrite(ACTIVITY_LED_PIN, HIGH);
    delay(150);
    digitalWrite(ACTIVITY_LED_PIN, LOW);
    delay(150);
  }
}

bool postAttendanceScan(const String &cardUid) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println(F("Scan not sent because Wi-Fi is disconnected."));
    return false;
  }

  HTTPClient http;
  String url = deviceConfig.apiBaseUrl + "/api/device/scan";
  String payload = String("{\"cardUid\":\"") + cardUid + "\"}";

  http.begin(networkClient, url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Key", deviceConfig.deviceKey);
  int statusCode = http.POST(payload);
  String response = statusCode > 0 ? http.getString() : "";
  http.end();

  if (statusCode <= 0) {
    Serial.print(F("Attendance request failed: "));
    Serial.println(http.errorToString(statusCode));
    return false;
  }

  bool admitted = statusCode >= 200 && statusCode < 300 &&
                  response.indexOf("\"verdict\":\"ADMITTED\"") >= 0;
  Serial.print(F("Attendance response: "));
  Serial.println(statusCode);
  return admitted;
}

void setup() {
  pinMode(GREEN_SIGNAL_PIN, OUTPUT);
  pinMode(CONNECTION_LED_PIN, OUTPUT);
  pinMode(ACTIVITY_LED_PIN, OUTPUT);
  pinMode(RELAY_PIN, OUTPUT);

  digitalWrite(GREEN_SIGNAL_PIN, LOW);
  digitalWrite(CONNECTION_LED_PIN, LOW);
  digitalWrite(ACTIVITY_LED_PIN, LOW);
  digitalWrite(RELAY_PIN, HIGH);

  Serial.begin(115200);
  Serial.println();
  SPI.begin();

  if (!LittleFS.begin()) {
    Serial.println(F("LittleFS initialization failed."));
  }

  initializeWifi();

  rfid.PCD_Init();
  showRfidDetails();
  Serial.println(F("PERL RFID scanner ready."));
}

void loop() {
  maintainWifi();

  if (WiFi.status() != WL_CONNECTED || !rfid.PICC_IsNewCardPresent() ||
      !rfid.PICC_ReadCardSerial()) {
    delay(10);
    return;
  }

  String cardUid;
  for (byte index = 0; index < rfid.uid.size; index++) {
    if (rfid.uid.uidByte[index] < 0x10) {
      cardUid += "0";
    }
    cardUid += String(rfid.uid.uidByte[index], HEX);
  }
  cardUid.toUpperCase();

  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();

  Serial.print(F("Scanned card: "));
  Serial.println(cardUid);
  digitalWrite(ACTIVITY_LED_PIN, HIGH);
  bool admitted = postAttendanceScan(cardUid);
  digitalWrite(ACTIVITY_LED_PIN, LOW);

  if (admitted) {
    activateAccessSignal();
  } else {
    indicateDeniedScan();
  }

  delay(750);
}
