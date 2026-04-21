// ============================================================
//  api/history.js — Supabase adapter
//  Pobiera historię AI dla użytkownika
// ============================================================

var headers = {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": "application/json"
};

function supa(url, token, method, path) {
    return fetch(url + "/rest/v1/" + path, {
        method: method || "GET",
        headers: {
            "apikey":        token,
            "Authorization": "Bearer " + token,
            "Content-Type":  "application/json"
        }
    }).then(function(r) { return r.json(); });
}

exports.handler = async function(event) {
    if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };

    var SUPA_URL = process.env.SUPABASE_URL;
    var SUPA_KEY = process.env.SUPABASE_SERVICE_KEY;

    try {
        var params       = event.queryStringParameters || {};
        var sessionToken = params.sessionToken || "";

        if (!sessionToken) {
            return { statusCode: 401, headers, body: JSON.stringify({ error: "LOGIN_REQUIRED" }) };
        }

        // Verify session
        var sessRows = await supa(SUPA_URL, SUPA_KEY, "GET",
            "sessions?session_token=eq." + encodeURIComponent(sessionToken) +
            "&expires_at=gt." + new Date().toISOString() +
            "&select=user_id");

        if (!Array.isArray(sessRows) || sessRows.length === 0) {
            return { statusCode: 401, headers, body: JSON.stringify({ error: "INVALID_SESSION" }) };
        }
        var userId = sessRows[0].user_id;

        // Fetch history
        var histRows = await supa(SUPA_URL, SUPA_KEY, "GET",
            "ai_history?user_id=eq." + userId +
            "&order=created_at.desc&limit=50" +
            "&select=user_msg,ai_msg,mode,model,cost,created_at");

        var history = (Array.isArray(histRows) ? histRows : []).map(function(h) {
            return {
                userMsg:   h.user_msg,
                aiMsg:     h.ai_msg,
                mode:      h.mode,
                model:     h.model,
                cost:      h.cost,
                timestamp: new Date(h.created_at).getTime()
            };
        });

        return {
            statusCode: 200, headers,
            body: JSON.stringify({ history: history })
        };

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
            body: null,
            queryStringParameters: req.query || {}
        };
        var result = await originalHandler(event, {});
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
        res.status(result.statusCode || 200).send(result.body || "");
    } catch (e) {
        res.status(500).send(JSON.stringify({ error: "Internal Server Error" }));
    }
};
