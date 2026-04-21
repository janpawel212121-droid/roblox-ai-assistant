// ============================================================
//  api/get-task.js — Supabase adapter (legacy endpoint)
//  Zastąpiony przez queue-dequeue.js, ale zachowany dla kompatybilności
// ============================================================

var headers = {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Content-Type": "application/json"
};

exports.handler = async function(event) {
    if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };

    var SUPA_URL = process.env.SUPABASE_URL;
    var SUPA_KEY = process.env.SUPABASE_SERVICE_KEY;

    if (!SUPA_URL || !SUPA_KEY) {
        return { statusCode: 200, headers, body: JSON.stringify({ tasks: [], error: "Supabase not configured" }) };
    }

    try {
        var params      = event.queryStringParameters || {};
        var connectCode = params.connectCode || params.pluginKey || "";

        if (!connectCode) {
            return { statusCode: 200, headers, body: JSON.stringify({ tasks: [], error: "no key" }) };
        }

        // Validate connect code
        var codeRes = await fetch(SUPA_URL + "/rest/v1/connect_codes?code=eq." + encodeURIComponent(connectCode) +
            "&expires_at=gt." + new Date().toISOString() + "&select=user_id", {
            headers: { "apikey": SUPA_KEY, "Authorization": "Bearer " + SUPA_KEY }
        });
        var codeRows = await codeRes.json();
        if (!Array.isArray(codeRows) || codeRows.length === 0) {
            return { statusCode: 200, headers, body: JSON.stringify({ tasks: [], error: "INVALID_CODE" }) };
        }
        var userId = codeRows[0].user_id;

        // Fetch tasks
        var taskRes = await fetch(SUPA_URL + "/rest/v1/plugin_tasks?user_id=eq." + userId +
            "&order=created_at.asc&select=task_id,code,script_name,script_type,parent,action,task_order,total", {
            headers: { "apikey": SUPA_KEY, "Authorization": "Bearer " + SUPA_KEY }
        });
        var tasks = await taskRes.json();
        if (!Array.isArray(tasks)) tasks = [];

        // Delete fetched tasks
        if (tasks.length > 0) {
            await fetch(SUPA_URL + "/rest/v1/plugin_tasks?user_id=eq." + userId, {
                method: "DELETE",
                headers: { "apikey": SUPA_KEY, "Authorization": "Bearer " + SUPA_KEY }
            });
        }

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

        return { statusCode: 200, headers, body: JSON.stringify({ tasks: mapped, count: mapped.length }) };

    } catch (err) {
        return { statusCode: 200, headers, body: JSON.stringify({ tasks: [], error: err.message }) };
    }
};

const originalHandler = exports.handler;
module.exports = async function(req, res) {
    try {
        var event = { httpMethod: req.method, body: null, queryStringParameters: req.query || {} };
        var result = await originalHandler(event, {});
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
        res.status(result.statusCode || 200).send(result.body || "");
    } catch (e) {
        res.status(500).send(JSON.stringify({ error: "Internal Server Error", tasks: [] }));
    }
};
