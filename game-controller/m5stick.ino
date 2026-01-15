#include <M5StickCPlus2.h>
#include <WiFi.h>
#include <PubSubClient.h>

// ===== WiFi / MQTT 設定 =====

static const char* WIFI_SSID = "";
static const char* WIFI_PASS = "";

static const char* MQTT_HOST = "";
static const uint16_t MQTT_PORT = ;

static const char* MQTT_USER = "";
static const char* MQTT_PASS = "";

static const char* TOPIC_RUN = "";

// ===== 動き判定パラメータ =====
// 「加速度の変化量（Δ|a|）」がこの値を超えると “走った” と判定
// 単位は g（M5StickC の API が g で返すため）
// まずは 0.35?0.60 あたりで調整するのがオススメ
static const float RUN_DELTA_THRESHOLD_G = 0.45f;

// 連続送信を防ぐクールダウン（ms）
static const uint32_t RUN_COOLDOWN_MS = 400;

// センサー読み取り周期（ms）
static const uint32_t SAMPLE_INTERVAL_MS = 50;

WiFiClient espClient;
PubSubClient mqtt(espClient);

float prevMag = 1.0f;
uint32_t lastSampleMs = 0;
uint32_t lastRunSentMs = 0;

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  M5.Lcd.fillScreen(BLACK);
  M5.Lcd.setCursor(0, 0);
  M5.Lcd.setTextSize(2);
  M5.Lcd.println("WiFi...");
  M5.Lcd.setTextSize(1);
  M5.Lcd.println(WIFI_SSID);

  uint32_t start = millis();
  while (WiFi.status() != WL_CONNECTED) {
    delay(200);
    M5.Lcd.print(".");
    if (millis() - start > 20000) { // 20秒で一旦リトライ
      start = millis();
      WiFi.disconnect(true);
      delay(200);
      WiFi.begin(WIFI_SSID, WIFI_PASS);
      M5.Lcd.println("\nretry WiFi");
    }
  }

  M5.Lcd.println("\nWiFi OK");
  M5.Lcd.print("IP: ");
  M5.Lcd.println(WiFi.localIP());
}

void connectMQTT() {
  mqtt.setServer(MQTT_HOST, MQTT_PORT);

  M5.Lcd.println("\nMQTT...");
  uint32_t start = millis();

  while (!mqtt.connected()) {
    // クライアントIDは被りにくいように MAC の末尾を付加
    String clientId = "m5stick-player1-";
    clientId += String((uint32_t)ESP.getEfuseMac(), HEX);

    bool ok = mqtt.connect(clientId.c_str(), MQTT_USER, MQTT_PASS);

    if (ok) {
      M5.Lcd.println("MQTT OK");
      break;
    } else {
      M5.Lcd.print("fail rc=");
      M5.Lcd.println(mqtt.state());
      delay(1000);

      if (millis() - start > 20000) { // 20秒で表示更新
        start = millis();
        M5.Lcd.println("retry MQTT");
      }
    }
  }
}

void ensureConnections() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }
  if (!mqtt.connected()) {
    connectMQTT();
  }
}

float magnitudeG(float ax, float ay, float az) {
  // √(ax^2 + ay^2 + az^2)
  return sqrtf(ax * ax + ay * ay + az * az);
}

void setup() {
  M5.begin();
  // M5.IMU.Init();   // MPU6886 初期化（M5StickC / PLUS）

  M5.Lcd.setRotation(1);
  M5.Lcd.fillScreen(BLACK);
  M5.Lcd.setTextColor(WHITE, BLACK);

  connectWiFi();
  connectMQTT();

  // 初期値（静止時の |a| はだいたい 1g）
  float ax, ay, az;
  M5.Imu.getAccel(&ax, &ay, &az);
  prevMag = magnitudeG(ax, ay, az);

  M5.Lcd.println("\nReady!");
}

void loop() {
  M5.update();
  ensureConnections();
  mqtt.loop();

  const uint32_t now = millis();
  if (now - lastSampleMs < SAMPLE_INTERVAL_MS) return;
  lastSampleMs = now;

  float ax, ay, az;
  M5.Imu.getAccel(&ax, &ay, &az);

  float mag = magnitudeG(ax, ay, az);
  float delta = fabsf(mag - prevMag);
  prevMag = mag;

  // デバッグ表示（必要なければコメントアウトOK）
  M5.Lcd.setCursor(0, 60);
  M5.Lcd.setTextSize(1);
  M5.Lcd.printf("|a|=%.2fg d=%.2f   \n", mag, delta);

  // 閾値超え + クールダウン経過で "run" 送信
  if (delta >= RUN_DELTA_THRESHOLD_G && (now - lastRunSentMs) >= RUN_COOLDOWN_MS) {
    bool ok = mqtt.publish(TOPIC_RUN, "run");
    lastRunSentMs = now;

    M5.Lcd.setCursor(0, 80);
    M5.Lcd.printf("SEND run: %s\n", ok ? "OK" : "FAIL");
  }
}
