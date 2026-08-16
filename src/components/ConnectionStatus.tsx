import { AlertTriangle, LoaderCircle, Wifi, WifiOff } from "lucide-react";
import type { ConnectionState } from "../game/types";

const stateCopy: Record<ConnectionState, string> = {
  connecting: "Offline",
  connected: "Online",
  reconnecting: "Offline",
  offline: "Offline",
  "configuration-error": "Offline",
};

export function ConnectionStatus({
  state,
  compact = false,
}: {
  state: ConnectionState;
  compact?: boolean;
}) {
  const Icon =
    state === "connected"
      ? Wifi
      : state === "configuration-error"
        ? AlertTriangle
        : state === "offline"
          ? WifiOff
          : LoaderCircle;
  const className =
    state === "connected"
      ? "success"
      : state === "configuration-error" || state === "offline"
        ? "error"
        : "";
  return (
    <span
      className={`connection-status ${className}`}
      role="status"
      aria-live="polite"
    >
      <Icon
        className={`connection-icon ${state === "connecting" || state === "reconnecting" ? "spin" : ""}`}
        size={compact ? 15 : 17}
        aria-hidden="true"
      />
      {!compact && stateCopy[state]}
      {compact && <span className="sr-only">{stateCopy[state]}</span>}
    </span>
  );
}
