let connected = true;
export function updateConnection(value: boolean) {
  connected = value;
}
export function isDeviceOnline() {
  return connected && navigator.onLine;
}
