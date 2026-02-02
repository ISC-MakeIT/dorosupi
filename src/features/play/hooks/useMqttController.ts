"use client";

import mqtt, { type MqttClient } from "mqtt";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ControllerPayload } from "@/features/play/types";

interface UseMqttControllerParams {
  topic?: string;
  onPayload?: (payload: ControllerPayload) => void;
  multiPlayer?: boolean;
}

const DEFAULT_TOPIC = process.env.NEXT_PUBLIC_MQTT_TOPIC || "m5stick/buttons";
const CONTROLLER_TOPIC = "dorosupi/controller";

function getBrokerUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_MQTT_BROKER_URL || "";
  if (!baseUrl) return "";

  // 本番環境（HTTPS）では ws:// を wss:// に変換
  if (typeof window !== "undefined" && window.location.protocol === "https:") {
    return baseUrl.replace(/^ws:\/\//, "wss://");
  }
  return baseUrl;
}

const BROKER_URL = getBrokerUrl();
const MQTT_USER = process.env.NEXT_PUBLIC_MQTT_USER || "";
const MQTT_PASS = process.env.NEXT_PUBLIC_MQTT_PASS || "";

function buildClientId() {
  return `dorosupi-${Math.random().toString(16).slice(2, 10)}`;
}

function normalizePayload(
  rawPayload: Buffer,
  receivedTopic?: string,
): ControllerPayload {
  const raw = rawPayload.toString();

  // トピックからplayerIdを抽出 (例: "yokohama/hackathon/running/player1" -> "player1")
  const playerId = receivedTopic?.split("/").pop();

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const dx =
      typeof parsed.dx === "number"
        ? parsed.dx
        : typeof parsed.x === "number"
          ? parsed.x
          : undefined;
    const dy =
      typeof parsed.dy === "number"
        ? parsed.dy
        : typeof parsed.y === "number"
          ? parsed.y
          : undefined;
    const buttonCandidate =
      typeof parsed.button === "string"
        ? parsed.button
        : typeof parsed.key === "string"
          ? parsed.key
          : undefined;
    const step = typeof parsed.step === "number" ? parsed.step : undefined;
    const event =
      parsed.event === "connect"
        ? ("connect" as const)
        : parsed.event === "run"
          ? ("run" as const)
          : undefined;
    const id = typeof parsed.id === "string" ? parsed.id : undefined;

    return {
      raw,
      playerId,
      dx,
      dy,
      button: buttonCandidate?.toLowerCase(),
      step,
      event,
      id,
    };
  } catch (_err) {
    const button = raw.trim().toLowerCase();
    return { raw, playerId, button };
  }
}

export function useMqttController({
  topic = DEFAULT_TOPIC,
  onPayload,
  multiPlayer = false,
}: UseMqttControllerParams) {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastPayload, setLastPayload] = useState<ControllerPayload | null>(
    null,
  );
  const clientRef = useRef<MqttClient | null>(null);
  const onPayloadRef = useRef(onPayload);

  useEffect(() => {
    onPayloadRef.current = onPayload;
  }, [onPayload]);

  const canConnect = useMemo(() => Boolean(BROKER_URL), []);

  useEffect(() => {
    if (!canConnect) {
      setError("MQTTの接続先が設定されていません");
      return;
    }

    setConnecting(true);
    const client = mqtt.connect(BROKER_URL, {
      clientId: buildClientId(),
      clean: true,
      username: MQTT_USER,
      password: MQTT_PASS,
    });

    clientRef.current = client;

    client.on("connect", () => {
      setConnected(true);
      setConnecting(false);
      setError(null);

      // マルチプレイヤーモードの場合はワイルドカードトピック使用
      const subscriptionTopic = multiPlayer
        ? topic.replace(/\/player\d+$/, "/+") // "player1" -> "+"
        : topic;

      const topicsToSubscribe = [subscriptionTopic, CONTROLLER_TOPIC];
      client.subscribe(topicsToSubscribe, (subscribeError) => {
        if (subscribeError) {
          setError(subscribeError.message);
        }
      });
    });

    client.on("message", (receivedTopic, payload) => {
      const normalized = normalizePayload(payload as Buffer, receivedTopic);
      setLastPayload(normalized);
      onPayloadRef.current?.(normalized);
    });

    client.on("error", (err) => {
      setError(err.message);
    });

    client.on("close", () => {
      setConnected(false);
      setConnecting(false);
    });

    return () => {
      client.end(true);
      clientRef.current = null;
    };
  }, [canConnect, topic, multiPlayer]);

  return {
    connected,
    connecting,
    error,
    lastPayload,
    enabled: canConnect,
  };
}
