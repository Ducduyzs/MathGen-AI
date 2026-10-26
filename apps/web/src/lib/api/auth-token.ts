// Access token chỉ nằm trong bộ nhớ, không lưu localStorage (tránh bị đọc khi có XSS).

let accessToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export const getAccessToken = () => accessToken;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function onUnauthorized(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

export function notifyUnauthorized() {
  unauthorizedHandler?.();
}
