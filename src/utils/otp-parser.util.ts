// src/utils/otp-parser.util.ts — Robust Regex OTP extraction

// Decode common HTML entities
function cleanText(raw: string): string {
  if (!raw) return "";
  return raw
    .replace(/<[^>]+>/g, " ") // Strip HTML tags
    .replace(/&nbsp;/gi, " ")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

// Year-like numbers to exclude (e.g. 2024, 2025, 2026)
function isYearLike(code: string): boolean {
  const n = parseInt(code, 10);
  return n >= 1990 && n <= 2099;
}

export function parseOtpFromText(rawText: string): string | null {
  const text = cleanText(rawText);
  if (!text) return null;

  // 1. Prefixed codes: G-123456, FB-123456, etc.
  const prefixMatch = text.match(/\b(?:G|FB|VK|IG|WA)-?(\d{4,8})\b/i);
  if (prefixMatch?.[1] && !isYearLike(prefixMatch[1])) {
    return prefixMatch[1];
  }

  // 2. Explicit patterns: "code: 123456", "OTP: 123456", "PIN is 123456"
  const explicitPatterns = [
    /(?:code|otp|pin|passcode|verification code|security code|login code|confirmation code)[:\s]+([0-9]{4,8})/gi,
    /([0-9]{4,8})\s+(?:is your|as your)\s+(?:verification|security|login|otp|one-time|passcode|confirmation|access)/gi,
    /(?:use|enter|your)\s+(?:code|otp|pin)[\s:]+([0-9]{4,8})/gi,
    /one-time\s+(?:password|passcode|code)[:\s]+([0-9]{4,8})/gi,
    /\b(?:code|otp|pin)[:\s=]+([0-9]{4,8})\b/gi,
  ];

  for (const pattern of explicitPatterns) {
    pattern.lastIndex = 0;
    const match = pattern.exec(text);
    if (match?.[1] && !isYearLike(match[1])) {
      return match[1];
    }
  }

  // 3. Formatted codes: 123-456 or 123 456
  const formattedMatch = text.match(/\b(\d{3})[- ](\d{3})\b/);
  if (formattedMatch?.[1] && formattedMatch?.[2]) {
    const combined = `${formattedMatch[1]}${formattedMatch[2]}`;
    if (!isYearLike(combined)) {
      return combined;
    }
  }

  // 4. Broad check: If email body/subject mentions verification/security/login keywords
  const isOtpEmail = /otp|code|verification|verify|security|passcode|one-time|2fa|login|auth|confirm|access/i.test(
    text
  );

  if (isOtpEmail) {
    // Try 6-digit number first
    const m6 = text.match(/\b(\d{6})\b/);
    if (m6?.[1] && !isYearLike(m6[1])) return m6[1];

    // Try 5-digit number
    const m5 = text.match(/\b(\d{5})\b/);
    if (m5?.[1]) return m5[1];

    // Try 4-digit number
    const m4 = text.match(/\b(\d{4})\b/);
    if (m4?.[1] && !isYearLike(m4[1])) return m4[1];

    // Try 7-8 digit number
    const m8 = text.match(/\b(\d{7,8})\b/);
    if (m8?.[1]) return m8[1];
  }

  return null;
}

export function extractSenderName(fromHeader: string): string {
  if (!fromHeader) return "Unknown Sender";
  // "Display Name <email@domain.com>"
  const nameMatch = fromHeader.match(/^"?([^"<]+)"?\s*</);
  if (nameMatch?.[1]?.trim()) return nameMatch[1].trim();

  // Fallback: extract domain name
  const domainMatch = fromHeader.match(/@([^.>\s]+)/);
  if (domainMatch?.[1]) {
    const d = domainMatch[1];
    return d.charAt(0).toUpperCase() + d.slice(1);
  }
  return fromHeader;
}

export function extractSenderEmail(fromHeader: string): string {
  if (!fromHeader) return "";
  const match = fromHeader.match(/<(.+?)>/);
  return match?.[1] ?? fromHeader.trim();
}
