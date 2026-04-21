// ============================================================
//  api/queue-dequeue.js — Supabase adapter
//  Pobiera zadania z plugin_tasks i usuwa je z kolejki
// ============================================================

var headers = {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
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
        body: body ? JSON.stringify(body) : undefined
    }).then(function(r) { return r.json(); });
}

exports.handler = async function(event) {
    if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };

    var SUPA_URL = process.env.SUPABASE_URL;
    var SUPA_KEY = process.env.SUPABASE_SERVICE_KEY;

    try {
        var params      = event.queryStringParameters || {};
        var connectCode = params.connectCode || "";

        if (!connectCode) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing connectCode" }) };
        }

        // Validate connect code & get user
        var codeRows = await supa(SUPA_URL, SUPA_KEY, "GET",
            "connect_codes?code=eq." + encodeURIComponent(connectCode) +
            "&expires_at=gt." + new Date().toISOString() +
            "&select=user_id");

        if (!Array.isArray(codeRows) || codeRows.length === 0) {
            return { statusCode: 200, headers, body: JSON.stringify({ error: "INVALID_CODE", tasks: [] }) };
        }

        var userId = codeRows[0].user_id;

        // Register heartbeat ping
        try {
           await fetch(SUPA_URL + "/rest/v1/settings", {
               method: "POST",
               headers: {
                   "apikey": SUPA_KEY,
                   "Authorization": "Bearer " + SUPA_KEY,
                   "Content-Type": "application/json",
                   "Prefer": "resolution=merge-duplicates"
               },
               body: JSON.stringify({ key: "ping_" + userId, value: Date.now().toString() })
           });
        } catch(e) {}

        // Fetch tasks for this user
        var tasks = await supa(SUPA_URL, SUPA_KEY, "GET",
            "plugin_tasks?user_id=eq." + userId +
            "&order=created_at.asc" +
            "&select=task_id,code,script_name,script_type,parent,action,task_order,total");

        if (!Array.isArray(tasks) || tasks.length === 0) {
            return { statusCode: 200, headers, body: JSON.stringify({ tasks: [] }) };
        }

        // Map to plugin format
        var mapped = tasks.map(function(t) {
            return {
                id:         t.task_id,
                code:       t.code,
                scriptName: t.script_name,
                scriptType: t.script_type,
                parent:     t.parent,
                action:     t.action,
                order:      t.task_order,
                total:      t.total
            };
        });

        // Delete tasks (dequeue)
        await supa(SUPA_URL, SUPA_KEY, "DELETE",
            "plugin_tasks?user_id=eq." + userId, undefined);

        return {
            statusCode: 200, headers,
            body: JSON.stringify({ tasks: mapped })
        };

    } catch (err) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: err.message, tasks: [] }) };
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
        res.status(500).send(JSON.stringify({ error: "Internal Server Error", tasks: [] }));
    }
};
