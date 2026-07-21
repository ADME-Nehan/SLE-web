function cleanText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/\u00a0/g, " ")
    .trim();
}

function normalizeUrl(value) {
  try {
    let input = cleanText(value);

    if (!input) return "";

    if (!input.startsWith("http://") && !input.startsWith("https://")) {
      input = `https://${input}`;
    }

    const url = new URL(input);
    url.hash = "";

    return url.href;
  } catch {
    return "";
  }
}

function getNumberEnv(name, fallback) {
  const value = Number(process.env[name]);

  if (Number.isFinite(value) && value >= 0) {
    return value;
  }

  return fallback;
}

module.exports = {
  cleanText,
  normalizeUrl,
  getNumberEnv
};