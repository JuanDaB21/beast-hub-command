// Obtiene el GMAIL_REFRESH_TOKEN (scope gmail.readonly) para la importación
// automática de pedidos. Se corre UNA vez en el PC del dueño del Gmail.
//
//   1. Poner GMAIL_CLIENT_ID y GMAIL_CLIENT_SECRET en .env.local
//      (credencial OAuth tipo "App de escritorio" de Google Cloud).
//   2. node scripts/gmail-auth.mjs
//   3. Abrir la URL que imprime, aceptar con la cuenta de Gmail que recibe
//      las notificaciones de Shopify.
//   4. Copiar el refresh token impreso a las variables de Railway.
//
// Sin dependencias: flujo OAuth "loopback" con un servidor HTTP local efímero.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envFile = path.join(ROOT, ".env.local");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const clientId = process.env.GMAIL_CLIENT_ID;
const clientSecret = process.env.GMAIL_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  console.error("Falta GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET en .env.local");
  process.exit(1);
}

const SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  if (!code && !error) {
    res.writeHead(404).end();
    return;
  }
  if (error) {
    res.end(`Autorización cancelada: ${error}. Puedes cerrar esta pestaña.`);
    console.error(`Autorización cancelada: ${error}`);
    server.close();
    return;
  }
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }).toString(),
    });
    const body = await tokenRes.json();
    if (!body.refresh_token) throw new Error(JSON.stringify(body));
    res.end("Listo. Vuelve a la terminal. Puedes cerrar esta pestaña.");
    console.log("\nGMAIL_REFRESH_TOKEN (cópialo a Railway; no lo compartas):\n");
    console.log(body.refresh_token + "\n");
  } catch (err) {
    res.end("Falló el intercambio del código. Revisa la terminal.");
    console.error("Falló el intercambio del código:", err.message);
  } finally {
    server.close();
  }
});

let redirectUri = "";
server.listen(0, "127.0.0.1", () => {
  redirectUri = `http://127.0.0.1:${server.address().port}`;
  const authUrl =
    "https://accounts.google.com/o/oauth2/v2/auth?" +
    new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: SCOPE,
      access_type: "offline",
      prompt: "consent",
    }).toString();
  console.log("Abre esta URL en el navegador y autoriza con la cuenta de Gmail:\n");
  console.log(authUrl + "\n");
});
