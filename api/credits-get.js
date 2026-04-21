// ============================================================
//  api/credits-get.js — Supabase adapter
// ============================================================

var headers = {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": "application/json"
};

exports.handler = async function(event) {
    if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };

    var SUPA_URL = process.env.SUPABASE_URL;
    var SUPA_KEY = process.env.SUPABASE_SERVICE_KEY;

    try {
        var params       = event.queryStringParameters || {};
        var sessionToken = params.sessionToken || "";

        if (!sessionToken) return { statusCode: 401, headers, body: JSON.stringify({ error: "LOGIN_REQUIRED" }) };

        var sessRows = await fetch(SUPA_URL + "/rest/v1/sessions?session_token=eq." + encodeURIComponent(sessionToken) +
            "&expires_at=gt." + new Date().toISOString() + "&select=user_id", {
            headers: { "apikey": SUPA_KEY, "Authorization": "Bearer " + SUPA_KEY }
        }).then(function(r) { return r.json(); });

        if (!Array.isArray(sessRows) || sessRows.length === 0) {
            return { statusCode: 401, headers, body: JSON.stringify({ error: "INVALID_SESSION" }) };
        }
        var userId = sessRows[0].user_id;

        var profRows = await fetch(SUPA_URL + "/rest/v1/profiles?id=eq." + userId + "&select=credits,usage_count", {
            headers: { "apikey": SUPA_KEY, "Authorization": "Bearer " + SUPA_KEY }
        }).then(function(r) { return r.json(); });

        if (!Array.isArray(profRows) || profRows.length === 0) {
            return { statusCode: 404, headers, body: JSON.stringify({ error: "User not found" }) };
        }

        return {
            statusCode: 200, headers,
            body: JSON.stringify({ credits: profRows[0].credits, usage: profRows[0].usage_count })
        };
    } catch (err) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
};

const originalHandler = exports.handler;
module.exports = async function(req, res) {
    try {
        var event = { httpMethod: req.method, body: null, queryStringParameters: req.query || {} };
        var result = await originalHandler(event, {});
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.status(result.statusCode || 200).send(result.body || "");
    } catch (e) {
        res.status(500).send(JSON.stringify({ error: "Internal Server Error" }));
    }
};
