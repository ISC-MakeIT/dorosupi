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

// ===== マイク判定パラメータ =====
static const float VOICE_THRESHOLD = 1000.0f; // 音声検知のしきい値
static const uint32_t MIC_SAMPLE_SIZE = 128;  // マイクサンプリングサイズ
static const uint32_t VOICE_COOLDOWN_MS = 400; // 音声送信のクールダウン

// ===== 操作モード =====
enum ControlMode {
  MODE_MOTION,  // 振って操作
  MODE_VOICE    // 声で操作
};

ControlMode currentMode = MODE_MOTION; // デフォルトは振って操作

WiFiClient espClient;
PubSubClient mqtt(espClient);

float prevMag = 1.0f;
uint32_t lastSampleMs = 0;
uint32_t lastRunSentMs = 0;
uint32_t lastVoiceSentMs = 0;

int16_t micBuffer[MIC_SAMPLE_SIZE];

String buildRunTopic() {
  return String(TOPIC_RUN_BASE) + "/" + playerId;
}

void showPlayer() {
  M5.Lcd.fillRect(0, 10, 240, 30, BLACK);
  M5.Lcd.setCursor(10, 15);
  M5.Lcd.setTextSize(3);
  M5.Lcd.printf("%s", playerId.c_str());
  M5.Lcd.setTextSize(1);
}

void showMode() {
  M5.Lcd.fillRect(0, 50, 240, 30, BLACK);
  M5.Lcd.setCursor(10, 55);
  M5.Lcd.setTextSize(2);
  if (currentMode == MODE_MOTION) {
    M5.Lcd.setTextColor(CYAN, BLACK);
    M5.Lcd.printf("MOTION");
  } else {
    M5.Lcd.setTextColor(YELLOW, BLACK);
    M5.Lcd.printf("VOICE");
  }
  M5.Lcd.setTextColor(WHITE, BLACK);
  M5.Lcd.setTextSize(1);
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

// マイクから音声レベルを取得
float getVoiceLevel() {
  if (!M5.Mic.record(micBuffer, MIC_SAMPLE_SIZE, 16000)) {
    return 0.0f;
  }
  
  float sum = 0.0f;
  for (int i = 0; i < MIC_SAMPLE_SIZE; i++) {
    sum += abs(micBuffer[i]);
  }
  return sum / MIC_SAMPLE_SIZE;
}

void setup() {
  M5.begin();
  
  M5.Lcd.setRotation(1);
  M5.Lcd.fillScreen(BLACK);
  M5.Lcd.setTextColor(WHITE, BLACK);

  // マイク初期化
  M5.Mic.begin();

  connectWiFiManager(); 
  
  macAddress = WiFi.macAddress();
  playerId = String(DEFAULT_PLAYER_ID);

  mqtt.setServer(MQTT_HOST, MQTT_PORT);

  float ax, ay, az;
  M5.Imu.getAccel(&ax, &ay, &az);
  prevMag = magnitudeG(ax, ay, az);

  // 初期画面表示
  M5.Lcd.fillScreen(BLACK);
  showPlayer();
  showMode();
}

void loop() {
  M5.update();
  ensureConnections();
  mqtt.loop();

  if (M5.BtnB.wasPressed()) {
    playerId = (playerId == "player1") ? "player2" : "player1";
    showPlayer();
  }

  // Cボタン(PWRボタン)でモード切り替え
  if (M5.BtnPWR.wasPressed()) {
    currentMode = (currentMode == MODE_MOTION) ? MODE_VOICE : MODE_MOTION;
    showMode();
  }

  if (M5.BtnA.wasPressed()) {
    String payload = "{\"id\":\"" + macAddress + "\",\"event\":\"connect\",\"playerId\":\"" + playerId + "\"}";
    bool ok = mqtt.publish(TOPIC_CONTROLLER, payload.c_str());

    M5.Lcd.fillRect(0, 90, 240, 40, BLACK);
    M5.Lcd.setCursor(10, 95);
    M5.Lcd.setTextSize(2);
    M5.Lcd.setTextColor(ok ? GREEN : RED, BLACK);
    M5.Lcd.printf("CONNECT");
    M5.Lcd.setTextColor(WHITE, BLACK);
    M5.Lcd.setTextSize(1);
  }
  
  const uint32_t now = millis();
  if (now - lastSampleMs < SAMPLE_INTERVAL_MS) return;
  lastSampleMs = now;

  float ax, ay, az;
  M5.Imu.getAccel(&ax, &ay, &az);

  float mag = magnitudeG(ax, ay, az);
  float delta = fabsf(mag - prevMag);
  prevMag = mag;

  // モーションモード: 加速度センサーで動き検知
  if (currentMode == MODE_MOTION) {
    if (delta >= RUN_DELTA_THRESHOLD_G && (now - lastRunSentMs) >= RUN_COOLDOWN_MS) {
      String topic = buildRunTopic();
      bool ok = mqtt.publish(topic.c_str(), "run");
      lastRunSentMs = now;
      
      M5.Lcd.fillRect(0, 90, 240, 40, BLACK);
      M5.Lcd.setCursor(10, 95);
      M5.Lcd.setTextSize(3);
      M5.Lcd.setTextColor(GREEN, BLACK);
      M5.Lcd.printf("RUN!");
      M5.Lcd.setTextColor(WHITE, BLACK);
      M5.Lcd.setTextSize(1);
    }
  }
  // ボイスモード: マイクで音声検知
  else if (currentMode == MODE_VOICE) {
    float voiceLevel = getVoiceLevel();

    if (voiceLevel >= VOICE_THRESHOLD && (now - lastVoiceSentMs) >= VOICE_COOLDOWN_MS) {
      String topic = buildRunTopic();
      bool ok = mqtt.publish(topic.c_str(), "run");
      lastVoiceSentMs = now;
      
      M5.Lcd.fillRect(0, 90, 240, 40, BLACK);
      M5.Lcd.setCursor(10, 95);
      M5.Lcd.setTextSize(3);
      M5.Lcd.setTextColor(GREEN, BLACK);
      M5.Lcd.printf("RUN!");
      M5.Lcd.setTextColor(WHITE, BLACK);
      M5.Lcd.setTextSize(1);
    }
  }
}