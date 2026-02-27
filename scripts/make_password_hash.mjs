import crypto from "node:crypto";

function b64(buf) { return buf.toString("base64"); }

async function pbkdf2(password, salt, iterations) {
  return await new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, iterations, 32, "sha256", (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

const password = process.argv[2];
if (!password) {
  console.error("Usage: node scripts/make_password_hash.mjs <password>");
  process.exit(1);
}

const iterations = 120000;
const salt = crypto.randomBytes(16);
const hash = await pbkdf2(password, salt, iterations);

console.log(`pbkdf2$${iterations}$${b64(salt)}$${b64(hash)}`);
