// ============================================================
//  api/chat.js — Supabase adapter
//  Obsługuje AI chat + addTasks (kolejka do pluginu)
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
        var body = JSON.parse(event.body || "{}");

        // ── ENQUEUE TASKS (from frontend → plugin) ──────────
        if (body.action === "addTasks" || body.action === "addTask") {
            var userId = body.userId;
            if (!userId) return { statusCode: 400, headers, body: JSON.stringify({ error: "userId required" }) };

            var tasks = body.tasks || (body.task ? [body.task] : []);
            if (tasks.length === 0) return { statusCode: 400, headers, body: JSON.stringify({ error: "No tasks" }) };

            var rows = tasks.map(function(t) {
                return {
                    user_id:     userId,
                    task_id:     t.id || ("t_" + Date.now()),
                    code:        t.code || "",
                    script_name: t.scriptName || "Script",
                    script_type: t.scriptType || "LocalScript",
                    parent:      t.parent     || "StarterGui",
                    action:      t.action     || "create",
                    task_order:  t.order      || 1,
                    total:       t.total      || 1
                };
            });

            await supa(SUPA_URL, SUPA_KEY, "POST", "plugin_tasks", rows);

            return { statusCode: 200, headers, body: JSON.stringify({ success: true, count: tasks.length }) };
        }

        // ── AI CHAT ─────────────────────────────────────────
        var sessionToken = body.sessionToken;
        var messages     = body.messages || [];
        var model        = body.model    || "llama-3.3-70b-versatile";
        var mode         = body.mode     || "quick";

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

        // Get profile (credits)
        var profRows = await supa(SUPA_URL, SUPA_KEY, "GET",
            "profiles?id=eq." + userId + "&select=credits,usage_count");
        if (!Array.isArray(profRows) || profRows.length === 0) {
            return { statusCode: 401, headers, body: JSON.stringify({ error: "INVALID_SESSION" }) };
        }
        var prof = profRows[0];
        var cost = mode === "plan" ? 3 : 1;

        if (prof.credits < cost) {
            return { statusCode: 200, headers, body: JSON.stringify({ error: "NO_CREDITS", credits: prof.credits }) };
        }

        // Deduct credits first
        var newCredits = prof.credits - cost;
        var newUsage   = prof.usage_count + 1;
        await supa(SUPA_URL, SUPA_KEY, "PATCH",
            "profiles?id=eq." + userId,
            { credits: newCredits, usage_count: newUsage });

        // Get API key from Supabase settings or env
        var keyRows = await supa(SUPA_URL, SUPA_KEY, "GET", "settings?key=eq.groq_api_key&select=value");
        var groqKey = (Array.isArray(keyRows) && keyRows.length > 0 && keyRows[0].value)
            ? keyRows[0].value
            : process.env.GROQ_API_KEY;

        if (!groqKey) {
            // Refund
            await supa(SUPA_URL, SUPA_KEY, "PATCH", "profiles?id=eq." + userId,
                { credits: prof.credits, usage_count: prof.usage_count });
            return { statusCode: 500, headers, body: JSON.stringify({ error: "API_KEY_MISSING" }) };
        }

        // Call Groq/OpenAI
        var aiRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type":  "application/json",
                "Authorization": "Bearer " + groqKey
            },
            body: JSON.stringify({
                model:       model,
                messages:    messages,
                max_tokens:  8000,
                temperature: 0.5
            })
        });

        if (!aiRes.ok) {
            var errData = await aiRes.json();
            // Refund on Groq error
            await supa(SUPA_URL, SUPA_KEY, "PATCH", "profiles?id=eq." + userId,
                { credits: prof.credits, usage_count: prof.usage_count });
            return { statusCode: aiRes.status, headers, body: JSON.stringify({ error: errData.error ? errData.error.message : "Groq error" }) };
        }

        var data    = await aiRes.json();
        var content = "Brak odpowiedzi";
        if (data.choices && data.choices[0] && data.choices[0].message) {
            content = data.choices[0].message.content;
        }

        // Save history to Supabase
        var userMsg = "";
        for (var i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === "user") { userMsg = messages[i].content; break; }
        }
        await supa(SUPA_URL, SUPA_KEY, "POST", "ai_history", {
            user_id:  userId,
            user_msg: userMsg.substring(0, 1000),
            ai_msg:   content.substring(0, 2000),
            mode:     mode,
            model:    model,
            cost:     cost
        });

        return {
            statusCode: 200, headers,
            body: JSON.stringify({
                content: content,
                credits: newCredits,
                usage:   newUsage,
                cost:    cost
            })
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
