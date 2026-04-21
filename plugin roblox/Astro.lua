-- ============================================================
--  Astro Plugin v7  |  Lemonade-style UI
--  fleetyai.netlify.app
-- ============================================================

local SERVER     = "https://fleetyai.netlify.app"
local POLL_DELAY = 2
local VERSION    = "v7"

local Http   = game:GetService("HttpService")
local Sel    = game:GetService("Selection")
local CHS    = game:GetService("ChangeHistoryService")

-- ── Toolbar button ────────────────────────────────────────
local bar     = plugin:CreateToolbar("Astro")
local mainBtn = bar:CreateButton("Astro", "Astro AI – kliknij aby otworzyć", "rbxassetid://4458901886")

local wInfo = DockWidgetPluginGuiInfo.new(
    Enum.InitialDockState.Float, false, false, 340, 220, 300, 200)
local widget = plugin:CreateDockWidgetPluginGui("Astro_Widget_v7", wInfo)
widget.Title = "Astro"

-- ── COLOURS ──────────────────────────────────────────────
local BG      = Color3.fromRGB(30, 30, 30)
local BG2     = Color3.fromRGB(42, 42, 42)
local BG3     = Color3.fromRGB(56, 56, 56)
local GREEN   = Color3.fromRGB(74, 222, 128)
local RED     = Color3.fromRGB(235, 75, 75)
local YELLOW  = Color3.fromRGB(250, 195, 55)
local TEXT    = Color3.fromRGB(235, 235, 235)
local TEXT2   = Color3.fromRGB(155, 155, 155)
local BORDER  = Color3.fromRGB(65, 65, 65)
local BLACK   = Color3.fromRGB(0, 0, 0)

-- ── HELPER ───────────────────────────────────────────────
local function ui(cls, props, parent)
    local o = Instance.new(cls)
    for k, v in pairs(props) do
        if k ~= "Parent" then pcall(function() o[k] = v end) end
    end
    o.Parent = parent or widget
    return o
end
local function corner(r, p)
    local c = Instance.new("UICorner")
    c.CornerRadius = UDim.new(0, r or 8)
    c.Parent = p
end
local function pad(l,r,t,b,p)
    local x = Instance.new("UIPadding")
    x.PaddingLeft   = UDim.new(0,l)
    x.PaddingRight  = UDim.new(0,r)
    x.PaddingTop    = UDim.new(0,t)
    x.PaddingBottom = UDim.new(0,b)
    x.Parent = p
end
local function vlist(gap, p)
    local l = Instance.new("UIListLayout")
    l.SortOrder      = Enum.SortOrder.LayoutOrder
    l.FillDirection  = Enum.FillDirection.Vertical
    l.Padding        = UDim.new(0, gap)
    l.Parent         = p
end
local function hlist(gap, va, p)
    local l = Instance.new("UIListLayout")
    l.SortOrder         = Enum.SortOrder.LayoutOrder
    l.FillDirection     = Enum.FillDirection.Horizontal
    l.VerticalAlignment = va or Enum.VerticalAlignment.Center
    l.Padding           = UDim.new(0, gap)
    l.Parent            = p
    return l
end

-- ── ROOT ─────────────────────────────────────────────────
local root = ui("Frame", {
    Size = UDim2.new(1,0,1,0),
    BackgroundColor3 = BG,
    BorderSizePixel  = 0,
}, widget)
pad(14, 14, 14, 14, root)
vlist(10, root)

-- ── ROW 1: Dot + Version + CONNECT + STATUS ───────────────
local row1 = ui("Frame", {
    Size = UDim2.new(1,0,0,36),
    BackgroundTransparency = 1,
    LayoutOrder = 1,
}, root)
hlist(8, Enum.VerticalAlignment.Center, row1)

-- Yellow dot (logo) — matches Lemonade screenshot
local dot = ui("Frame", {
    Size = UDim2.new(0,26,0,26),
    BackgroundColor3 = YELLOW,
    LayoutOrder = 1,
}, row1)
corner(99, dot)

local dotInner = ui("TextLabel", {
    Size = UDim2.new(1,0,1,0),
    BackgroundTransparency = 1,
    Text = "✦",
    TextColor3 = BLACK,
    Font = Enum.Font.GothamBold,
    TextSize = 13,
}, dot)

-- Version
ui("TextLabel", {
    Size = UDim2.new(0,52,1,0),
    BackgroundTransparency = 1,
    Text = VERSION,
    TextColor3 = TEXT2,
    Font = Enum.Font.GothamBold,
    TextSize = 13,
    TextXAlignment = Enum.TextXAlignment.Left,
    LayoutOrder = 2,
}, row1)

-- Spacer
ui("Frame", {
    Size = UDim2.new(1,0,1,0),
    BackgroundTransparency = 1,
    LayoutOrder = 3,
}, row1)

-- CONNECT button
local connectBtn = ui("TextButton", {
    Size = UDim2.new(0,96,0,30),
    BackgroundColor3 = GREEN,
    Text = "Connect",
    TextColor3 = BLACK,
    Font = Enum.Font.GothamBold,
    TextSize = 13,
    AutoButtonColor = false,
    LayoutOrder = 4,
}, row1)
corner(7, connectBtn)

-- STATUS button
local statusBtn = ui("TextButton", {
    Size = UDim2.new(0,80,0,30),
    BackgroundColor3 = BG3,
    Text = "Status  ",
    TextColor3 = TEXT,
    Font = Enum.Font.GothamBold,
    TextSize = 13,
    AutoButtonColor = false,
    LayoutOrder = 5,
}, row1)
corner(7, statusBtn)

-- Status dot inside STATUS button
local sDot = ui("Frame", {
    Size = UDim2.new(0,8,0,8),
    Position = UDim2.new(1,-12,0.5,-4),
    BackgroundColor3 = RED,
}, statusBtn)
corner(99, sDot)

-- ── ROW 2: Connect Code input ─────────────────────────────
local codeBox = ui("Frame", {
    Size = UDim2.new(1,0,0,34),
    BackgroundColor3 = BG2,
    LayoutOrder = 2,
}, root)
corner(8, codeBox)

local codeStroke = Instance.new("UIStroke")
codeStroke.Color     = BORDER
codeStroke.Thickness = 1
codeStroke.Parent    = codeBox
pad(10, 10, 0, 0, codeBox)

local codeInput = ui("TextBox", {
    Size = UDim2.new(1,0,1,0),
    BackgroundTransparency = 1,
    PlaceholderText = "Wklej Connect Code ze strony...",
    PlaceholderColor3 = TEXT2,
    TextColor3 = TEXT,
    Font = Enum.Font.Code,
    TextSize = 11,
    ClearTextOnFocus = false,
    TextTruncate = Enum.TextTruncate.AtEnd,
    TextXAlignment = Enum.TextXAlignment.Left,
    Text = plugin:GetSetting("Astro_CC") or "",
}, codeBox)

-- ── ROW 3: Hint ───────────────────────────────────────────
local hint = ui("TextLabel", {
    Size = UDim2.new(1,0,0,36),
    BackgroundTransparency = 1,
    Text = "Open Astro in the browser then press Connect",
    TextColor3 = TEXT2,
    Font = Enum.Font.Gotham,
    TextSize = 12,
    TextWrapped = true,
    TextXAlignment = Enum.TextXAlignment.Center,
    LayoutOrder = 3,
}, root)

-- ── ROW 4: Console ────────────────────────────────────────
local console = ui("ScrollingFrame", {
    Size = UDim2.new(1,0,0,72),
    BackgroundColor3 = BG2,
    BorderSizePixel = 0,
    ScrollBarThickness = 2,
    ScrollBarImageColor3 = BG3,
    CanvasSize = UDim2.new(0,0,0,0),
    AutomaticCanvasSize = Enum.AutomaticSize.Y,
    LayoutOrder = 4,
}, root)
corner(7, console)
pad(8, 8, 6, 6, console)
vlist(2, console)

-- Bottom row: Logs toggle + Logs Off button
local bottomRow = ui("Frame", {
    Size = UDim2.new(1,0,0,22),
    BackgroundTransparency = 1,
    LayoutOrder = 5,
}, root)
hlist(6, Enum.VerticalAlignment.Center, bottomRow)

ui("Frame", {
    Size = UDim2.new(1,0,1,0),
    BackgroundTransparency = 1,
    LayoutOrder = 1,
}, bottomRow)

local logsBtn = ui("TextButton", {
    Size = UDim2.new(0,72,0,22),
    BackgroundColor3 = BG3,
    Text = "Logs Off",
    TextColor3 = TEXT2,
    Font = Enum.Font.Gotham,
    TextSize = 11,
    AutoButtonColor = false,
    LayoutOrder = 2,
}, bottomRow)
corner(5, logsBtn)

-- ── LOGGING ──────────────────────────────────────────────
local logIdx   = 0
local logsVisible = true

local function log(msg, kind)
    if not logsVisible then return end
    logIdx = logIdx + 1
    local cols = { ok=GREEN, info=TEXT2, warn=YELLOW, err=RED, op=Color3.fromRGB(130,170,255) }
    local pfx  = { ok="OK ", info="•• ", warn="!! ", err="ERR", op="→  " }
    ui("TextLabel", {
        Size = UDim2.new(1,0,0,14),
        BackgroundTransparency = 1,
        Text = (pfx[kind] or "   ") .. " " .. msg,
        TextColor3 = cols[kind] or TEXT2,
        Font = Enum.Font.Code,
        TextSize = 10,
        TextXAlignment = Enum.TextXAlignment.Left,
        TextTruncate = Enum.TextTruncate.AtEnd,
        LayoutOrder = logIdx,
    }, console)
    task.defer(function()
        console.CanvasPosition = Vector2.new(0, console.AbsoluteCanvasSize.Y + 100)
    end)
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
        if c.Name == name and (c:IsA("BaseScript") or c:IsA("ModuleScript")) then
            return c
        end
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
        -- fall through to create if not found
    end

    -- create
    task.wait(0.1)
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
    else      log("Błąd create: " .. tostring(err):sub(1,50), "err") end
    opsTotal = opsTotal + 1
end

-- ── CONNECTION ───────────────────────────────────────────
local active = false

local function setUI(connected)
    if connected then
        connectBtn.Text = "Disconnect"
        connectBtn.BackgroundColor3 = RED
        sDot.BackgroundColor3 = GREEN
        hint.Text = "Połączono ✓  Oczekiwanie na zadania..."
    else
        connectBtn.Text = "Connect"
        connectBtn.BackgroundColor3 = GREEN
        sDot.BackgroundColor3 = RED
        hint.Text = "Open Astro in the browser then press Connect"
    end
end

local function poll(code)
    local ok, res = pcall(function()
        local url  = SERVER .. "/api/queue-dequeue?connectCode=" .. Http:UrlEncode(code)
        local resp = Http:GetAsync(url, true)
        return Http:JSONDecode(resp)
    end)

    if not ok then
        sDot.BackgroundColor3 = YELLOW  -- network issue, keep trying
        return
    end

    if res.error == "INVALID_CODE" then
        log("Nieprawidłowy Connect Code!", "err")
        active = false; setUI(false)
        return
    end

    sDot.BackgroundColor3 = GREEN  -- ping OK

    local tasks = res.tasks
    if tasks and type(tasks) == "table" and #tasks > 0 then
        log(#tasks .. " zadań do wykonania", "op")
        table.sort(tasks, function(a, b)
            return (a.order or 0) < (b.order or 0)
        end)
        for i, t in ipairs(tasks) do
            runTask(t, i, #tasks)
            if i < #tasks then task.wait(0.2) end
        end
        log("Gotowe! " .. opsTotal .. " operacji łącznie", "ok")
    end
end

local function startPolling(code)
    if active then return end
    active = true
    plugin:SetSetting("Astro_CC", code)
    setUI(true)
    log("Połączono! Kod: " .. code:sub(1,12) .. "...", "ok")
    task.spawn(function()
        while active do
            poll(code)
            task.wait(POLL_DELAY)
        end
    end)
end

local function stopPolling()
    active = false
    setUI(false)
    log("Rozłączono", "warn")
end

-- ── EVENTS ───────────────────────────────────────────────
connectBtn.MouseButton1Click:Connect(function()
    if active then
        stopPolling()
    else
        local code = codeInput.Text:match("^%s*(.-)%s*$")
        if code == "" then
            log("Wklej Connect Code!", "err"); return
        end
        startPolling(code)
    end
end)

statusBtn.MouseButton1Click:Connect(function()
    if active then
        log("Status: Połączono ✓", "ok")
    else
        log("Status: Rozłączono", "warn")
    end
end)

logsBtn.MouseButton1Click:Connect(function()
    logsVisible = not logsVisible
    console.Visible = logsVisible
    logsBtn.Text = logsVisible and "Logs Off" or "Logs On"
    logsBtn.TextColor3 = logsVisible and TEXT2 or GREEN
end)

mainBtn.Click:Connect(function()
    widget.Enabled = not widget.Enabled
end)

-- ── INIT ─────────────────────────────────────────────────
log("Astro " .. VERSION .. " gotowy", "ok")
log("Wklej Connect Code i kliknij Connect", "info")
