-- ============================================================
--  Astro Plugin v7  |  Lemonade-style UI
--  Minimal: logo · version · Connect · Status
-- ============================================================

local SERVER     = "https://fleetyai.netlify.app"
local POLL_DELAY = 2
local VERSION    = "v7"

local Http = game:GetService("HttpService")
local Sel  = game:GetService("Selection")
local CHS  = game:GetService("ChangeHistoryService")
local TS   = game:GetService("TweenService")

-- ── Toolbar ──────────────────────────────────────────────
local bar     = plugin:CreateToolbar("Astro")
local mainBtn = bar:CreateButton("Astro", "Astro AI Assistant", "rbxassetid://4458901886")
local wInfo   = DockWidgetPluginGuiInfo.new(
    Enum.InitialDockState.Float, false, false, 340, 180, 300, 160)
local w       = plugin:CreateDockWidgetPluginGui("Astro_v7", wInfo)
w.Title       = "Astro"

-- ── Helpers ──────────────────────────────────────────────
local function make(cls, props)
    local i = Instance.new(cls)
    for k, v in pairs(props) do
        if k ~= "Parent" then pcall(function() i[k] = v end) end
    end
    if props.Parent then i.Parent = props.Parent end
    return i
end

local function tween(obj, goals, dur)
    TS:Create(obj, TweenInfo.new(dur or 0.2, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), goals):Play()
end

-- ── PALETTE ──────────────────────────────────────────────
local C = {
    bg      = Color3.fromRGB(28,  28,  28),
    bg2     = Color3.fromRGB(38,  38,  38),
    bg3     = Color3.fromRGB(50,  50,  50),
    green   = Color3.fromRGB(74,  222, 128),
    greenDk = Color3.fromRGB(40,  160, 80),
    text    = Color3.fromRGB(240, 240, 240),
    textSec = Color3.fromRGB(160, 160, 160),
    red     = Color3.fromRGB(244, 80,  80),
    yellow  = Color3.fromRGB(250, 200, 60),
    border  = Color3.fromRGB(60,  60,  60),
}

-- ── ROOT ─────────────────────────────────────────────────
local root = make("Frame", {
    Size = UDim2.new(1,0,1,0),
    BackgroundColor3 = C.bg,
    BorderSizePixel  = 0,
    Parent = w,
})
make("UIPadding", { PaddingLeft=UDim.new(0,14), PaddingRight=UDim.new(0,14),
    PaddingTop=UDim.new(0,14), PaddingBottom=UDim.new(0,14), Parent=root })
make("UIListLayout", {
    SortOrder=Enum.SortOrder.LayoutOrder,
    FillDirection=Enum.FillDirection.Vertical,
    Padding=UDim.new(0,10),
    Parent=root,
})

-- ── ROW 1: Logo + Version + [Connect] [Status ●] ─────────
local row1 = make("Frame", {
    Size=UDim2.new(1,0,0,36), BackgroundTransparency=1, LayoutOrder=1, Parent=root,
})
make("UIListLayout", {
    SortOrder=Enum.SortOrder.LayoutOrder,
    FillDirection=Enum.FillDirection.Horizontal,
    VerticalAlignment=Enum.VerticalAlignment.Center,
    Padding=UDim.new(0,8),
    Parent=row1,
})

-- Logo circle (green)
local logoCircle = make("Frame", {
    Size=UDim2.new(0,28,0,28), BackgroundColor3=C.green,
    LayoutOrder=1, Parent=row1,
})
make("UICorner", {CornerRadius=UDim.new(1,0), Parent=logoCircle})
make("TextLabel", {
    Size=UDim2.new(1,0,1,0), BackgroundTransparency=1,
    Text="✦", TextColor3=Color3.fromRGB(0,0,0),
    Font=Enum.Font.GothamBold, TextSize=14, Parent=logoCircle,
})

-- Version label
local versionLabel = make("TextLabel", {
    Size=UDim2.new(0,50,1,0), BackgroundTransparency=1,
    Text=VERSION, TextColor3=C.textSec,
    Font=Enum.Font.GothamBold, TextSize=13,
    TextXAlignment=Enum.TextXAlignment.Left,
    LayoutOrder=2, Parent=row1,
})

-- Spacer
make("Frame", {
    Size=UDim2.new(1,0,1,0), BackgroundTransparency=1,
    LayoutOrder=3, Parent=row1,
})

-- CONNECT button
local connectBtn = make("TextButton", {
    Size=UDim2.new(0,90,0,30), BackgroundColor3=C.green,
    Text="Connect", TextColor3=Color3.fromRGB(0,0,0),
    Font=Enum.Font.GothamBold, TextSize=13,
    AutoButtonColor=false, LayoutOrder=4, Parent=row1,
})
make("UICorner", {CornerRadius=UDim.new(0,7), Parent=connectBtn})

-- STATUS button (with dot)
local statusBtn = make("TextButton", {
    Size=UDim2.new(0,86,0,30), BackgroundColor3=C.bg3,
    Text="Status  ", TextColor3=C.text,
    Font=Enum.Font.GothamBold, TextSize=13,
    AutoButtonColor=false, LayoutOrder=5, Parent=row1,
})
make("UICorner", {CornerRadius=UDim.new(0,7), Parent=statusBtn})
make("UIStroke", {Color=C.border, Thickness=1, Parent=statusBtn})

-- Status dot inside status button
local statusDot = make("Frame", {
    Size=UDim2.new(0,8,0,8),
    Position=UDim2.new(1,-14,0.5,-4),
    BackgroundColor3=C.red,
    Parent=statusBtn,
})
make("UICorner", {CornerRadius=UDim.new(1,0), Parent=statusDot})

-- ── ROW 2: Connect Code input ─────────────────────────────
local codeFrame = make("Frame", {
    Size=UDim2.new(1,0,0,34), BackgroundColor3=C.bg2,
    LayoutOrder=2, Parent=root,
})
make("UICorner", {CornerRadius=UDim.new(0,8), Parent=codeFrame})
make("UIStroke", {Color=C.border, Thickness=1, Parent=codeFrame})
make("UIPadding", {
    PaddingLeft=UDim.new(0,10), PaddingRight=UDim.new(0,6),
    PaddingTop=UDim.new(0,2), PaddingBottom=UDim.new(0,2),
    Parent=codeFrame,
})
make("UIListLayout", {
    FillDirection=Enum.FillDirection.Horizontal,
    VerticalAlignment=Enum.VerticalAlignment.Center,
    Padding=UDim.new(0,4), Parent=codeFrame,
})
local codeInput = make("TextBox", {
    Size=UDim2.new(1,0,1,0), BackgroundTransparency=1,
    PlaceholderText="Wklej Connect Code ze strony...",
    PlaceholderColor3=C.textSec, TextColor3=C.text,
    Font=Enum.Font.Code, TextSize=11,
    ClearTextOnFocus=false, TextTruncate=Enum.TextTruncate.AtEnd,
    TextXAlignment=Enum.TextXAlignment.Left,
    Text=plugin:GetSetting("Astro_ConnectCode") or "",
    Parent=codeFrame,
})

-- ── ROW 3: Hint text ─────────────────────────────────────
local hintLabel = make("TextLabel", {
    Size=UDim2.new(1,0,0,32), BackgroundTransparency=1,
    Text="Open Astro in the browser, then press Connect",
    TextColor3=C.textSec, Font=Enum.Font.Gotham, TextSize=12,
    TextWrapped=true, TextXAlignment=Enum.TextXAlignment.Center,
    LayoutOrder=3, Parent=root,
})

-- ── ROW 4: Console (mini) ─────────────────────────────────
local consoleFrame = make("ScrollingFrame", {
    Size=UDim2.new(1,0,0,90), BackgroundColor3=C.bg2,
    BorderSizePixel=0, ScrollBarThickness=2,
    CanvasSize=UDim2.new(0,0,0,0),
    AutomaticCanvasSize=Enum.AutomaticSize.Y,
    LayoutOrder=4, Parent=root,
})
make("UICorner", {CornerRadius=UDim.new(0,7), Parent=consoleFrame})
make("UIPadding", {
    PaddingLeft=UDim.new(0,8), PaddingRight=UDim.new(0,8),
    PaddingTop=UDim.new(0,6), PaddingBottom=UDim.new(0,6),
    Parent=consoleFrame,
})
local consoleLayout = make("UIListLayout", {
    SortOrder=Enum.SortOrder.LayoutOrder,
    FillDirection=Enum.FillDirection.Vertical,
    Padding=UDim.new(0,2), Parent=consoleFrame,
})

-- ── LOG ──────────────────────────────────────────────────
local logIdx = 0
local function log(msg, kind)
    logIdx = logIdx + 1
    local colors = {ok=C.green, info=C.textSec, warn=C.yellow, err=C.red, op=Color3.fromRGB(140,180,255)}
    local col = colors[kind] or C.textSec
    local prefix = {ok="OK", info="••", warn="!!", err="ERR", op="→"}
    local lbl = make("TextLabel", {
        Size=UDim2.new(1,0,0,14), BackgroundTransparency=1,
        Text=string.format("[%s] %s", prefix[kind] or "  ", msg),
        TextColor3=col, Font=Enum.Font.Code, TextSize=10,
        TextXAlignment=Enum.TextXAlignment.Left,
        TextTruncate=Enum.TextTruncate.AtEnd,
        LayoutOrder=logIdx, Parent=consoleFrame,
    })
    task.defer(function()
        consoleFrame.CanvasPosition = Vector2.new(0, consoleFrame.AbsoluteCanvasSize.Y)
    end)
end

-- ── PARENT MAP ───────────────────────────────────────────
local function getParent(n)
    local map = {
        ServerScriptService  = game:GetService("ServerScriptService"),
        ReplicatedStorage    = game:GetService("ReplicatedStorage"),
        ServerStorage        = game:GetService("ServerStorage"),
        Workspace            = workspace,
        StarterPlayerScripts = game:GetService("StarterPlayer"):FindFirstChild("StarterPlayerScripts"),
    }
    return map[n] or game:GetService("StarterGui")
end
local function findScript(name, parent)
    local p = getParent(parent)
    for _, c in ipairs(p:GetChildren()) do
        if c.Name == name and (c:IsA("BaseScript") or c:IsA("ModuleScript")) then
            return c
        end
    end
end

-- ── TASK RUNNER ──────────────────────────────────────────
local opsCount = 0
local function runTask(t, idx, total)
    local name   = t.scriptName or "Script"
    local stype  = t.scriptType or "LocalScript"
    local parent = t.parent     or "StarterGui"
    local action = t.action     or "create"
    local pre    = total > 1 and ("[" .. idx .. "/" .. total .. "] ") or ""

    if action == "delete" then
        local e = findScript(name, parent)
        if e then e:Destroy(); log(pre .. "Usunięto: " .. name, "ok")
        else log("Nie znaleziono: " .. name, "warn") end

    elseif action == "update" then
        local e = findScript(name, parent)
        if e then
            e.Source = t.code
            Sel:Set({e}); CHS:SetWaypoint("Update " .. name)
            log(pre .. "Zaktualizowano: " .. name, "ok")
        else action = "create" end
    end

    if action == "create" then
        task.wait(0.25)
        local ok, err = pcall(function()
            local old = findScript(name, parent)
            if old then old:Destroy() end
            local inst
            if     stype == "ModuleScript" then inst = Instance.new("ModuleScript")
            elseif stype == "Script"       then inst = Instance.new("Script")
            else                                inst = Instance.new("LocalScript") end
            inst.Source = t.code; inst.Name = name
            inst.Parent = getParent(parent)
            Sel:Set({inst}); CHS:SetWaypoint("Astro: " .. name)
        end)
        if ok then log(pre .. "Utworzono: " .. name .. " → " .. parent, "ok")
        else      log("Błąd: " .. tostring(err), "err") end
    end
    opsCount = opsCount + 1
end

-- ── POLLING ──────────────────────────────────────────────
local active = false
local function setConnected(on)
    if on then
        connectBtn.Text        = "Disconnect"
        connectBtn.BackgroundColor3 = C.red
        statusDot.BackgroundColor3  = C.green
        tween(statusDot, {BackgroundColor3=C.green}, 0.3)
    else
        connectBtn.Text        = "Connect"
        connectBtn.BackgroundColor3 = C.green
        statusDot.BackgroundColor3  = C.red
        tween(statusDot, {BackgroundColor3=C.red}, 0.3)
    end
end

local function poll(code)
    local ok, result = pcall(function()
        local url  = SERVER .. "/api/queue-dequeue?connectCode=" .. code
        local resp = Http:GetAsync(url, true)
        return Http:JSONDecode(resp)
    end)

    if not ok then
        tween(statusDot, {BackgroundColor3=C.yellow}, 0.2)
        return
    end

    if result.error == "INVALID_CODE" then
        log("Nieprawidłowy Connect Code!", "err")
        active = false; setConnected(false)
        return
    end

    tween(statusDot, {BackgroundColor3=C.green}, 0.2)

    if result.tasks and #result.tasks > 0 then
        log(#result.tasks .. " zadań do wykonania", "op")
        table.sort(result.tasks, function(a,b) return (a.order or 0) < (b.order or 0) end)
        for i, t in ipairs(result.tasks) do
            runTask(t, i, #result.tasks)
            if i < #result.tasks then task.wait(0.3) end
        end
        log("Gotowe! (" .. opsCount .. " operacji łącznie)", "ok")
    end
end

local function start()
    local code = codeInput.Text:match("^%s*(.-)%s*$")
    if not code or code == "" then
        log("Wklej Connect Code ze strony!", "err"); return
    end
    plugin:SetSetting("Astro_ConnectCode", code)
    if active then return end
    active = true
    setConnected(true)
    log("Połączono! Kod: " .. code:sub(1,10) .. "...", "ok")
    task.spawn(function()
        while active do
            poll(code); task.wait(POLL_DELAY)
        end
    end)
end

local function stop()
    active = false; setConnected(false)
    log("Rozłączono", "warn")
end

-- ── EVENTS ───────────────────────────────────────────────
connectBtn.MouseButton1Click:Connect(function()
    if active then stop() else start() end
end)
statusBtn.MouseButton1Click:Connect(function()
    log("Status: " .. (active and "Połączono ✓" or "Rozłączono"), active and "ok" or "warn")
end)
mainBtn.Click:Connect(function()
    w.Enabled = not w.Enabled
end)

-- ── STARTUP ──────────────────────────────────────────────
log("Astro " .. VERSION .. " gotowy", "ok")
log("Wklej Connect Code i kliknij Connect", "info")
