#include <M5StickCPlus2.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <WiFiManager.h> // ★これが必要
#include "env.h" 


static const char* MQTT_HOST = SECRET_MQTT_HOST;
static const uint16_t MQTT_PORT = SECRET_MQTT_PORT;
static const char* MQTT_USER = SECRET_MQTT_USER;
static const char* MQTT_PASS = SECRET_MQTT_PASS;
static const char* TOPIC_RUN_BASE = SECRET_TOPIC_RUN_BASE;
static const char* DEFAULT_PLAYER_ID = SECRET_DEFAULT_PLAYER;
static const char* TOPIC_CONTROLLER = "dorosupi/controller";

String macAddress = "";
String playerId = "";

// ===== 動き判定パラメータ =====
static const float RUN_DELTA_THRESHOLD_G = 0.45f;
static const uint32_t RUN_COOLDOWN_MS = 400;
static const uint32_t SAMPLE_INTERVAL_MS = 50;

WiFiClient espClient;
PubSubClient mqtt(espClient);

float prevMag = 1.0f;
uint32_t lastSampleMs = 0;
uint32_t lastRunSentMs = 0;

String buildRunTopic() {
  return String(TOPIC_RUN_BASE) + "/" + playerId;
}

void showPlayer() {
  M5.Lcd.setCursor(0, 20);
  M5.Lcd.printf("Player: %s   \n", playerId.c_str());
}

void reconnectMQTT() {
  while (!mqtt.connected()) {
    M5.Lcd.setCursor(0, 40);
    M5.Lcd.println("Connecting MQTT...");

    // MACアドレスをクライアントIDとして使用
    if (mqtt.connect(macAddress.c_str(), MQTT_USER, MQTT_PASS)) {
      M5.Lcd.println("MQTT Connected!");
    } else {
      M5.Lcd.printf("failed, rc=%d\n", mqtt.state());
      M5.Lcd.println(" retrying in 5 sec");
      delay(5000);
    }
  }
}

// ★設定モードに入ったときに画面表示を変える関数
void configModeCallback (WiFiManager *myWiFiManager) {
  M5.Lcd.fillScreen(RED); // 設定待ちなら赤画面
  M5.Lcd.setCursor(0, 0);
  M5.Lcd.setTextSize(2);
  M5.Lcd.println("WiFi Setup");
  M5.Lcd.setTextSize(1);
  M5.Lcd.println("\nConnect to WiFi:");
  M5.Lcd.println(myWiFiManager->getConfigPortalSSID()); // "M5-Setup"と出る
  M5.Lcd.println("\nThen open IP:");
  M5.Lcd.println(WiFi.softAPIP());
}

// ★WiFiManagerを使って接続する関数（connectWiFiの代わり）
void connectWiFiManager() {
  WiFiManager wm;

  // 設定モードに入ったときのコールバックを設定
  wm.setAPCallback(configModeCallback);

  // タイムアウト設定（例: 3分間操作がなければ諦めて再起動）
  wm.setConfigPortalTimeout(180);

  // 自動接続を試みる
  // 第1引数: M5Stickが飛ばすWi-Fiの名前
  // 第2引数: そのWi-Fiのパスワード（空欄でもOK）
  bool res = wm.autoConnect("M5-Setup"); 

  if(!res) {
    M5.Lcd.println("Failed to connect");
    delay(3000);
    ESP.restart(); // タイムアウトしたら再起動
  }

  // ここに来たら接続成功
  M5.Lcd.fillScreen(BLACK);
  M5.Lcd.setCursor(0,0);
  M5.Lcd.println("WiFi Connected!");
  M5.Lcd.print("IP: ");
  M5.Lcd.println(WiFi.localIP());
}

void ensureConnections() {
  // Wi-Fiが切れていたら、WiFiManagerではなく単に再接続を試みるのが安全
  if (WiFi.status() != WL_CONNECTED) {
     // 運用中に切れた場合、ESP32は自動で再接続しようとしますが、
     // どうしてもだめならリセットするのが一番確実です
     ESP.restart();
  }
  if (!mqtt.connected()) {
    reconnectMQTT();
  }
}

float magnitudeG(float ax, float ay, float az) {
  return sqrtf(ax * ax + ay * ay + az * az);
}

void setup() {
  M5.begin();
  
  M5.Lcd.setRotation(1);
  M5.Lcd.fillScreen(BLACK);
  M5.Lcd.setTextColor(WHITE, BLACK);

  connectWiFiManager(); 
  
  macAddress = WiFi.macAddress();
  M5.Lcd.println("MAC: " + macAddress);

  playerId = String(DEFAULT_PLAYER_ID);
  showPlayer();

  mqtt.setServer(MQTT_HOST, MQTT_PORT);

  float ax, ay, az;
  M5.Imu.getAccel(&ax, &ay, &az);
  prevMag = magnitudeG(ax, ay, az);

  M5.Lcd.println("\nReady!");
}

void loop() {
  M5.update();
  ensureConnections();
  mqtt.loop();

  if (M5.BtnB.wasPressed()) {
    playerId = (playerId == "player1") ? "player2" : "player1";
    showPlayer();
  }

  if (M5.BtnA.wasPressed()) {
    String payload = "{\"id\":\"" + macAddress + "\",\"event\":\"connect\",\"playerId\":\"" + playerId + "\"}";
    bool ok = mqtt.publish(TOPIC_CONTROLLER, payload.c_str());

    M5.Lcd.setCursor(0, 100);
    M5.Lcd.printf("SEND connect: %s\n", ok ? "OK" : "FAIL");
  }
  
  const uint32_t now = millis();
  if (now - lastSampleMs < SAMPLE_INTERVAL_MS) return;
  lastSampleMs = now;

  float ax, ay, az;
  M5.Imu.getAccel(&ax, &ay, &az);

  float mag = magnitudeG(ax, ay, az);
  float delta = fabsf(mag - prevMag);
  prevMag = mag;

  // デバッグ表示
  M5.Lcd.setCursor(0, 60);
  M5.Lcd.setTextSize(1);
  M5.Lcd.printf("|a|=%.2fg d=%.2f   \n", mag, delta);

  if (delta >= RUN_DELTA_THRESHOLD_G && (now - lastRunSentMs) >= RUN_COOLDOWN_MS) {
    String topic = buildRunTopic();
    bool ok = mqtt.publish(topic.c_str(), "run");
    lastRunSentMs = now;
    M5.Lcd.setCursor(0, 80);
    M5.Lcd.printf("SEND run: %s\n", ok ? "OK" : "FAIL");
  }
}