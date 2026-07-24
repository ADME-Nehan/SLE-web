export function saveAdminToken(token) {
  localStorage.setItem("sle_admin_token", token);
}

export function getAdminToken() {
  return localStorage.getItem("sle_admin_token");
}

export function removeAdminToken() {
  localStorage.removeItem("sle_admin_token");
}

export function isAdminLoggedIn() {
  return Boolean(getAdminToken());
}