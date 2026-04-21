const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'api');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));

const adapterCode = `

// --- VERCEL ADAPTER ---
const originalHandler = exports.handler;
module.exports = async function(req, res) {
    try {
        var event = {
            httpMethod: req.method,
            body: req.method === 'GET' ? null : (typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {})),
            queryStringParameters: req.query || {}
        };
        var context = {};
        var result = await originalHandler(event, context);
        
        // Ensure permissive CORS for api calls
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
        
        if (result && result.headers) {
            for (const [k, v] of Object.entries(result.headers)) {
                res.setHeader(k, v);
            }
        }
        
        if (result && result.statusCode) {
            res.status(result.statusCode).send(result.body || "");
        } else {
            res.status(200).send("");
        }
    } catch(e) {
        console.error("Vercel Adapter Error:", e);
        res.status(500).send(JSON.stringify({error: "Internal Server Error"}));
    }
};
`;

for (let file of files) {
    let filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Check if already adapted to prevent double appending
    if (!content.includes("// --- VERCEL ADAPTER ---")) {
        fs.writeFileSync(filePath, content + adapterCode, 'utf8');
        console.log(`Appended adapter to ${file}`);
    }
}
