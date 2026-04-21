var App = {
    sessionToken: localStorage.getItem('roboai_session') || '',
    userId: '',
    username: '',
    connectCode: '',
    credits: 0,
    usage: 0,
    isAdmin: false,

    chats: [],
    currentChatId: null,

    messages: [],
    files: [],
    currentFile: null,
    generating: false,

    init: function() {
        this.cacheDom();
        this.bindEvents();

        if (this.sessionToken) {
            this.verifySession();
        } else {
            this.showAuth();
        }
    },

    cacheDom: function() {
        this.dom = {
            authModal:    document.getElementById('authModal'),
            tabLoginBtn:  document.getElementById('tabLoginBtn'),
            tabRegBtn:    document.getElementById('tabRegBtn'),
            loginForm:    document.getElementById('loginForm'),
            regForm:      document.getElementById('regForm'),
            authError:    document.getElementById('authError'),
            authErrorText:document.getElementById('authErrorText'),

            uiUsername:   document.getElementById('uiUsername'),
            uiCredits:    document.getElementById('uiCredits'),
            uiUsage:      document.getElementById('uiUsage'),
            uiConnectCode:document.getElementById('uiConnectCode'),

            accUser:    document.getElementById('accUser'),
            accEmail:   document.getElementById('accEmail'),
            accCode:    document.getElementById('accCode'),
            accCredits: document.getElementById('accCredits'),
            accUsage:   document.getElementById('accUsage'),

            consoleOutput: document.getElementById('consoleOutput'),
            fileTree:      document.getElementById('fileTree'),
            chatsList:     document.getElementById('chatsList'),
            newChatBtn:    document.getElementById('newChatBtn'),

            chat:       document.getElementById('chat'),
            msgInput:   document.getElementById('msgInput'),
            sendBtn:    document.getElementById('sendBtn'),
            messages:   document.getElementById('messages'),
            welcome:    document.getElementById('welcome'),
            typing:     document.getElementById('typing'),
            modelSelect:document.getElementById('modelSelect'),
            autoInsert: document.getElementById('autoInsert'),

            historyList: document.getElementById('historyList'),
            adminTab:    document.getElementById('adminTab'),
            adminPass:   document.getElementById('adminPass'),
            adminUserId: document.getElementById('adminUserId'),
            adminAmount: document.getElementById('adminAmount'),

            editorFileName: document.getElementById('editorFileName'),
            editorCode:     document.getElementById('editorCode'),
            editorFileNameText: null,

            notifs: document.getElementById('notifs')
        };
    },

    bindEvents: function() {
        var self = this;

        // Auth Tabs
        this.dom.tabLoginBtn.onclick = function() {
            self.dom.tabLoginBtn.classList.add('active');
            self.dom.tabRegBtn.classList.remove('active');
            self.dom.loginForm.classList.remove('hidden');
            self.dom.regForm.classList.add('hidden');
            self.setAuthError('');
        };
        this.dom.tabRegBtn.onclick = function() {
            self.dom.tabRegBtn.classList.add('active');
            self.dom.tabLoginBtn.classList.remove('active');
            self.dom.regForm.classList.remove('hidden');
            self.dom.loginForm.classList.add('hidden');
            self.setAuthError('');
        };

        // Auth Submit
        this.dom.loginForm.onsubmit = function(e) { e.preventDefault(); self.doLogin(); };
        this.dom.regForm.onsubmit   = function(e) { e.preventDefault(); self.doRegister(); };
        document.getElementById('logoutBtn').onclick = function() { self.doLogout(); };

        // Nav tabs
        document.querySelectorAll('.tab').forEach(function(t) {
            t.onclick = function() {
                document.querySelectorAll('.tab').forEach(function(x) { x.classList.remove('active'); });
                t.classList.add('active');
                var target = t.getAttribute('data-target');
                document.querySelectorAll('.view-container').forEach(function(v) { v.classList.add('hidden'); });
                document.getElementById(target).classList.remove('hidden');

                if (target === 'viewHistory') self.loadHistory();
                if (target === 'viewAdmin')   self.adminLoadApiKey();
            };
        });

        // Chat
        this.dom.newChatBtn.onclick = function() { self.createNewChat(); };
        this.dom.sendBtn.onclick    = function() { self.send(); };
        this.dom.msgInput.onkeydown = function(e) {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); self.send(); }
        };
        this.dom.msgInput.oninput = function() {
            self.dom.sendBtn.disabled = !this.value.trim() || self.generating;
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 140) + 'px';
        };

        // Suggestion chips
        document.querySelectorAll('.chip').forEach(function(b) {
            b.onclick = function() {
                self.dom.msgInput.value = b.getAttribute('data-prompt');
                self.dom.sendBtn.disabled = false;
                self.send();
            };
        });

        // Copy connect code
        document.getElementById('copyCodeBtn').onclick = function() {
            if (self.connectCode) {
                navigator.clipboard.writeText(self.connectCode);
                self.notify('Connect Code skopiowany!', 'success');
            }
        };

        // Clear console
        document.getElementById('clearConsole').onclick = function() {
            self.dom.consoleOutput.innerHTML = '';
            self.consolePrint('Konsola wyczyszczona', 'info');
        };

        // Admin
        document.getElementById('adminAddBtn').onclick    = function() { self.adminAddCredits(); };
        document.getElementById('adminSetKeyBtn').onclick = function() { self.adminSetApiKey(); };
        document.getElementById('adminCheckKeyBtn').onclick = function() { self.adminLoadApiKey(); };

        // Editor
        document.getElementById('editorSave').onclick   = function() { self.editorSave(); };
        document.getElementById('editorDelete').onclick = function() { self.editorDelete(); };

        this.dom.editorCode.onkeydown = function(e) {
            if (e.key === 'Tab') {
                e.preventDefault();
                var s = this.selectionStart, end = this.selectionEnd;
                this.value = this.value.substring(0, s) + '    ' + this.value.substring(end);
                this.selectionStart = this.selectionEnd = s + 4;
            }
        };

        // Credit packages — placeholder
        document.querySelectorAll('.credit-pkg').forEach(function(pkg) {
            pkg.onclick = function() {
                self.notify('Płatności wkrótce dostępne!', 'info');
            };
        });
    },

    // ==========================================
    // AUTH
    // ==========================================
    showAuth: function() { this.dom.authModal.classList.add('active'); },
    hideAuth: function() { this.dom.authModal.classList.remove('active'); },

    setAuthError: function(msg) {
        this.dom.authErrorText.textContent = msg;
        this.dom.authError.style.display = msg ? 'flex' : 'none';
        this.dom.authError.style.opacity = msg ? '1' : '0';
    },

    verifySession: function() {
        var self = this;
        fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'verify', sessionToken: this.sessionToken })
        })
        .then(function(r) { return r.json(); })
        .then(function(d) {
            if (d.success) {
                self.setUserData(d);
                self.hideAuth();
                self.consolePrint('Zalogowano jako ' + d.username, 'success');
            } else {
                self.sessionToken = '';
                localStorage.removeItem('roboai_session');
                self.showAuth();
            }
        }).catch(function() {
            self.sessionToken = '';
            localStorage.removeItem('roboai_session');
            self.showAuth();
        });
    },

    doLogin: function() {
        var self = this;
        var email    = document.getElementById('logEmail').value;
        var pass     = document.getElementById('logPass').value;
        var remember = document.getElementById('rememberMe').checked;
        this.setAuthError('Logowanie...');

        fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'login', email: email, password: pass })
        })
        .then(function(r) { return r.json(); })
        .then(function(d) {
            if (d.success) {
                if (remember) {
                    localStorage.setItem('roboai_session', d.sessionToken);
                } else {
                    sessionStorage.setItem('roboai_session_temp', d.sessionToken);
                }
                self.sessionToken = d.sessionToken;
                self.setUserData(d);
                self.hideAuth();
                self.setAuthError('');
                self.consolePrint('Zalogowano!', 'success');
                self.notify('Zalogowano pomyślnie!', 'success');
            } else {
                self.setAuthError(d.error || 'Błąd logowania');
            }
        }).catch(function(e) {
            self.setAuthError('Błąd sieci: ' + e.message);
        });
    },

    doRegister: function() {
        var self = this;
        var user     = document.getElementById('regUser').value;
        var email    = document.getElementById('regEmail').value;
        var pass     = document.getElementById('regPass').value;
        var remember = document.getElementById('rememberMeReg').checked;
        
        if (pass.length < 6) {
            this.setAuthError('Hasło musi mieć minimum 6 znaków!');
            return;
        }
        
        this.setAuthError('Tworzenie konta...');

        fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'register', username: user, email: email, password: pass })
        })
        .then(function(r) { return r.json(); })
        .then(function(d) {
            if (d.success) {
                if (remember) {
                    localStorage.setItem('roboai_session', d.sessionToken);
                } else {
                    sessionStorage.setItem('roboai_session_temp', d.sessionToken);
                }
                self.sessionToken = d.sessionToken;
                self.setUserData(d);
                self.hideAuth();
                self.setAuthError('');
                self.consolePrint('Konto utworzone!', 'success');
                self.notify('Konto utworzone! Witaj! Masz 10 startowych kredytów.', 'success');
            } else {
                self.setAuthError(d.error || 'Błąd rejestracji');
            }
        }).catch(function(e) {
            self.setAuthError('Błąd sieci: ' + e.message);
        });
    },

    doLogout: function() {
        this.sessionToken = '';
        localStorage.removeItem('roboai_session');
        sessionStorage.removeItem('roboai_session_temp');
        window.location.reload();
    },

    setUserData: function(d) {
        this.userId      = d.userId;
        this.username    = d.username;
        this.connectCode = d.connectCode;
        this.credits     = d.credits || 0;
        this.usage       = d.usage   || 0;

        this.dom.uiUsername.textContent    = d.username;
        this.dom.uiConnectCode.textContent = d.connectCode;
        this.animateCounter(this.dom.uiCredits, 0, this.credits, 600);
        this.animateCounter(this.dom.uiUsage,   0, this.usage,   600);

        this.dom.accUser.textContent    = d.username;
        this.dom.accEmail.textContent   = d.email || d.userId;
        this.dom.accCode.textContent    = d.connectCode;
        this.animateCounter(this.dom.accCredits, 0, this.credits, 800);
        this.animateCounter(this.dom.accUsage,   0, this.usage,   800);

        if (d.isAdmin || d.email === 'janpawel212121@gmail.com' || d.username === 'Fleety001') {
            this.isAdmin = true;
            this.dom.adminTab.classList.remove('hidden');
        } else {
            this.isAdmin = false;
            this.dom.adminTab.classList.add('hidden');
        }
        
        // Load isolated user chats
        this.loadChats();
    },

    animateCounter: function(el, from, to, duration) {
        if (!el) return;
        var start = performance.now();
        var self = this;
        function step(now) {
            var t = Math.min((now - start) / duration, 1);
            var ease = 1 - Math.pow(1 - t, 3);
            el.textContent = Math.round(from + (to - from) * ease);
            if (t < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
    },

    // ==========================================
    // CHAT & AI
    // ==========================================
    send: function() {
        var self = this;
        var text = this.dom.msgInput.value.trim();
        if (!text || this.generating) return;

        var modeEl = document.querySelector('input[name="aiMode"]:checked');
        var mode   = modeEl ? modeEl.value : 'quick';
        var cost   = mode === 'plan' ? 3 : 1;

        if (this.credits < cost) {
            this.notify('Brak kredytów! Potrzebujesz: ' + cost + ', masz: ' + this.credits, 'error');
            return;
        }

        this.dom.welcome.style.display = 'none';
        this.addMsg('user', text);
        this.dom.msgInput.value = '';
        this.dom.sendBtn.disabled = true;
        this.dom.msgInput.style.height = 'auto';

        this.generating = true;
        this.dom.typing.classList.add('active');
        this.consolePrint('Wysyłanie (' + mode + ', koszt: ' + cost + ' kr.)...', 'info');
        this.scrollDown();

        var fileCtx = '';
        if (this.files.length > 0) {
            fileCtx = '\n\nAKTUALNE PLIKI W PROJEKCIE:\n';
            for (var k = 0; k < this.files.length; k++) {
                var ff = this.files[k];
                fileCtx += '- ' + ff.name + ' (' + ff.type + ' w ' + ff.parent + ')\n';
            }
            fileCtx += '\nJeśli użytkownik chce ZMIENIĆ istniejący plik, użyj @ACTION: update z tą samą nazwą.\n';
            fileCtx += 'Jeśli chce USUNĄĆ plik, użyj @ACTION: delete.\n';
        }

        var apiMsgs = [{ role: 'system', content: this.getSysPrompt() + fileCtx }];
        for (var i = 0; i < this.messages.length; i++) {
            apiMsgs.push({ role: this.messages[i].role, content: this.messages[i].text });
        }

        fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionToken: this.sessionToken,
                messages:     apiMsgs,
                model:        this.dom.modelSelect.value,
                mode:         mode
            })
        })
        .then(function(r) { return r.json(); })
        .then(function(d) {
            if (d.error === 'NO_CREDITS' || d.error === 'NOT_ENOUGH') {
                throw new Error('Brak kredytów! Doładuj konto.');
            }
            if (d.error === 'LOGIN_REQUIRED' || d.error === 'INVALID_SESSION') {
                self.notify('Sesja wygasła — zaloguj się ponownie', 'error');
                self.doLogout();
                return;
            }
            if (d.error) throw new Error(d.error);

            self.addMsg('bot', d.content);
            self.credits = d.credits;
            self.usage   = d.usage;
            self.updateCreditsDisplay();
            self.consolePrint('Odpowiedź AI (' + d.cost + ' kr. użyte, pozostało: ' + d.credits + ' kr.)', 'success');

            if (self.dom.autoInsert.checked) {
                var blocks = self.extractCode(d.content);
                if (blocks.length > 0) {
                    self.consolePrint('Znaleziono ' + blocks.length + ' bloków kodu — wysyłam do pluginu', 'info');
                    self.sendToPlugin(blocks);
                }
            }
        })
        .catch(function(e) {
            self.addMsg('bot', 'Błąd: ' + e.message);
            self.notify(e.message, 'error');
            self.consolePrint('Błąd: ' + e.message, 'error');
        })
        .finally(function() {
            self.generating = false;
            self.dom.typing.classList.remove('active');
            self.dom.sendBtn.disabled = !self.dom.msgInput.value.trim();
        });
    },

    updateCreditsDisplay: function() {
        this.dom.uiCredits.textContent  = this.credits;
        this.dom.uiUsage.textContent    = this.usage;
        this.dom.accCredits.textContent = this.credits;
        this.dom.accUsage.textContent   = this.usage;
    },

    getSysPrompt: function() {
        return 'Jesteś ekspertem Roblox Studio i Luau. Tworzysz kompletne, działające systemy.\n\n' +
        'FORMAT KODU — KRYTYCZNIE WAŻNE:\n' +
        'Każdy blok kodu MUSI mieć na PIERWSZEJ LINII konfigurację w DOKŁADNIE takim formacie:\n' +
        '-- @NAME: NazwaPliku | @TYPE: TypSkryptu | @PARENT: Lokalizacja | @ACTION: create\n\n' +
        'Dozwolone @TYPE: LocalScript, Script, ModuleScript\n' +
        'Dozwolone @PARENT: StarterGui, ServerScriptService, ReplicatedStorage, StarterPlayerScripts, ServerStorage\n' +
        'Dozwolone @ACTION: create (nowy plik), update (zmień istniejący), delete (usuń plik)\n\n' +
        'PRZYKŁAD:\n' +
        '```lua\n' +
        '-- @NAME: MainMenuGUI | @TYPE: LocalScript | @PARENT: StarterGui | @ACTION: create\n' +
        'local Players = game:GetService("Players")\n' +
        '-- kod...\n' +
        '```\n\n' +
        'ZASADY PLANOWANIA:\n' +
        '1. ZAWSZE zacznij od PLANU — opisz jakie pliki stworzysz/zmienisz\n' +
        '2. Użyj **Plan:** na początku\n' +
        '3. Opisz architekturę i zależności między plikami\n\n' +
        'ZASADY KODU:\n' +
        '1. Pisz WYŁĄCZNIE w Luau\n' +
        '2. Kod musi działać od razu\n' +
        '3. GUI twórz z Instance.new() — ScreenGui, Frame, TextButton, UICorner, UIGradient itd.\n' +
        '4. ZAWSZE dodawaj animacje TweenService\n' +
        '5. Używaj ładnych kolorów, gradientów, zaokrągleń\n' +
        '6. Pisz DŁUGI, SZCZEGÓŁOWY kod — minimum 100 linii na skrypt GUI\n' +
        '7. Dodawaj komentarze po polsku\n' +
        '8. Obsługuj błędy z pcall\n' +
        '9. Możesz generować WIELE plików w jednej odpowiedzi\n\n' +
        'Odpowiadaj po polsku. Bądź profesjonalny i szczegółowy.';
    },

    addMsg: function(role, text) {
        this.messages.push({ role: role === 'bot' ? 'assistant' : 'user', text: text });
        var div     = document.createElement('div');
        div.className = 'msg ' + role;
        var content   = role === 'bot' ? this.parseBotMsg(text) : this.esc(text);

        if (role === 'bot') {
            div.innerHTML =
                '<div class="msg-avatar bot">' +
                    '<svg style="width:16px;height:16px;color:#fff;"><use href="#ic-robot"/></svg>' +
                '</div>' +
                '<div class="msg-body"><div class="msg-bubble">' + content + '</div></div>';
        } else {
            div.innerHTML =
                '<div class="msg-avatar">' +
                    '<svg style="width:16px;height:16px;color:var(--text3);"><use href="#ic-user"/></svg>' +
                '</div>' +
                '<div class="msg-body"><div class="msg-bubble">' + content + '</div></div>';
        }

        this.dom.messages.appendChild(div);
        this.saveChats();
        this.scrollDown();
    },

    parseBotMsg: function(text) {
        var self = this;
        var html = text;
        html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, function(_, lang, code) {
            var info = self.parseInfo(code);
            self.addFile(info.name, code, info.type, info.parent);
            self.saveChats();
            var actionBadge = '';
            if (info.action === 'update') actionBadge = ' <span style="color:var(--yellow);font-size:0.63rem;font-weight:700;">UPDATE</span>';
            else if (info.action === 'delete') actionBadge = ' <span style="color:var(--red);font-size:0.63rem;font-weight:700;">DELETE</span>';
            var copyId = 'cb_' + Date.now() + '_' + Math.random().toString(36).slice(2);
            return '<div class="code-wrap">' +
                '<div class="code-top">' +
                    '<span class="code-lang">' +
                        '<svg style="width:12px;height:12px;"><use href="#ic-file-code"/></svg> ' +
                        self.esc(info.name) +
                        '<span class="code-lang-info">' + info.type + ' → ' + info.parent + '</span>' +
                        actionBadge +
                    '</span>' +
                    '<div class="code-btns">' +
                        '<button class="code-btn" onclick="App.copyCode(this)" data-code="' + self.escAttr(code.trim()) + '">' +
                            '<svg><use href="#ic-copy"/></svg> Kopiuj' +
                        '</button>' +
                        '<button class="code-btn" onclick="App.insertCode(this)" data-name="' + self.escAttr(info.name) + '" data-code="' + self.escAttr(code.trim()) + '">' +
                            '<svg><use href="#ic-bolt"/></svg> Wyślij' +
                        '</button>' +
                    '</div>' +
                '</div>' +
                '<pre><code>' + self.esc(code.trim()) + '</code></pre>' +
                '</div>';
        });
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/`([^`]+)`/g, '<code style="background:rgba(0,212,255,0.08);border:1px solid var(--border);padding:2px 7px;border-radius:4px;font-size:0.8em;font-family:var(--mono);">$1</code>');
        html = html.replace(/\n/g, '<br>');
        this.renderTree();
        return html;
    },

    parseBotMsgSilently: function(text) {
        var self = this;
        var html = text;
        html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, function(_, lang, code) {
            var info = self.parseInfo(code);
            var actionBadge = '';
            if (info.action === 'update') actionBadge = ' <span style="color:var(--yellow);font-size:0.63rem;font-weight:700;">UPDATE</span>';
            else if (info.action === 'delete') actionBadge = ' <span style="color:var(--red);font-size:0.63rem;font-weight:700;">DELETE</span>';
            return '<div class="code-wrap">' +
                '<div class="code-top">' +
                    '<span class="code-lang">' +
                        '<svg style="width:12px;height:12px;"><use href="#ic-file-code"/></svg> ' +
                        self.esc(info.name) +
                        '<span class="code-lang-info">' + info.type + ' → ' + info.parent + '</span>' +
                        actionBadge +
                    '</span>' +
                    '<div class="code-btns">' +
                        '<button class="code-btn" onclick="App.copyCode(this)" data-code="' + self.escAttr(code.trim()) + '">' +
                            '<svg><use href="#ic-copy"/></svg> Kopiuj' +
                        '</button>' +
                    '</div>' +
                '</div>' +
                '<pre><code>' + self.esc(code.trim()) + '</code></pre>' +
                '</div>';
        });
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/`([^`]+)`/g, '<code style="background:rgba(0,212,255,0.08);border:1px solid var(--border);padding:2px 7px;border-radius:4px;font-size:0.8em;font-family:var(--mono);">$1</code>');
        html = html.replace(/\n/g, '<br>');
        return html;
    },

    copyCode: function(btn) {
        var code = btn.getAttribute('data-code');
        navigator.clipboard.writeText(code);
        this.notify('Kod skopiowany!', 'success');
    },

    insertCode: function(btn) {
        var code = btn.getAttribute('data-code');
        var name = btn.getAttribute('data-name');
        var self = this;
        var blocks = [{ code: code }];
        self.sendToPlugin(blocks);
        self.notify('Wysłano "' + name + '" do pluginu!', 'success');
    },

    parseInfo: function(code) {
        var n = 'Script', t = 'LocalScript', p = 'StarterGui', a = 'create';
        var nm = code.match(/@NAME:\s*([^|@\n]+)/i);  if (nm) n = nm[1].trim();
        var tp = code.match(/@TYPE:\s*(\w+)/i);        if (tp) t = tp[1].trim();
        var pr = code.match(/@PARENT:\s*(\w+)/i);      if (pr) p = pr[1].trim();
        var ac = code.match(/@ACTION:\s*(\w+)/i);      if (ac) a = ac[1].trim().toLowerCase();
        return { name: n, type: t, parent: p, action: a };
    },

    extractCode: function(text) {
        var blocks = [], re = /```(\w+)?\n([\s\S]*?)```/g, m;
        while ((m = re.exec(text)) !== null) blocks.push({ code: m[2].trim() });
        return blocks;
    },

    esc: function(t) { var d = document.createElement('div'); d.textContent = t; return d.innerHTML; },
    escAttr: function(t) { return t.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); },

    scrollDown: function() {
        var c = this.dom.chat;
        requestAnimationFrame(function() { c.scrollTop = c.scrollHeight; });
    },

    // ==========================================
    // PLUGIN & FILES
    // ==========================================
    sendToPlugin: function(blocks) {
        var tasks = [];
        for (var i = 0; i < blocks.length; i++) {
            var inf = this.parseInfo(blocks[i].code);
            tasks.push({
                id:         't_' + Date.now() + '_' + i,
                code:       blocks[i].code,
                scriptName: inf.name,
                scriptType: inf.type,
                parent:     inf.parent,
                action:     inf.action,
                order:      i + 1,
                total:      blocks.length,
                timestamp:  Date.now()
            });
        }

        var self = this;
        fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'addTasks', userId: this.userId, tasks: tasks })
        })
        .then(function(r) { return r.json(); })
        .then(function(d) {
            if (d.success) {
                self.consolePrint(tasks.length + ' zadań wysłanych do pluginu ✓', 'success');
            } else {
                self.consolePrint('Błąd wysyłki: ' + (d.error || 'Nieznany'), 'error');
            }
        })
        .catch(function(e) {
            self.consolePrint('Błąd sieci: ' + e.message, 'error');
        });
    },

    addFile: function(name, code, type, parent) {
        this.files = this.files.filter(function(f) { return f.name !== name; });
        this.files.push({ name: name, code: code, type: type, parent: parent });
    },

    renderTree: function() {
        var self = this;
        if (this.files.length === 0) {
            this.dom.fileTree.innerHTML =
                '<div class="tree-empty">' +
                    '<svg><use href="#ic-inbox"/></svg>' +
                    '<p>Brak plików</p>' +
                '</div>';
            return;
        }

        var groups = {};
        for (var i = 0; i < this.files.length; i++) {
            var f = this.files[i];
            if (!groups[f.parent]) groups[f.parent] = [];
            groups[f.parent].push(f);
        }

        var parentIconMap = {
            StarterGui:           'ic-display',
            ServerScriptService:  'ic-server',
            ReplicatedStorage:    'ic-db',
            StarterPlayerScripts: 'ic-user',
            ServerStorage:        'ic-box'
        };

        var html = '';
        for (var parentName in groups) {
            var pIcon = parentIconMap[parentName] || 'ic-folder';
            html += '<div style="margin-bottom:5px;">';
            html += '<div class="tree-folder-label"><svg><use href="#' + pIcon + '"/></svg> ' + parentName + '</div>';
            var items = groups[parentName];
            for (var j = 0; j < items.length; j++) {
                var file   = items[j];
                var active = self.currentFile && self.currentFile.name === file.name ? ' active' : '';
                html += '<div class="tree-file' + active + '" data-name="' + self.escAttr(file.name) + '">' +
                    '<svg><use href="#ic-file-code"/></svg> ' + self.esc(file.name) + '</div>';
            }
            html += '</div>';
        }

        this.dom.fileTree.innerHTML = html;
        this.dom.fileTree.querySelectorAll('.tree-file').forEach(function(el) {
            el.onclick = function() { self.openEditor(el.getAttribute('data-name')); };
        });
    },

    openEditor: function(name) {
        var f = this.files.find(function(x) { return x.name === name; });
        if (!f) return;
        this.currentFile = f;
        this.dom.editorFileName.innerHTML =
            '<svg><use href="#ic-file-code"/></svg>' +
            this.esc(f.name) + ' <span style="color:var(--text4);font-weight:400;font-size:0.75rem;">(' + f.type + ' → ' + f.parent + ')</span>';
        this.dom.editorCode.value = f.code;

        document.querySelectorAll('.tab').forEach(function(x) { x.classList.remove('active'); });
        document.querySelector('[data-target="viewEditor"]').classList.add('active');
        document.querySelectorAll('.view-container').forEach(function(v) { v.classList.add('hidden'); });
        document.getElementById('viewEditor').classList.remove('hidden');

        this.renderTree();
        this.consolePrint('Otwarty: ' + f.name, 'info');
    },

    editorSave: function() {
        if (!this.currentFile) { this.notify('Najpierw wybierz plik z Explorera', 'warn'); return; }
        this.currentFile.code = this.dom.editorCode.value;
        this.sendToPlugin([{ code: this.currentFile.code }]);
        this.notify('Zapisano i wysłano do pluginu!', 'success');
        this.consolePrint('Zapisano: ' + this.currentFile.name, 'success');
    },

    editorDelete: function() {
        if (!this.currentFile) return;
        var name = this.currentFile.name;
        var task = {
            id: 'd_' + Date.now(), code: '',
            scriptName: this.currentFile.name,
            scriptType: this.currentFile.type,
            parent:     this.currentFile.parent,
            action:     'delete'
        };
        fetch('/api/chat', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'addTasks', userId: this.userId, tasks: [task] })
        });
        this.files = this.files.filter(function(x) { return x.name !== name; });
        this.currentFile = null;
        this.dom.editorFileName.innerHTML = '<svg><use href="#ic-file-code"/></svg> Wybierz plik z Explorera';
        this.dom.editorCode.value = '';
        this.renderTree();
        this.saveChats();
        this.notify(name + ' usunięty', 'info');
        this.consolePrint('Usunięto: ' + name, 'warn');
    },

    // ==========================================
    // CHAT MANAGEMENT
    // ==========================================
    loadChats: function() {
        var saved = localStorage.getItem('roboai_chats_' + this.userId);
        if (saved) {
            try { this.chats = JSON.parse(saved); } catch (e) { this.chats = []; }
        } else {
            this.chats = [];
        }
        
        if (this.chats.length === 0) {
            this.createNewChat(true);
        } else {
            this.switchChat(this.chats[0].id);
        }
    },

    saveChats: function() {
        if (!this.currentChatId) return;
        var chat = this.chats.find(function(c) { return c.id === App.currentChatId; });
        if (chat) {
            chat.messages = this.messages;
            chat.files    = this.files;
            if (this.messages.length > 0 && chat.title === 'Nowy czat') {
                chat.title = this.messages[0].text.substring(0, 32) + '...';
            }
        }
        localStorage.setItem('roboai_chats_' + this.userId, JSON.stringify(this.chats));
        this.renderChatsList();
    },

    createNewChat: function(isInitial) {
        if (!isInitial) this.saveChats();
        var newId = 'chat_' + Date.now();
        this.chats.unshift({ id: newId, title: 'Nowy czat', messages: [], files: [] });
        this.switchChat(newId);
    },

    switchChat: function(id) {
        if (this.currentChatId && this.currentChatId !== id) this.saveChats();
        var chat = this.chats.find(function(c) { return c.id === id; });
        if (!chat) return;

        this.currentChatId = id;
        this.messages = JSON.parse(JSON.stringify(chat.messages));
        this.files    = JSON.parse(JSON.stringify(chat.files));

        this.renderChatsList();
        this.renderMessages();
        this.renderTree();

        this.dom.welcome.style.display = this.messages.length === 0 ? 'block' : 'none';
        this.currentFile = null;
        this.dom.editorFileName.innerHTML = '<svg><use href="#ic-file-code"/></svg> Wybierz plik z Explorera';
        this.dom.editorCode.value = '';
        this.scrollDown();
    },

    deleteChat: function(id, e) {
        e.stopPropagation();
        this.chats = this.chats.filter(function(c) { return c.id !== id; });
        if (this.chats.length === 0) {
            this.createNewChat(true);
        } else if (this.currentChatId === id) {
            this.switchChat(this.chats[0].id);
        } else {
            this.saveChats();
            this.renderChatsList();
        }
    },

    renderChatsList: function() {
        var self  = this;
        var html  = '';
        var limit = Math.min(this.chats.length, 20);
        for (var i = 0; i < limit; i++) {
            var c      = this.chats[i];
            var active = c.id === this.currentChatId ? ' active' : '';
            html +=
                '<div class="chat-item' + active + '" data-id="' + c.id + '">' +
                    '<div class="chat-item-title">' +
                        '<svg><use href="#ic-message"/></svg>' +
                        this.esc(c.title) +
                    '</div>' +
                    '<button class="chat-item-del" data-id="' + c.id + '">' +
                        '<svg><use href="#ic-trash"/></svg>' +
                    '</button>' +
                '</div>';
        }
        this.dom.chatsList.innerHTML = html;
        this.dom.chatsList.querySelectorAll('.chat-item').forEach(function(el) {
            el.onclick = function() { self.switchChat(this.getAttribute('data-id')); };
        });
        this.dom.chatsList.querySelectorAll('.chat-item-del').forEach(function(el) {
            el.onclick = function(e) { self.deleteChat(this.getAttribute('data-id'), e); };
        });
    },

    renderMessages: function() {
        this.dom.messages.innerHTML = '';
        for (var i = 0; i < this.messages.length; i++) {
            var m         = this.messages[i];
            var roleClass = m.role === 'assistant' ? 'bot' : 'user';
            var div       = document.createElement('div');
            div.className = 'msg ' + roleClass;
            var content   = roleClass === 'bot' ? this.parseBotMsgSilently(m.text) : this.esc(m.text);
            if (roleClass === 'bot') {
                div.innerHTML =
                    '<div class="msg-avatar bot">' +
                        '<svg style="width:16px;height:16px;color:#fff;"><use href="#ic-robot"/></svg>' +
                    '</div>' +
                    '<div class="msg-body"><div class="msg-bubble">' + content + '</div></div>';
            } else {
                div.innerHTML =
                    '<div class="msg-avatar">' +
                        '<svg style="width:16px;height:16px;color:var(--text3);"><use href="#ic-user"/></svg>' +
                    '</div>' +
                    '<div class="msg-body"><div class="msg-bubble">' + content + '</div></div>';
            }
            this.dom.messages.appendChild(div);
        }
    },

    // ==========================================
    // HISTORY & ADMIN
    // ==========================================
    loadHistory: function() {
        var self = this;
        this.dom.historyList.innerHTML = '<p style="color:var(--text4)">Ładowanie...</p>';
        fetch('/api/history?sessionToken=' + this.sessionToken)
        .then(function(r) { return r.json(); })
        .then(function(d) {
            if (!d.history || d.history.length === 0) {
                self.dom.historyList.innerHTML = '<p style="color:var(--text4)">Brak historii — zacznij pisać z AI!</p>';
                return;
            }
            var h = '';
            for (var i = d.history.length - 1; i >= 0; i--) {
                var item  = d.history[i];
                var time  = new Date(item.timestamp).toLocaleString('pl-PL');
                var mode  = item.mode === 'plan' ? 'plan' : '';
                var label = item.mode === 'plan' ? 'Plan' : 'Quick';
                h += '<div class="history-item">' +
                    '<div class="history-prompt">' + self.esc(item.userMsg) + '</div>' +
                    '<div class="history-meta">' +
                        '<span class="history-badge ' + mode + '">' + label + '</span>' +
                        '<span>Koszt: ' + item.cost + ' kr.</span>' +
                        '<span>' + time + '</span>' +
                    '</div>' +
                '</div>';
            }
            self.dom.historyList.innerHTML = h;
        }).catch(function() {
            self.dom.historyList.innerHTML = '<p style="color:var(--red)">Błąd ładowania historii</p>';
        });
    },

    adminAddCredits: function() {
        var self = this;
        var p    = this.dom.adminPass.value;
        var u    = this.dom.adminUserId.value;
        var a    = parseInt(this.dom.adminAmount.value);
        if (!p || !u || !a) { this.notify('Wypełnij wszystkie pola', 'warn'); return; }

        fetch('/api/admin', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'addCredits', password: p, userId: u, amount: a })
        })
        .then(function(r) { return r.json(); })
        .then(function(d) {
            if (d.ok) {
                self.notify('Dodano ' + a + ' kredytów dla ' + u, 'success');
                if (u === self.userId) self.verifySession();
            } else {
                self.notify('Błąd: ' + (d.error || 'Nieprawidłowe hasło'), 'error');
            }
        }).catch(function() { self.notify('Błąd sieci', 'error'); });
    },

    adminSetApiKey: function() {
        var self = this;
        var p    = this.dom.adminPass.value;
        var key  = document.getElementById('adminApiKey').value.trim();
        if (!p)   { this.notify('Wpisz hasło admina', 'warn'); return; }
        if (!key) { this.notify('Wpisz klucz API', 'warn'); return; }

        fetch('/api/admin', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'setApiKey', password: p, apiKey: key })
        })
        .then(function(r) { return r.json(); })
        .then(function(d) {
            if (d.ok) {
                self.notify('Klucz API ustawiony globalnie!', 'success');
                self.consolePrint('Globalny klucz API zaktualizowany', 'success');
                document.getElementById('adminApiKey').value = '';
                self.adminLoadApiKey();
            } else {
                self.notify('Błąd: ' + (d.error || 'Nieprawidłowe hasło'), 'error');
            }
        }).catch(function() { self.notify('Błąd sieci', 'error'); });
    },

    adminLoadApiKey: function() {
        var p = this.dom.adminPass.value;
        if (!p) { document.getElementById('currentApiKey').textContent = '(wpisz hasło)'; return; }

        fetch('/api/admin', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'getApiKey', password: p })
        })
        .then(function(r) { return r.json(); })
        .then(function(d) {
            document.getElementById('currentApiKey').textContent = d.ok ? (d.apiKey || '(brak)') : '(błąd hasła)';
        }).catch(function() {
            document.getElementById('currentApiKey').textContent = '(błąd sieci)';
        });
    },

    // ==========================================
    // HELPERS
    // ==========================================
    consolePrint: function(msg, type) {
        var time = new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        var div  = document.createElement('div');
        div.className = 'console-line ' + (type || 'info');
        div.innerHTML = '<span class="console-time">[' + time + ']</span> ' + msg;
        this.dom.consoleOutput.appendChild(div);
        this.dom.consoleOutput.scrollTop = this.dom.consoleOutput.scrollHeight;
    },

    notify: function(msg, type) {
        var icons = {
            success: '#ic-check',
            error:   '#ic-x',
            warn:    '#ic-warn',
            info:    '#ic-info'
        };
        var n = document.createElement('div');
        n.className = 'notif ' + (type || 'info');
        n.innerHTML =
            '<div class="notif-icon">' +
                '<svg><use href="' + (icons[type || 'info']) + '"/></svg>' +
            '</div>' +
            '<span class="notif-text">' + msg + '</span>';
        this.dom.notifs.appendChild(n);
        setTimeout(function() { if (n.parentElement) n.remove(); }, 3500);
    }
};

document.addEventListener('DOMContentLoaded', function() {
    if (!App.sessionToken) {
        var tempSession = sessionStorage.getItem('roboai_session_temp');
        if (tempSession) App.sessionToken = tempSession;
    }
    App.init();
});
