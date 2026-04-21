// ============================================================
//  api/admin.js — Supabase adapter
//  Zarządzanie kredytami, kluczem API
// ============================================================

var headers = {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
};

function supa(url, token, method, path, body) {
    return fetch(url + "/rest/v1/" + path, {
        method:  method || "GET",
        headers: {
            "apikey":        token,
            "Authorization": "Bearer " + token,
            "Content-Type":  "application/json",
            "Prefer":        "return=representation"
        },
        body: body !== undefined ? JSON.stringify(body) : undefined
    }).then(function(r) { return r.json(); });
}

exports.handler = async function(event) {
    if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
    if (event.httpMethod !== "POST")    return { statusCode: 405, headers, body: JSON.stringify({ error: "POST only" }) };

    var SUPA_URL = process.env.SUPABASE_URL;
    var SUPA_KEY = process.env.SUPABASE_SERVICE_KEY;

    try {
        var body     = JSON.parse(event.body || "{}");
        var password = body.password;
        var action   = body.action;

        // Password check
        var adminPass = process.env.ADMIN_PASSWORD || "SIGMAOHIO";
        if (!password || password !== adminPass) {
            return { statusCode: 403, headers, body: JSON.stringify({ ok: false, error: "Nieprawidłowe hasło" }) };
        }

        // ── Add credits ──────────────────────────────────────
        if (action === "addCredits") {
            var targetId = body.userId; // can be UUID, username, or email
            var amount   = Number(body.amount);
            if (!targetId) return { statusCode: 400, headers, body: JSON.stringify({ error: "userId required" }) };
            if (!amount || amount <= 0) return { statusCode: 400, headers, body: JSON.stringify({ error: "amount invalid" }) };

            // Find user — try by id, username, or email
            var rows = await supa(SUPA_URL, SUPA_KEY, "GET",
                "profiles?or=(id.eq." + encodeURIComponent(targetId) +
                ",username.eq." + encodeURIComponent(targetId) +
                ",email.eq." + encodeURIComponent(targetId) + ")&select=id,username,email,credits&limit=1");

            if (!Array.isArray(rows) || rows.length === 0) {
                return { statusCode: 404, headers, body: JSON.stringify({ ok: false, error: "Użytkownik nie znaleziony (sprawdź email)" }) };
            }
            var user = rows[0];
            var newCredits = user.credits + amount;
            await supa(SUPA_URL, SUPA_KEY, "PATCH",
                "profiles?id=eq." + user.id,
                { credits: newCredits });

            return {
                statusCode: 200, headers,
                body: JSON.stringify({ ok: true, userId: user.id, username: user.username, email: user.email, added: amount, total: newCredits })
            };
        }

        // ── Set credits exact ────────────────────────────────
        if (action === "setCredits") {
            var setId     = body.userId;
            var setAmount = Number(body.amount);
            if (!setId) return { statusCode: 400, headers, body: JSON.stringify({ error: "userId required" }) };

            await supa(SUPA_URL, SUPA_KEY, "PATCH",
                "profiles?or=(id.eq." + encodeURIComponent(setId) + ",username.eq." + encodeURIComponent(setId) + ")",
                { credits: setAmount });

            return { statusCode: 200, headers, body: JSON.stringify({ ok: true, userId: setId, credits: setAmount }) };
        }

        // ── Get user info ────────────────────────────────────
        if (action === "getUser") {
            var lookupId = body.userId;
            if (!lookupId) return { statusCode: 400, headers, body: JSON.stringify({ error: "userId required" }) };

            var uRows = await supa(SUPA_URL, SUPA_KEY, "GET",
                "profiles?or=(id.eq." + encodeURIComponent(lookupId) + ",username.eq." + encodeURIComponent(lookupId) +
                ",email.eq." + encodeURIComponent(lookupId) + ")&select=id,username,email,role,credits,usage_count,created_at");

            if (!Array.isArray(uRows) || uRows.length === 0) {
                return { statusCode: 404, headers, body: JSON.stringify({ ok: false, error: "Nie znaleziono" }) };
            }
            return { statusCode: 200, headers, body: JSON.stringify({ ok: true, user: uRows[0] }) };
        }

        // ── Set global API key ───────────────────────────────
        if (action === "setApiKey") {
            var apiKey = (body.apiKey || "").trim();
            if (!apiKey) return { statusCode: 400, headers, body: JSON.stringify({ error: "apiKey required" }) };

            // Upsert into settings
            await fetch(SUPA_URL + "/rest/v1/settings", {
                method: "POST",
                headers: {
                    "apikey":        SUPA_KEY,
                    "Authorization": "Bearer " + SUPA_KEY,
                    "Content-Type":  "application/json",
                    "Prefer":        "resolution=merge-duplicates"
                },
                body: JSON.stringify({ key: "groq_api_key", value: apiKey })
            });

            return { statusCode: 200, headers, body: JSON.stringify({ ok: true, message: "Klucz API zaktualizowany" }) };
        }

        // ── Get global API key ───────────────────────────────
        if (action === "getApiKey") {
            var kRows = await supa(SUPA_URL, SUPA_KEY, "GET", "settings?key=eq.groq_api_key&select=value");
            var key   = Array.isArray(kRows) && kRows.length > 0 ? kRows[0].value : "";

            return {
                statusCode: 200, headers,
                body: JSON.stringify({ ok: true, apiKey: key ? (key.substring(0, 8) + "...") : "(brak)" })
            };
        }

        return { statusCode: 400, headers, body: JSON.stringify({ error: "Unknown admin action" }) };

    } catch (err) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
};

// Vercel adapter
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
