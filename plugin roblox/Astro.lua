-- ============================================================
--  Astro Plugin v8  |  Lemonade UI  |  fleetyai.netlify.app
-- ============================================================

local SERVER     = "https://fleetyai.netlify.app"
local POLL_DELAY = 2
local VERSION    = "v8"

local Http = game:GetService("HttpService")
local Sel  = game:GetService("Selection")
local CHS  = game:GetService("ChangeHistoryService")

-- ── Toolbar ──────────────────────────────────────────────
local bar     = plugin:CreateToolbar("Astro AI")
local mainBtn = bar:CreateButton("Astro", "Astro AI – otwórz panel", "rbxassetid://4458901886")

local wInfo = DockWidgetPluginGuiInfo.new(
    Enum.InitialDockState.Float, false, false, 360, 300, 320, 260)
local widget = plugin:CreateDockWidgetPluginGui("Astro_v8", wInfo)
widget.Title = "Astro AI"

-- ── Colours ──────────────────────────────────────────────
local C = {
    bg      = Color3.fromRGB(17,  17,  17),
    bg2     = Color3.fromRGB(26,  26,  26),
    bg3     = Color3.fromRGB(36,  36,  36),
    bg4     = Color3.fromRGB(48,  48,  48),
    cyan    = Color3.fromRGB(0,   198, 255),
    cyanDim = Color3.fromRGB(0,   80,  102),
    green   = Color3.fromRGB(74,  222, 128),
    red     = Color3.fromRGB(235, 75,  75),
    yellow  = Color3.fromRGB(250, 195, 55),
    text    = Color3.fromRGB(240, 240, 240),
    text2   = Color3.fromRGB(160, 160, 160),
    text3   = Color3.fromRGB(90,  90,  90),
    border  = Color3.fromRGB(45,  45,  45),
    border2 = Color3.fromRGB(60,  60,  60),
    black   = Color3.fromRGB(0,   0,   0),
}

-- ── UI helpers ───────────────────────────────────────────
local function mk(cls, props, parent)
    local o = Instance.new(cls)
    for k, v in pairs(props) do
        if k ~= "Parent" then pcall(function() o[k] = v end) end
    end
    o.Parent = parent
    return o
end
local function corner(r, p)
    mk("UICorner", {CornerRadius = UDim.new(0, r or 8)}, p)
end
local function stroke(col, thick, p)
    mk("UIStroke", {Color = col, Thickness = thick or 1}, p)
end
local function pad(l, r, t, b, p)
    mk("UIPadding", {
        PaddingLeft   = UDim.new(0, l),
        PaddingRight  = UDim.new(0, r),
        PaddingTop    = UDim.new(0, t),
        PaddingBottom = UDim.new(0, b),
    }, p)
end
local function vlist(gap, p)
    mk("UIListLayout", {
        SortOrder     = Enum.SortOrder.LayoutOrder,
        FillDirection = Enum.FillDirection.Vertical,
        Padding       = UDim.new(0, gap),
    }, p)
end
local function hlist(gap, va, p)
    mk("UIListLayout", {
        SortOrder           = Enum.SortOrder.LayoutOrder,
        FillDirection       = Enum.FillDirection.Horizontal,
        VerticalAlignment   = va or Enum.VerticalAlignment.Center,
        Padding             = UDim.new(0, gap),
    }, p)
end

-- ── Root frame ───────────────────────────────────────────
local root = mk("Frame", {
    Size             = UDim2.new(1, 0, 1, 0),
    BackgroundColor3 = C.bg,
    BorderSizePixel  = 0,
}, widget)
pad(14, 14, 14, 14, root)
vlist(10, root)

-- ── HEADER ───────────────────────────────────────────────
local header = mk("Frame", {
    Size                 = UDim2.new(1, 0, 0, 38),
    BackgroundColor3     = C.bg2,
    LayoutOrder          = 1,
}, root)
corner(10, header)
stroke(C.border2, 1, header)
pad(12, 12, 0, 0, header)
hlist(8, Enum.VerticalAlignment.Center, header)

-- Brand dot (cyan circle with star)
local brandDot = mk("Frame", {
    Size             = UDim2.new(0, 24, 0, 24),
    BackgroundColor3 = C.cyanDim,
    LayoutOrder      = 1,
}, header)
corner(6, brandDot)
stroke(C.cyan, 1, brandDot)
mk("TextLabel", {
    Size                 = UDim2.new(1, 0, 1, 0),
    BackgroundTransparency = 1,
    Text                 = "✦",
    TextColor3           = C.cyan,
    Font                 = Enum.Font.GothamBold,
    TextSize             = 12,
}, brandDot)

-- Title
mk("TextLabel", {
    Size                 = UDim2.new(0, 80, 1, 0),
    BackgroundTransparency = 1,
    Text                 = "Astro AI",
    TextColor3           = C.text,
    Font                 = Enum.Font.GothamBold,
    TextSize             = 13,
    TextXAlignment       = Enum.TextXAlignment.Left,
    LayoutOrder          = 2,
}, header)

-- Version badge
do
    local badge = mk("TextLabel", {
        Size                 = UDim2.new(0, 28, 0, 18),
        BackgroundColor3     = C.bg3,
        Text                 = VERSION,
        TextColor3           = C.text3,
        Font                 = Enum.Font.Gotham,
        TextSize             = 10,
        LayoutOrder          = 3,
    }, header)
    corner(5, badge)
end

-- Spacer
mk("Frame", {
    Size                 = UDim2.new(1, 0, 1, 0),
    BackgroundTransparency = 1,
    LayoutOrder          = 10,
}, header)

-- Status badge (right side of header)
local statusBadge = mk("TextLabel", {
    Size                 = UDim2.new(0, 64, 0, 22),
    BackgroundColor3     = C.bg4,
    Text                 = "● Offline",
    TextColor3           = C.text3,
    Font                 = Enum.Font.GothamBold,
    TextSize             = 10,
    LayoutOrder          = 20,
}, header)
corner(99, statusBadge)

-- ── CODE INPUT ───────────────────────────────────────────
local codeWrap = mk("Frame", {
    Size             = UDim2.new(1, 0, 0, 36),
    BackgroundColor3 = C.bg2,
    LayoutOrder      = 2,
}, root)
corner(8, codeWrap)
stroke(C.border2, 1, codeWrap)
pad(12, 12, 0, 0, codeWrap)

local codeInput = mk("TextBox", {
    Size              = UDim2.new(1, 0, 1, 0),
    BackgroundTransparency = 1,
    PlaceholderText   = "Wklej Connect Code ze strony...",
    PlaceholderColor3 = C.text3,
    TextColor3        = C.cyan,
    Font              = Enum.Font.Code,
    TextSize          = 11,
    ClearTextOnFocus  = false,
    TextTruncate      = Enum.TextTruncate.AtEnd,
    TextXAlignment    = Enum.TextXAlignment.Left,
    Text              = plugin:GetSetting("Astro_CC") or "",
}, codeWrap)

-- ── HINT ─────────────────────────────────────────────────
local hint = mk("TextLabel", {
    Size                 = UDim2.new(1, 0, 0, 28),
    BackgroundTransparency = 1,
    Text                 = "Otwórz stronę Astro w przeglądarce, skopiuj Connect Code i wklej go powyżej.",
    TextColor3           = C.text3,
    Font                 = Enum.Font.Gotham,
    TextSize             = 11,
    TextWrapped          = true,
    TextXAlignment       = Enum.TextXAlignment.Center,
    LayoutOrder          = 3,
}, root)

-- ── CONNECT BUTTON ───────────────────────────────────────
local connectBtn = mk("TextButton", {
    Size             = UDim2.new(1, 0, 0, 36),
    BackgroundColor3 = C.cyan,
    Text             = "⚡  Połącz z Astro",
    TextColor3       = C.black,
    Font             = Enum.Font.GothamBold,
    TextSize         = 13,
    AutoButtonColor  = false,
    LayoutOrder      = 4,
}, root)
corner(9, connectBtn)

-- Hover effect
connectBtn.MouseEnter:Connect(function()
    connectBtn.BackgroundColor3 = Color3.fromRGB(0, 170, 220)
end)
connectBtn.MouseLeave:Connect(function()
    if not _G.astroActive then
        connectBtn.BackgroundColor3 = C.cyan
    else
        connectBtn.BackgroundColor3 = C.red
    end
end)

-- ── LOG CONSOLE ──────────────────────────────────────────
local console = mk("ScrollingFrame", {
    Size                 = UDim2.new(1, 0, 0, 100),
    BackgroundColor3     = C.bg2,
    BorderSizePixel      = 0,
    ScrollBarThickness   = 2,
    ScrollBarImageColor3 = C.bg4,
    CanvasSize           = UDim2.new(0, 0, 0, 0),
    AutomaticCanvasSize  = Enum.AutomaticSize.Y,
    LayoutOrder          = 5,
}, root)
corner(8, console)
stroke(C.border, 1, console)
pad(10, 10, 7, 7, console)
vlist(2, console)

-- ── LOGGING ──────────────────────────────────────────────
local logIdx = 0
local function log(msg, kind)
    logIdx = logIdx + 1
    local cols = {ok = C.green, info = C.text3, warn = C.yellow, err = C.red, op = C.cyan}
    local pfx  = {ok = "✓", info = "·", warn = "!", err = "✗", op = "→"}
    local line = mk("TextLabel", {
        Size                 = UDim2.new(1, 0, 0, 15),
        BackgroundTransparency = 1,
        Text                 = (pfx[kind] or "·") .. "  " .. msg,
        TextColor3           = cols[kind] or C.text2,
        Font                 = Enum.Font.Code,
        TextSize             = 10,
        TextXAlignment       = Enum.TextXAlignment.Left,
        TextTruncate         = Enum.TextTruncate.AtEnd,
        LayoutOrder          = logIdx,
    }, console)
    task.defer(function()
        console.CanvasPosition = Vector2.new(0, console.AbsoluteCanvasSize.Y + 200)
    end)
end

-- ── UI STATE ─────────────────────────────────────────────
local active = false
_G.astroActive = false

local function setConnected(on)
    active = on
    _G.astroActive = on
    if on then
        connectBtn.Text             = "✕  Rozłącz"
        connectBtn.BackgroundColor3 = C.red
        statusBadge.Text            = "● Online"
        statusBadge.TextColor3      = C.green
        statusBadge.BackgroundColor3 = Color3.fromRGB(30, 60, 40)
        hint.Text                   = "Połączono ✓  Oczekiwanie na zadania..."
        hint.TextColor3             = C.green
    else
        connectBtn.Text             = "⚡  Połącz z Astro"
        connectBtn.BackgroundColor3 = C.cyan
        statusBadge.Text            = "● Offline"
        statusBadge.TextColor3      = C.text3
        statusBadge.BackgroundColor3 = C.bg4
        hint.Text                   = "Otwórz stronę Astro, skopiuj Connect Code i wklej go powyżej."
        hint.TextColor3             = C.text3
    end
end

-- ── TASK RUNNER ──────────────────────────────────────────
local function getContainer(name)
    local map = {
        ServerScriptService  = game:GetService("ServerScriptService"),
        ReplicatedStorage    = game:GetService("ReplicatedStorage"),
        ServerStorage        = game:GetService("ServerStorage"),
        Workspace            = workspace,
        StarterGui           = game:GetService("StarterGui"),
        StarterPlayerScripts = game:GetService("StarterPlayer"):FindFirstChild("StarterPlayerScripts"),
    }
    return map[name] or game:GetService("StarterGui")
end

local function findExisting(name, parent)
    local p = getContainer(parent)
    if not p then return end
    for _, c in ipairs(p:GetChildren()) do
        if c.Name == name and (c:IsA("BaseScript") or c:IsA("ModuleScript")) then return c end
    end
end

local opsTotal = 0
local function runTask(t, idx, total)
    local name   = t.scriptName or "Script"
    local stype  = t.scriptType or "LocalScript"
    local parent = t.parent     or "StarterGui"
    local action = (t.action or "create"):lower()
    local pre    = total > 1 and ("[" .. idx .. "/" .. total .. "] ") or ""

    if action == "delete" then
        local e = findExisting(name, parent)
        if e then e:Destroy(); log(pre .. "Usunięto: " .. name, "ok")
        else log("Nie znaleziono: " .. name, "warn") end
        opsTotal = opsTotal + 1
        return
    end
    if action == "update" then
        local e = findExisting(name, parent)
        if e then
            e.Source = t.code or ""
            Sel:Set({e}); CHS:SetWaypoint("Update " .. name)
            log(pre .. "Zaktualizowano: " .. name, "ok")
            opsTotal = opsTotal + 1
            return
        end
    end
    -- create
    task.wait(0.05)
    local ok, err = pcall(function()
        local old = findExisting(name, parent)
        if old then old:Destroy() end
        local inst
        if     stype == "ModuleScript" then inst = Instance.new("ModuleScript")
        elseif stype == "Script"       then inst = Instance.new("Script")
        else                                inst = Instance.new("LocalScript") end
        inst.Name   = name
        inst.Source = t.code or ""
        inst.Parent = getContainer(parent)
        Sel:Set({inst}); CHS:SetWaypoint("Astro: " .. name)
    end)
    if ok then log(pre .. "Utworzono: " .. name .. " → " .. parent, "ok")
    else      log("Błąd: " .. tostring(err):sub(1, 55), "err") end
    opsTotal = opsTotal + 1
end

-- ── POLLING ──────────────────────────────────────────────
local function poll(code)
    local ok, res = pcall(function()
        local url  = SERVER .. "/api/queue-dequeue?connectCode=" .. Http:UrlEncode(code)
        local resp = Http:GetAsync(url, true)
        return Http:JSONDecode(resp)
    end)
    if not ok then return end  -- network blip, keep going

    if res.error == "INVALID_CODE" then
        log("Nieprawidłowy Connect Code!", "err")
        setConnected(false)
        return
    end

    local tasks = res.tasks
    if tasks and type(tasks) == "table" and #tasks > 0 then
        log(#tasks .. " zadań odebranych", "op")
        table.sort(tasks, function(a, b) return (a.order or 0) < (b.order or 0) end)
        for i, t in ipairs(tasks) do
            runTask(t, i, #tasks)
            if i < #tasks then task.wait(0.15) end
        end
        log("Gotowe! (" .. opsTotal .. " operacji)", "ok")
    end
end

local function startPolling(code)
    if active then return end
    setConnected(true)
    plugin:SetSetting("Astro_CC", code)
    log("Połączono! Kod: " .. code:sub(1, 14) .. "...", "ok")
    task.spawn(function()
        while active do
            poll(code)
            task.wait(POLL_DELAY)
        end
    end)
end

local function stopPolling()
    setConnected(false)
    log("Rozłączono.", "warn")
end

-- ── EVENTS ───────────────────────────────────────────────
connectBtn.MouseButton1Click:Connect(function()
    if active then
        stopPolling()
    else
        local code = codeInput.Text:match("^%s*(.-)%s*$")
        if code == "" then
            log("Wklej Connect Code ze strony Astro!", "err")
            codeWrap.BackgroundColor3 = Color3.fromRGB(60, 25, 25)
            task.delay(1.5, function()
                codeWrap.BackgroundColor3 = C.bg2
            end)
            return
        end
        startPolling(code)
    end
end)

mainBtn.Click:Connect(function()
    widget.Enabled = not widget.Enabled
end)

-- ── INIT ─────────────────────────────────────────────────
log("Astro " .. VERSION .. " gotowy", "ok")
if (plugin:GetSetting("Astro_CC") or "") ~= "" then
    log("Zapisany kod: " .. (plugin:GetSetting("Astro_CC") or ""):sub(1,14) .. "...", "info")
    log("Kliknij Połącz aby wznowić.", "info")
else
    log("Wklej Connect Code i kliknij Połącz.", "info")
end
