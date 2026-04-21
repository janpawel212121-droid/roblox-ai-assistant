// ============================================================
//  api/status.js — Supabase adapter
//  Sprawdza czy plugin jest podłączony (czytając ostatni ping)
// ============================================================

var headers = {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": "application/json"
};

function supa(url, token, method, path) {
    return fetch(url + "/rest/v1/" + path, {
        method:  method,
        headers: {
            "apikey":        token,
            "Authorization": "Bearer " + token,
            "Content-Type":  "application/json",
            "Prefer":        "return=representation"
        }
    }).then(function(r) { return r.json(); });
}

exports.handler = async function(event) {
    if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };

    var SUPA_URL = process.env.SUPABASE_URL;
    var SUPA_KEY = process.env.SUPABASE_SERVICE_KEY;

    try {
        var params      = event.queryStringParameters || {};
        var connectCode = params.cc || "";

        if (!connectCode) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing cc", online: false }) };
        }

        // Validate connect code & get user
        var codeRows = await supa(SUPA_URL, SUPA_KEY, "GET",
            "connect_codes?code=eq." + encodeURIComponent(connectCode) +
            "&select=user_id");

        if (!Array.isArray(codeRows) || codeRows.length === 0) {
            return { statusCode: 200, headers, body: JSON.stringify({ online: false }) };
        }

        var userId = codeRows[0].user_id;

        // Fetch ping settings for this user
        var settingsRows = await supa(SUPA_URL, SUPA_KEY, "GET",
            "settings?key=eq.ping_" + userId + "&select=value");

        if (!Array.isArray(settingsRows) || settingsRows.length === 0) {
            return { statusCode: 200, headers, body: JSON.stringify({ online: false }) };
        }

        var lastPing = parseInt(settingsRows[0].value, 10);
        var isOnline = (Date.now() - lastPing) < 30000; // 30 sekund marginesu (plugin pinguje co 2s)

        return {
            statusCode: 200, headers,
            body: JSON.stringify({ online: isOnline })
        };

    } catch (err) {
        return { statusCode: 500, headers, body: JSON.stringify({ online: false, error: err.message }) };
    }
};

// Vercel adapter
const originalHandler = exports.handler;
module.exports = async function(req, res) {
    try {
        var event = {
            httpMethod: req.method,
            body: null,
            queryStringParameters: req.query || {}
        };
        var result = await originalHandler(event, {});
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
        res.status(result.statusCode || 200).send(result.body || "");
    } catch (e) {
        res.status(500).send(JSON.stringify({ online: false }));
    }
};
