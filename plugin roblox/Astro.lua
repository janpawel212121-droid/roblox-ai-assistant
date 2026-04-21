-- ============================================================
--  Astro Plugin v6  |  Lemonade Theme
--  ciemny grafit, zieleń
-- ============================================================

local SERVER = "https://fleetyai.netlify.app"
local POLL_DELAY = 2
local VERSION = "v6"

local Http = game:GetService("HttpService")
local Sel  = game:GetService("Selection")
local CHS  = game:GetService("ChangeHistoryService")
local TweenService = game:GetService("TweenService")

-- ── Toolbar ──────────────────────────────────────────────
local bar     = plugin:CreateToolbar("Astro")
local mainBtn = bar:CreateButton("Astro", "AI Asystent do projektów Roblox", "rbxassetid://4458901886")
local wInfo   = DockWidgetPluginGuiInfo.new(Enum.InitialDockState.Right, false, false, 320, 520, 280, 320)
local w       = plugin:CreateDockWidgetPluginGui("Astro_v6", wInfo)
w.Title       = "Astro"

-- ── Utility ──────────────────────────────────────────────
local function make(class, props)
    local i = Instance.new(class)
    for k, v in pairs(props) do
        if k ~= "Parent" then
            pcall(function() i[k] = v end)
        end
    end
    if props.Parent then i.Parent = props.Parent end
    return i
end

local function lerp(a, b, t) return a + (b - a) * t end
local function tween(obj, props, dur, style, dir)
    style = style or Enum.EasingStyle.Quart
    dir   = dir   or Enum.EasingDirection.Out
    local info = TweenInfo.new(dur or 0.25, style, dir)
    TweenService:Create(obj, info, props):Play()
end

-- ── PALETTE ──────────────────────────────────────────────
local C = {
    bg         = Color3.fromRGB(26,  26, 26),
    bg2        = Color3.fromRGB(37,  37, 37),
    bg3        = Color3.fromRGB(45,  45, 45),
    bg4        = Color3.fromRGB(53,  53, 53),
    cyan       = Color3.fromRGB(224, 224, 224),
    teal       = Color3.fromRGB(76,  175, 80),
    blue       = Color3.fromRGB(46,  125, 50),
    green      = Color3.fromRGB(76,  175, 80),
    red        = Color3.fromRGB(244, 67,  54),
    yellow     = Color3.fromRGB(255, 235, 59),
    textPrim   = Color3.fromRGB(240, 240, 240),
    textSec    = Color3.fromRGB(204, 204, 204),
    textMuted  = Color3.fromRGB(153, 153, 153),
    white      = Color3.fromRGB(255, 255, 255),
}

-- ── ROOT FRAME ───────────────────────────────────────────
local root = make("Frame", {
    Size             = UDim2.new(1, 0, 1, 0),
    BackgroundColor3 = C.bg,
    BorderSizePixel  = 0,
    Parent           = w,
})
make("UIListLayout", {
    Padding       = UDim.new(0, 0),
    SortOrder     = Enum.SortOrder.LayoutOrder,
    FillDirection = Enum.FillDirection.Vertical,
    Parent        = root,
})

-- ─────────────────────────────────────────────────────────
--  HEADER BAR
-- ─────────────────────────────────────────────────────────
local header = make("Frame", {
    Size             = UDim2.new(1, 0, 0, 50),
    BackgroundColor3 = C.bg2,
    BorderSizePixel  = 0,
    LayoutOrder      = 1,
    Parent           = root,
})
make("UIStroke", { Color = Color3.fromRGB(0, 60, 90), Thickness = 1, Parent = header })

-- Logo icon (gradient square)
local logoIcon = make("Frame", {
    Size             = UDim2.new(0, 30, 0, 30),
    Position         = UDim2.new(0, 12, 0.5, -15),
    BackgroundColor3 = C.cyan,
    BorderSizePixel  = 0,
    Parent           = header,
})
make("UICorner", { CornerRadius = UDim.new(0, 8), Parent = logoIcon })
make("UIGradient", {
    Color    = ColorSequence.new(C.cyan, C.teal),
    Rotation = 135,
    Parent   = logoIcon,
})

local logoLabel = make("TextLabel", {
    Size             = UDim2.new(0, 18, 0, 18),
    Position         = UDim2.new(0.5, -9, 0.5, -9),
    BackgroundTransparency = 1,
    Text             = "~",
    TextColor3       = C.white,
    Font             = Enum.Font.GothamBold,
    TextSize         = 16,
    Parent           = logoIcon,
})

-- Title text
make("TextLabel", {
    Size             = UDim2.new(0, 160, 0, 20),
    Position         = UDim2.new(0, 52, 0, 8),
    BackgroundTransparency = 1,
    Text             = "Astro",
    TextColor3       = C.textPrim,
    Font             = Enum.Font.GothamBold,
    TextSize         = 14,
    TextXAlignment   = Enum.TextXAlignment.Left,
    Parent           = header,
})
make("TextLabel", {
    Size             = UDim2.new(0, 160, 0, 14),
    Position         = UDim2.new(0, 52, 0, 27),
    BackgroundTransparency = 1,
    Text             = "AI Asystent — "..VERSION,
    TextColor3       = C.textMuted,
    Font             = Enum.Font.Gotham,
    TextSize         = 9,
    TextXAlignment   = Enum.TextXAlignment.Left,
    Parent           = header,
})

-- ─────────────────────────────────────────────────────────
--  STATUS BAR
-- ─────────────────────────────────────────────────────────
local statusBar = make("Frame", {
    Size             = UDim2.new(1, 0, 0, 36),
    BackgroundColor3 = C.bg3,
    BorderSizePixel  = 0,
    LayoutOrder      = 2,
    Parent           = root,
})
make("UIStroke", { Color = Color3.fromRGB(0, 50, 80), Thickness = 1, Parent = statusBar })
make("UIPadding", { PaddingLeft = UDim.new(0, 12), PaddingRight = UDim.new(0, 12), Parent = statusBar })

-- Pulsing dot
local statusDot = make("Frame", {
    Size             = UDim2.new(0, 8, 0, 8),
    Position         = UDim2.new(0, 0, 0.5, -4),
    BackgroundColor3 = C.textMuted,
    BorderSizePixel  = 0,
    Parent           = statusBar,
})
make("UICorner", { CornerRadius = UDim.new(1, 0), Parent = statusDot })

local statusTxt = make("TextLabel", {
    Size             = UDim2.new(1, -80, 1, 0),
    Position         = UDim2.new(0, 20, 0, 0),
    BackgroundTransparency = 1,
    Text             = "Oczekuje na połączenie",
    TextColor3       = C.textMuted,
    Font             = Enum.Font.Gotham,
    TextSize         = 10,
    TextXAlignment   = Enum.TextXAlignment.Left,
    Parent           = statusBar,
})

-- Ops counter badge
local opsBadge = make("Frame", {
    Size             = UDim2.new(0, 0, 0, 18),
    AutomaticSize    = Enum.AutomaticSize.X,
    Position         = UDim2.new(1, 0, 0.5, -9),
    AnchorPoint      = Vector2.new(1, 0),
    BackgroundColor3 = C.bg4,
    BorderSizePixel  = 0,
    Parent           = statusBar,
})
make("UICorner", { CornerRadius = UDim.new(0, 99), Parent = opsBadge })
make("UIPadding", { PaddingLeft = UDim.new(0, 6), PaddingRight = UDim.new(0, 6), Parent = opsBadge })
local opsLabel = make("TextLabel", {
    Size             = UDim2.new(1, 0, 1, 0),
    BackgroundTransparency = 1,
    Text             = "0 ops",
    TextColor3       = C.textMuted,
    Font             = Enum.Font.GothamBold,
    TextSize         = 9,
    Parent           = opsBadge,
})

-- ─────────────────────────────────────────────────────────
--  CONNECT CODE INPUT
-- ─────────────────────────────────────────────────────────
local inputSection = make("Frame", {
    Size             = UDim2.new(1, 0, 0, 72),
    BackgroundColor3 = C.bg2,
    BorderSizePixel  = 0,
    LayoutOrder      = 3,
    Parent           = root,
})
make("UIStroke", { Color = Color3.fromRGB(0, 40, 70), Thickness = 1, Parent = inputSection })
make("UIPadding", {
    PaddingLeft  = UDim.new(0, 12), PaddingRight  = UDim.new(0, 12),
    PaddingTop   = UDim.new(0, 10), PaddingBottom = UDim.new(0, 10),
    Parent       = inputSection,
})
make("UIListLayout", { Padding = UDim.new(0, 6), SortOrder = Enum.SortOrder.LayoutOrder, Parent = inputSection })

make("TextLabel", {
    Size             = UDim2.new(1, 0, 0, 10),
    BackgroundTransparency = 1,
    Text             = "CONNECT CODE",
    TextColor3       = C.textMuted,
    Font             = Enum.Font.GothamBold,
    TextSize         = 8,
    TextXAlignment   = Enum.TextXAlignment.Left,
    LayoutOrder      = 1,
    Parent           = inputSection,
})

local codeBox = make("Frame", {
    Size             = UDim2.new(1, 0, 0, 30),
    BackgroundColor3 = Color3.fromRGB(1, 8, 18),
    BorderSizePixel  = 0,
    LayoutOrder      = 2,
    Parent           = inputSection,
})
make("UICorner", { CornerRadius = UDim.new(0, 7), Parent = codeBox })
make("UIStroke", { Color = Color3.fromRGB(0, 60, 100), Thickness = 1, Parent = codeBox })

local codeInput = make("TextBox", {
    Size             = UDim2.new(1, -12, 1, 0),
    Position         = UDim2.new(0, 10, 0, 0),
    BackgroundTransparency = 1,
    Text             = plugin:GetSetting("Astro_ConnectCode") or "",
    PlaceholderText  = "rc_xxxxxxxxxx",
    TextColor3       = C.cyan,
    PlaceholderColor3= C.textMuted,
    Font             = Enum.Font.RobotoMono,
    TextSize         = 11,
    ClearTextOnFocus = false,
    Parent           = codeBox,
})

-- ─────────────────────────────────────────────────────────
--  CONNECT BUTTON
-- ─────────────────────────────────────────────────────────
local connectBtn = make("TextButton", {
    Size             = UDim2.new(1, 0, 0, 34),
    BackgroundColor3 = C.cyan,
    Text             = "",
    BorderSizePixel  = 0,
    LayoutOrder      = 4,
    Parent           = root,
})
make("UICorner", { CornerRadius = UDim.new(0, 0), Parent = connectBtn })
make("UIGradient", {
    Color    = ColorSequence.new(C.cyan, C.teal),
    Rotation = 135,
    Parent   = connectBtn,
})

local connectBtnLabel = make("TextLabel", {
    Size             = UDim2.new(1, 0, 1, 0),
    BackgroundTransparency = 1,
    Text             = "CONNECT",
    TextColor3       = C.white,
    Font             = Enum.Font.GothamBold,
    TextSize         = 12,
    Parent           = connectBtn,
})

-- Hover effect
connectBtn.MouseEnter:Connect(function()
    tween(connectBtn, { BackgroundTransparency = 0.15 }, 0.18)
end)
connectBtn.MouseLeave:Connect(function()
    tween(connectBtn, { BackgroundTransparency = 0 }, 0.18)
end)

-- ─────────────────────────────────────────────────────────
--  DIVIDER
-- ─────────────────────────────────────────────────────────
make("Frame", {
    Size             = UDim2.new(1, 0, 0, 1),
    BackgroundColor3 = Color3.fromRGB(0, 40, 70),
    BorderSizePixel  = 0,
    LayoutOrder      = 5,
    Parent           = root,
})

-- ─────────────────────────────────────────────────────────
--  LOG SECTION HEADER
-- ─────────────────────────────────────────────────────────
local logHeader = make("Frame", {
    Size             = UDim2.new(1, 0, 0, 26),
    BackgroundColor3 = C.bg2,
    BorderSizePixel  = 0,
    LayoutOrder      = 6,
    Parent           = root,
})
make("UIPadding", { PaddingLeft = UDim.new(0, 12), PaddingRight = UDim.new(0, 12), Parent = logHeader })
make("TextLabel", {
    Size             = UDim2.new(1, 0, 1, 0),
    BackgroundTransparency = 1,
    Text             = "KONSOLA",
    TextColor3       = C.textMuted,
    Font             = Enum.Font.GothamBold,
    TextSize          = 8,
    TextXAlignment   = Enum.TextXAlignment.Left,
    Parent           = logHeader,
})

-- ─────────────────────────────────────────────────────────
--  LOG BOX
-- ─────────────────────────────────────────────────────────
local logWrap = make("Frame", {
    Size             = UDim2.new(1, 0, 1, 0),
    BackgroundColor3 = C.bg,
    BorderSizePixel  = 0,
    LayoutOrder      = 7,
    Parent           = root,
})

local logBox = make("ScrollingFrame", {
    Size                 = UDim2.new(1, 0, 1, 0),
    BackgroundColor3     = Color3.fromRGB(1, 6, 14),
    BorderSizePixel      = 0,
    ScrollBarThickness   = 2,
    ScrollBarImageColor3 = C.cyan,
    AutomaticCanvasSize  = Enum.AutomaticSize.Y,
    CanvasSize           = UDim2.new(0, 0, 0, 0),
    ScrollingDirection   = Enum.ScrollingDirection.Y,
    Parent               = logWrap,
})
make("UIListLayout", {
    Padding   = UDim.new(0, 0),
    SortOrder = Enum.SortOrder.LayoutOrder,
    Parent    = logBox,
})
make("UIPadding", {
    PaddingLeft  = UDim.new(0, 10), PaddingRight  = UDim.new(0, 10),
    PaddingTop   = UDim.new(0, 6),  PaddingBottom = UDim.new(0, 6),
    Parent       = logBox,
})

-- ─────────────────────────────────────────────────────────
--  BOTTOM BAR (version)
-- ─────────────────────────────────────────────────────────
make("Frame", {
    Size             = UDim2.new(1, 0, 0, 24),
    BackgroundColor3 = C.bg2,
    BorderSizePixel  = 0,
    LayoutOrder      = 8,
    Parent           = root,
})

-- ────────────────────────────────────────────────────────
--  LOG FUNCTION
-- ─────────────────────────────────────────────────────────
local logN = 0

local LOG_TYPES = {
    info  = { color = C.textSec,  prefix = "INFO " },
    ok    = { color = C.teal,     prefix = "OK   " },
    warn  = { color = C.yellow,   prefix = "WARN " },
    err   = { color = C.red,      prefix = "ERR  " },
    op    = { color = C.cyan,     prefix = "OP   " },
}

local function log(msg, ltype)
    ltype = ltype or "info"
    local lt = LOG_TYPES[ltype] or LOG_TYPES.info
    logN = logN + 1

    local row = make("Frame", {
        Size             = UDim2.new(1, 0, 0, 0),
        AutomaticSize    = Enum.AutomaticSize.Y,
        BackgroundTransparency = 1,
        LayoutOrder      = logN,
        Parent           = logBox,
    })
    make("UIListLayout", {
        FillDirection = Enum.FillDirection.Horizontal,
        Padding       = UDim.new(0, 4),
        SortOrder     = Enum.SortOrder.LayoutOrder,
        VerticalAlignment = Enum.VerticalAlignment.Top,
        Parent        = row,
    })

    -- time
    make("TextLabel", {
        Size             = UDim2.new(0, 55, 0, 0),
        AutomaticSize    = Enum.AutomaticSize.Y,
        BackgroundTransparency = 1,
        Text             = os.date("%H:%M:%S"),
        TextColor3       = C.textMuted,
        Font             = Enum.Font.RobotoMono,
        TextSize         = 9,
        TextXAlignment   = Enum.TextXAlignment.Left,
        LayoutOrder      = 1,
        Parent           = row,
    })
    -- type badge
    make("TextLabel", {
        Size             = UDim2.new(0, 36, 0, 0),
        AutomaticSize    = Enum.AutomaticSize.Y,
        BackgroundTransparency = 1,
        Text             = lt.prefix,
        TextColor3       = lt.color,
        Font             = Enum.Font.GothamBold,
        TextSize         = 9,
        TextXAlignment   = Enum.TextXAlignment.Left,
        LayoutOrder      = 2,
        Parent           = row,
    })
    -- message
    make("TextLabel", {
        Size             = UDim2.new(1, -100, 0, 0),
        AutomaticSize    = Enum.AutomaticSize.Y,
        BackgroundTransparency = 1,
        Text             = msg,
        TextColor3       = lt.color,
        Font             = Enum.Font.RobotoMono,
        TextSize         = 9,
        TextXAlignment   = Enum.TextXAlignment.Left,
        TextWrapped      = true,
        LayoutOrder      = 3,
        Parent           = row,
    })

    task.defer(function()
        logBox.CanvasPosition = Vector2.new(0, logBox.AbsoluteCanvasSize.Y)
    end)
end

-- ─────────────────────────────────────────────────────────
--  STATUS UPDATE
-- ─────────────────────────────────────────────────────────
local function setStatus(text, color)
    statusTxt.Text      = text
    statusTxt.TextColor3 = color
    statusDot.BackgroundColor3 = color
    -- pulse animation
    tween(statusDot, { BackgroundTransparency = 0.6 }, 0.4)
    task.delay(0.4, function()
        tween(statusDot, { BackgroundTransparency = 0 }, 0.4)
    end)
end

-- ─────────────────────────────────────────────────────────
--  PARENT MAP
-- ─────────────────────────────────────────────────────────
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
    for _, child in ipairs(p:GetChildren()) do
        if child.Name == name and (child:IsA("BaseScript") or child:IsA("ModuleScript")) then
            return child
        end
    end
end

-- ─────────────────────────────────────────────────────────
--  TASK RUNNER
-- ─────────────────────────────────────────────────────────
local totalOps = 0

local function runTask(t, idx, total)
    local name   = t.scriptName or "Script"
    local stype  = t.scriptType or "LocalScript"
    local parent = t.parent     or "StarterGui"
    local action = t.action     or "create"
    local prefix = total > 1 and ("[" .. idx .. "/" .. total .. "] ") or ""

    if action == "delete" then
        log(prefix .. "Usuwanie: " .. name, "warn")
        local e = findScript(name, parent)
        if e then
            e:Destroy()
            log("Usunieto: " .. name, "ok")
        else
            log("Nie znaleziono: " .. name, "warn")
        end

    elseif action == "update" then
        log(prefix .. "Update: " .. name, "op")
        local e = findScript(name, parent)
        if e then
            e.Source = t.code
            Sel:Set({e})
            CHS:SetWaypoint("Update " .. name)
            log("Zaktualizowano: " .. name, "ok")
        else
            action = "create" -- fallback
        end
    end

    if action == "create" then
        log(prefix .. "Tworzenie: " .. name, "op")
        task.wait(0.25)
        local ok, err = pcall(function()
            local old = findScript(name, parent)
            if old then old:Destroy() end
            local inst
            if     stype == "ModuleScript" then inst = Instance.new("ModuleScript")
            elseif stype == "Script"       then inst = Instance.new("Script")
            else                                inst = Instance.new("LocalScript")
            end
            inst.Source = t.code
            inst.Name   = name
            inst.Parent = getParent(parent)
            Sel:Set({inst})
            CHS:SetWaypoint("Astro: " .. name)
        end)
        if ok then
            log(name .. " -> " .. parent, "ok")
        else
            log("Blad: " .. tostring(err), "err")
        end
    end

    totalOps = totalOps + 1
    opsLabel.Text = totalOps .. " ops"
end

-- ─────────────────────────────────────────────────────────
--  POLLING
-- ─────────────────────────────────────────────────────────
local active = false

local function poll(code)
    local ok, result = pcall(function()
        local url  = SERVER .. "/api/queue-dequeue?connectCode=" .. code
        local resp = Http:GetAsync(url, true)
        return Http:JSONDecode(resp)
    end)

    if not ok then
        setStatus("Blad sieci", C.yellow)
        return
    end

    local data = result

    if data.error == "INVALID_CODE" then
        log("Nieprawidlowy Connect Code!", "err")
        active = false
        return
    end

    setStatus("Polaczono", C.teal)

    if data.tasks and #data.tasks > 0 then
        log(#data.tasks .. " operacji do wykonania", "op")
        table.sort(data.tasks, function(a, b) return (a.order or 0) < (b.order or 0) end)
        for i, t in ipairs(data.tasks) do
            runTask(t, i, #data.tasks)
            if i < #data.tasks then task.wait(0.35) end
        end
        log("Wszystkie operacje zakonczone!", "ok")
    end
end

-- ─────────────────────────────────────────────────────────
--  CONNECT / DISCONNECT
-- ─────────────────────────────────────────────────────────
local function setConnectState(connected)
    if connected then
        connectBtnLabel.Text = "ROZLACZ"
        -- red gradient on disconnect
        local grad = connectBtn:FindFirstChildOfClass("UIGradient")
        if grad then
            grad.Color = ColorSequence.new(Color3.fromRGB(220, 50, 80), Color3.fromRGB(180, 30, 60))
        end
        connectBtn.BackgroundColor3 = Color3.fromRGB(220, 50, 80)
    else
        connectBtnLabel.Text = "CONNECT"
        local grad = connectBtn:FindFirstChildOfClass("UIGradient")
        if grad then
            grad.Color = ColorSequence.new(C.cyan, C.teal)
        end
        connectBtn.BackgroundColor3 = C.cyan
    end
end

local function start()
    local code = codeInput.Text:match("^%s*(.-)%s*$")
    if not code or code == "" then
        log("Wpisz Connect Code ze strony!", "err")
        return
    end
    plugin:SetSetting("Astro_ConnectCode", code)
    if active then return end
    active = true

    setConnectState(true)
    setStatus("Laczenie...", C.cyan)
    log("Polaczono! Kod: " .. code:sub(1, 8) .. "...", "ok")

    task.spawn(function()
        while active do
            poll(code)
            task.wait(POLL_DELAY)
        end
    end)
end

local function stop()
    active = false
    setConnectState(false)
    setStatus("Rozlaczono", C.yellow)
    log("Rozlaczono", "warn")
end

-- ─────────────────────────────────────────────────────────
--  EVENTS
-- ─────────────────────────────────────────────────────────
connectBtn.MouseButton1Click:Connect(function()
    if active then stop() else start() end
end)

mainBtn.Click:Connect(function()
    w.Enabled = not w.Enabled
end)

-- ─────────────────────────────────────────────────────────
--  STARTUP LOGS
-- ─────────────────────────────────────────────────────────
log("Astro " .. VERSION .. " gotowy", "ok")
log("Wpisz Connect Code i kliknij CONNECT", "info")
