import { CODE_ALPHABET, PASSWORD_LENGTH, USERNAME_CODE_LENGTH } from "./constants";

/** Vietnamese letters → plain ASCII: "Nguyễn Thị Ánh Đào" → "Nguyen Thi Anh Dao". */
export function stripDiacritics(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

/** Vietnamese names are family, middle, given: the given name is the last word. */
export function givenName(fullName: string): string {
  const words = fullName.trim().split(/\s+/);
  return words[words.length - 1] ?? "";
}

/**
 * The lookup key for a username. Case, spaces, dots and diacritics don't matter, so a child can type "an.k7m4",
 * "AN K7M4" or "ank7m4" and reach the same account.
 */
export function normalizeUsername(s: string): string {
  return stripDiacritics(s)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Random characters from an alphabet a child can't misread. Rejection sampling keeps every character equally likely.
 * `crypto` is the Web Crypto global: the Worker, the browser and Node 18+ all have it.
 */
export function randomCode(length: number): string {
  const limit = 256 - (256 % CODE_ALPHABET.length);
  let out = "";
  while (out.length < length) {
    const bytes = crypto.getRandomValues(new Uint8Array(length * 2));
    for (const b of bytes) {
      if (b >= limit) continue;
      out += CODE_ALPHABET[b % CODE_ALPHABET.length];
      if (out.length === length) break;
    }
  }
  return out;
}

/** The part of a username a child recognises: their given name, in plain lowercase letters. */
export function usernameStem(fullName: string): string {
  const plain = stripDiacritics(fullName).replace(/[^A-Za-z0-9\s]/g, " ").trim();
  // A number is never a name, even when the teacher typed a group number after it.
  const words = plain.split(/\s+/).filter((w) => /[A-Za-z]/.test(w));
  return (words[words.length - 1] ?? "").toLowerCase() || "hocsinh";
}

/**
 * A username for a new account: "an.k7m4". The given name so a child knows which one is theirs, then four random
 * characters so two children called An never share one, and nobody can guess a classmate's account from their name.
 */
export function newUsername(fullName: string): string {
  return `${usernameStem(fullName)}.${randomCode(USERNAME_CODE_LENGTH)}`;
}

/**
 * A password for a child: six characters they can't misread. The teacher can always read it back, so a parent who
 * asks gets an answer without anyone resetting anything.
 */
export function newStudentPassword(): string {
  return randomCode(PASSWORD_LENGTH);
}

/**
 * Brief 6: "tên lót-tên-ngày sinh. Ví dụ: minhanh27; hoaian22; ngocanh01". The last two words of the name — the one
 * before the given name, then the given name — and the day of birth in two digits. A name of two words is a family
 * name and a given name, so only the given name is taken. Without a birthday, the name alone.
 */
export function usernameFor(fullName: string, birthday: string | null | undefined): string {
  const words = stripDiacritics(fullName)
    .replace(/[^A-Za-z\s]/g, " ")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const name = (words.length >= 3 ? words.slice(-2) : words.slice(-1)).join("") || "hocsinh";
  const day = birthday && /^\d{4}-\d{2}-\d{2}$/.test(birthday) ? birthday.slice(8, 10) : "";
  return `${name}${day}`;
}

/** "b", "c" … "z", "ba", "bb" …: what goes after a username that is already taken. Never "a", which reads as a word. */
function suffix(n: number): string {
  const letters = "abcdefghijklmnopqrstuvwxyz";
  let out = "";
  for (let k = n; k > 0; k = Math.floor(k / 26)) out = letters[k % 26]! + out;
  return out;
}

/** The pattern if it is free, otherwise the pattern and a letter: "minhanh27", "minhanh27b", "minhanh27c"… */
export function pickUsername(base: string, taken: ReadonlySet<string>): string {
  for (let n = 0; ; n++) {
    const candidate = `${base}${suffix(n)}`;
    if (!taken.has(normalizeUsername(candidate))) return candidate;
  }
}
