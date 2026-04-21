// ============================================================
//  api/auth.js — Supabase adapter
//  Zmienne env: SUPABASE_URL, SUPABASE_SERVICE_KEY
//  Zachowany admin_email fallback
// ============================================================

var crypto = require("crypto");

var ADMIN_EMAIL = "janpawel212121@gmail.com";

var headers = {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
};

// ── Supabase REST helper ─────────────────────────────────
function supa(url, token, method, path, body) {
    return fetch(url + "/rest/v1/" + path, {
        method:  method || "GET",
        headers: {
            "apikey":        token,
            "Authorization": "Bearer " + token,
            "Content-Type":  "application/json",
            "Prefer":        "return=representation"
        },
        body: body ? JSON.stringify(body) : undefined
    }).then(function(r) { return r.json(); });
}

// RPC call
function rpc(url, token, fn, params) {
    return fetch(url + "/rest/v1/rpc/" + fn, {
        method:  "POST",
        headers: {
            "apikey":        token,
            "Authorization": "Bearer " + token,
            "Content-Type":  "application/json"
        },
        body: JSON.stringify(params || {})
    }).then(function(r) { return r.json(); });
}

function hashPass(pass) {
    return crypto.createHash("sha256").update(pass + "_roboai_salt").digest("hex");
}
function makeToken() {
    return "sess_" + crypto.randomBytes(20).toString("hex");
}
function makeConnectCode() {
    return "rc_" + crypto.randomBytes(8).toString("hex");
}

// ─────────────────────────────────────────────────────────
exports.handler = async function(event) {
    if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
    if (event.httpMethod !== "POST")    return { statusCode: 405, headers, body: JSON.stringify({ error: "POST only" }) };

    var SUPA_URL = process.env.SUPABASE_URL;
    var SUPA_KEY = process.env.SUPABASE_SERVICE_KEY;

    if (!SUPA_URL || !SUPA_KEY) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: "Supabase not configured" }) };
    }

    try {
        var body   = JSON.parse(event.body || "{}");
        var action = body.action;

        // ── REGISTER ────────────────────────────────────────
        if (action === "register") {
            var username = (body.username || "").trim();
            var email    = (body.email    || "").trim().toLowerCase();
            var password = body.password  || "";

            if (!username || username.length < 3)   return { statusCode: 400, headers, body: JSON.stringify({ error: "Nazwa min 3 znaki" }) };
            if (!email || !email.includes("@"))      return { statusCode: 400, headers, body: JSON.stringify({ error: "Niepoprawny email" }) };
            if (!password || password.length < 6)    return { statusCode: 400, headers, body: JSON.stringify({ error: "Hasło min 6 znaków" }) };

            // Check username
            var existing = await supa(SUPA_URL, SUPA_KEY, "GET",
                "profiles?username=eq." + encodeURIComponent(username) + "&select=id");
            if (Array.isArray(existing) && existing.length > 0) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: "Nazwa zajęta" }) };
            }

            // Check email
            var emailCheck = await supa(SUPA_URL, SUPA_KEY, "GET",
                "profiles?email=eq." + encodeURIComponent(email) + "&select=id");
            if (Array.isArray(emailCheck) && emailCheck.length > 0) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: "Email już zarejestrowany" }) };
            }

            var role = email === ADMIN_EMAIL ? "admin" : "user";

            // Insert profile
            var newProfiles = await supa(SUPA_URL, SUPA_KEY, "POST", "profiles", {
                username:      username,
                email:         email,
                password_hash: hashPass(password),
                role:          role,
                credits:       10,
                usage_count:   0
            });
            var newProfile = Array.isArray(newProfiles) ? newProfiles[0] : newProfiles;
            if (!newProfile || !newProfile.id) {
                return { statusCode: 500, headers, body: JSON.stringify({ error: "Błąd tworzenia konta" }) };
            }

            // Create session
            var token = makeToken();
            await supa(SUPA_URL, SUPA_KEY, "POST", "sessions", {
                session_token: token,
                user_id:       newProfile.id,
                expires_at:    new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString()
            });

            // Create connect code
            var connectCode = makeConnectCode();
            await supa(SUPA_URL, SUPA_KEY, "POST", "connect_codes", {
                code:       connectCode,
                user_id:    newProfile.id,
                expires_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString()
            });

            return {
                statusCode: 200, headers,
                body: JSON.stringify({
                    success:      true,
                    userId:       newProfile.id,
                    username:     username,
                    email:        email,
                    sessionToken: token,
                    connectCode:  connectCode,
                    credits:      10,
                    usage:        0,
                    isAdmin:      role === "admin"
                })
            };
        }

        // ── LOGIN ────────────────────────────────────────────
        if (action === "login") {
            var loginEmail = (body.email    || "").trim().toLowerCase();
            var loginPass  =  body.password || "";
            if (!loginEmail || !loginPass) return { statusCode: 400, headers, body: JSON.stringify({ error: "Podaj email i hasło" }) };

            var users = await supa(SUPA_URL, SUPA_KEY, "GET",
                "profiles?email=eq." + encodeURIComponent(loginEmail) + "&select=id,username,email,password_hash,role,credits,usage_count");

            if (!Array.isArray(users) || users.length === 0) {
                return { statusCode: 401, headers, body: JSON.stringify({ error: "Błędny email lub hasło" }) };
            }
            var user = users[0];
            if (user.password_hash !== hashPass(loginPass)) {
                return { statusCode: 401, headers, body: JSON.stringify({ error: "Błędny email lub hasło" }) };
            }

            var loginToken = makeToken();
            await supa(SUPA_URL, SUPA_KEY, "POST", "sessions", {
                session_token: loginToken,
                user_id:       user.id,
                expires_at:    new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString()
            });

            var loginCode = makeConnectCode();
            await supa(SUPA_URL, SUPA_KEY, "POST", "connect_codes", {
                code:       loginCode,
                user_id:    user.id,
                expires_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString()
            });

            return {
                statusCode: 200, headers,
                body: JSON.stringify({
                    success:      true,
                    userId:       user.id,
                    username:     user.username,
                    email:        user.email,
                    sessionToken: loginToken,
                    connectCode:  loginCode,
                    credits:      user.credits,
                    usage:        user.usage_count,
                    isAdmin:      user.role === "admin" || user.email === ADMIN_EMAIL
                })
            };
        }

        // ── VERIFY SESSION ───────────────────────────────────
        if (action === "verify") {
            var verifyToken = body.sessionToken;
            if (!verifyToken) return { statusCode: 400, headers, body: JSON.stringify({ error: "Token required" }) };

            var sessRows = await supa(SUPA_URL, SUPA_KEY, "GET",
                "sessions?session_token=eq." + encodeURIComponent(verifyToken) +
                "&expires_at=gt." + new Date().toISOString() +
                "&select=user_id");
            if (!Array.isArray(sessRows) || sessRows.length === 0) {
                return { statusCode: 401, headers, body: JSON.stringify({ error: "INVALID_SESSION" }) };
            }
            var userId = sessRows[0].user_id;

            var profRows = await supa(SUPA_URL, SUPA_KEY, "GET",
                "profiles?id=eq." + userId + "&select=id,username,email,role,credits,usage_count");
            if (!Array.isArray(profRows) || profRows.length === 0) {
                return { statusCode: 401, headers, body: JSON.stringify({ error: "INVALID_SESSION" }) };
            }
            var prof = profRows[0];

            // Fresh connect code
            var vCode = makeConnectCode();
            await supa(SUPA_URL, SUPA_KEY, "POST", "connect_codes", {
                code:       vCode,
                user_id:    userId,
                expires_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString()
            });

            return {
                statusCode: 200, headers,
                body: JSON.stringify({
                    success:     true,
                    userId:      prof.id,
                    username:    prof.username,
                    email:       prof.email,
                    connectCode: vCode,
                    credits:     prof.credits,
                    usage:       prof.usage_count,
                    isAdmin:     prof.role === "admin" || prof.email === ADMIN_EMAIL
                })
            };
        }

        return { statusCode: 400, headers, body: JSON.stringify({ error: "Unknown action" }) };

    } catch (err) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
};

// ── Vercel adapter ──────────────────────────────────────
const originalHandler = exports.handler;
module.exports = async function(req, res) {
    try {
        var event = {
            httpMethod: req.method,
            body: req.method === "GET" ? null : (typeof req.body === "string" ? req.body : JSON.stringify(req.body || {})),
            queryStringParameters: req.query || {}
        };
        var result = await originalHandler(event, {});
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
        if (result && result.headers) {
            for (const [k, v] of Object.entries(result.headers)) res.setHeader(k, v);
        }
        res.status(result.statusCode || 200).send(result.body || "");
    } catch (e) {
        res.status(500).send(JSON.stringify({ error: "Internal Server Error" }));
    }
};
