var App = {
    sessionToken: localStorage.getItem('astro_session') || '',
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
    currentAgent: { model: 'llama-3.3-70b-versatile', cost: 1, name: 'Llama 3.3 70B', icon: 'grok.png' },

    init: function() {
        this.cacheDom();
        this.bindEvents();

        // Default: show landing, hide app
        var landing = document.getElementById('landingPage');
        var appEl   = document.querySelector('.app');
        if (appEl)   appEl.classList.add('hidden');

        if (this.sessionToken) {
            // Try to restore session — skip landing on success
            this.verifySession();
        } else {
            // Show landing, do NOT show auth yet
            if (landing) landing.classList.remove('hidden');
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
            agentBtn:   document.getElementById('agentBtn'),
            agentBtnIcon: document.getElementById('agentBtnIcon'),
            agentBtnLabel: document.getElementById('agentBtnLabel'),
            agentPicker: document.getElementById('agentPicker'),

            historyList: document.getElementById('historyList'),
            adminTab:    document.getElementById('adminTab'),
            adminPass:   document.getElementById('adminPass'),
            adminUserId: document.getElementById('adminUserId'),
            adminAmount: document.getElementById('adminAmount'),

            editorFileName: document.getElementById('editorFileName'),
            editorCode:     document.getElementById('editorCode'),
            editorFileNameText: null,

            notifs: document.getElementById('notifs'),
            topUsername: document.getElementById('topUsername')
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

        // Nav — rail buttons only (no top-tabs)
        document.querySelectorAll('.rail-btn[data-target]').forEach(function(t) {
            t.onclick = function() { self.switchView(t.getAttribute('data-target')); };
        });

        // Landing page buttons
        var lpDashBtn  = document.getElementById('lpDashboardBtn');
        var lpStartBtn = document.getElementById('lpStartBtn');
        if (lpDashBtn)  lpDashBtn.onclick  = function() { self.showAuth(); };
        if (lpStartBtn) lpStartBtn.onclick = function() { self.showAuth(); };

        // Old custom dropdown logic removed

        // Plugin ping monitor — every 3s
        setInterval(function() {
            self.checkPluginStatus();
        }, 3000);

        // Chat
        this.dom.newChatBtn.onclick = function() { self.createNewChat(); };
        this.dom.sendBtn.onclick    = function() { self.send(); };
        this.dom.msgInput.onkeydown = function(e) {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); self.send(); }
        };
        this.dom.msgInput.oninput = function() {
            self.dom.sendBtn.disabled = !this.value.trim() || self.generating;
            this.style.height = '22px';
            this.style.height = Math.min(this.scrollHeight, 160) + 'px';
        };

        // Image upload
        var imgInput = document.getElementById('imageInput');
        var imgPreviewBar = document.getElementById('imgPreviewBar');
        var imgPreviewThumb = document.getElementById('imgPreviewThumb');
        var imgRemoveBtn = document.getElementById('imgRemoveBtn');
        var attachBtn = document.getElementById('attachBtn');
        if (imgInput) {
            imgInput.onchange = function() {
                var file = this.files[0];
                if (!file) return;
                var reader = new FileReader();
                reader.onload = function(e) {
                    self._attachedImage = e.target.result; // full base64 data URL
                    self._attachedImagePreview = e.target.result;
                    if (imgPreviewThumb) imgPreviewThumb.src = e.target.result;
                    if (imgPreviewBar) imgPreviewBar.style.display = 'flex';
                    if (attachBtn) attachBtn.classList.add('has-image');
                    // Enable send even without text
                    self.dom.sendBtn.disabled = self.generating;
                };
                reader.readAsDataURL(file);
            };
        }
        if (imgRemoveBtn) {
            imgRemoveBtn.onclick = function() {
                self._attachedImage = null;
                self._attachedImagePreview = null;
                if (imgInput) imgInput.value = '';
                if (imgPreviewBar) imgPreviewBar.style.display = 'none';
                if (attachBtn) attachBtn.classList.remove('has-image');
                self.dom.sendBtn.disabled = !self.dom.msgInput.value.trim();
            };
        }

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
        var setClaudeBtn  = document.getElementById('adminSetClaudeKeyBtn');
        var checkClaudeBtn = document.getElementById('adminCheckClaudeKeyBtn');
        if (setClaudeBtn)  setClaudeBtn.onclick  = function() { self.adminSetClaudeKey(); };
        if (checkClaudeBtn) checkClaudeBtn.onclick = function() { self.adminLoadClaudeKey(); };

        // Agent picker toggle
        this.initAgentPicker();

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
    // UI NAVIGATION
    // ==========================================
    switchView: function(target) {
        var self = this;
        document.querySelectorAll('.rail-btn[data-target]').forEach(function(x) {
            if (x.getAttribute('data-target') === target) x.classList.add('active');
            else x.classList.remove('active');
        });
        document.querySelectorAll('.view-container').forEach(function(v) { v.classList.add('hidden'); });
        var el = document.getElementById(target);
        if (el) el.classList.remove('hidden');
        if (target === 'viewAdmin') self.adminLoadApiKey();
    },

    // ==========================================
    // AGENT PICKER
    // ==========================================
    initAgentPicker: function() {
        var self = this;
        var wrap = document.getElementById('agentWrap');
        var btn  = this.dom.agentBtn;
        var pkr  = this.dom.agentPicker;
        if (!wrap || !btn || !pkr) return;

        btn.onclick = function(e) {
            e.stopPropagation();
            pkr.classList.toggle('open');
        };
        document.addEventListener('click', function(e) {
            if (!wrap.contains(e.target)) pkr.classList.remove('open');
        });

        pkr.querySelectorAll('.agent-card').forEach(function(card) {
            card.onclick = function() {
                if (card.classList.contains('locked') || card.classList.contains('soon')) return;
                
                // Remove active from all
                pkr.querySelectorAll('.agent-card').forEach(function(c) { c.classList.remove('active'); });
                card.classList.add('active');

                // Set agent info
                var modelName = card.getAttribute('data-model');
                var costVal   = parseInt(card.getAttribute('data-cost')) || 1;
                var iconUrl   = card.getAttribute('data-icon');
                var shortName = card.getAttribute('data-name');

                self.currentAgent = {
                    model: modelName,
                    cost: costVal,
                    name: shortName,
                    icon: iconUrl
                };

                // Update trigger button UI
                self.dom.agentBtnIcon.src = iconUrl;
                self.dom.agentBtnLabel.textContent = shortName;

                pkr.classList.remove('open');
            };
        });
    },

    // ==========================================
    // AUTH
    // ==========================================
    showAuth: function() {
        var landing = document.getElementById('landingPage');
        if (landing) landing.classList.add('hidden');
        this.dom.authModal.classList.add('active');
    },
    hideAuth: function() {
        this.dom.authModal.classList.remove('active');
        var landing = document.getElementById('landingPage');
        var appEl   = document.querySelector('.app');
        if (landing) landing.classList.add('hidden');
        if (appEl)   appEl.classList.remove('hidden');
    },

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
                var landing = document.getElementById('landingPage');
                var appEl   = document.querySelector('.app');
                if (landing) landing.classList.add('hidden');
                if (appEl)   appEl.classList.remove('hidden');
                self.setUserData(d);
                self.hideAuth();
                self.consolePrint('Zalogowano jako ' + d.username, 'success');
            } else {
                self.sessionToken = '';
                localStorage.removeItem('astro_session');
                // Show landing again on failed verify
                var landing2 = document.getElementById('landingPage');
                if (landing2) landing2.classList.remove('hidden');
                self.showAuth();
            }
        })
        .catch(function() {
            self.sessionToken = '';
            localStorage.removeItem('astro_session');
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
        localStorage.removeItem('astro_session');
        sessionStorage.removeItem('astro_session_temp');
        window.location.reload();
    },

    setUserData: function(d) {
        this.userId      = d.userId;
        this.username    = d.username;
        this.connectCode = d.connectCode;
        this.credits     = d.credits || 0;
        this.usage       = d.usage   || 0;

        var email = d.email || d.userId || '—';

        // Side panel + top bar
        this.dom.uiUsername.textContent    = d.username;
        this.dom.uiConnectCode.textContent = d.connectCode;
        if (this.dom.topUsername) this.dom.topUsername.textContent = d.username;
        this.animateCounter(this.dom.uiCredits, 0, this.credits, 600);

        // Account view — profile card (new IDs)
        var accUserEl    = document.getElementById('accUser');
        var accEmailEl   = document.getElementById('accEmail');
        var accUser2El   = document.getElementById('accUser2');
        var accEmail2El  = document.getElementById('accEmail2');
        var accCredEl    = document.getElementById('accCredits');
        var accCred2El   = document.getElementById('accCredits2');

        if (accUserEl)   accUserEl.textContent   = d.username;
        if (accEmailEl)  accEmailEl.textContent  = email;
        if (accUser2El)  accUser2El.textContent  = d.username;
        if (accEmail2El) accEmail2El.textContent = email;
        if (accCredEl)   this.animateCounter(accCredEl,  0, this.credits, 800);
        if (accCred2El)  this.animateCounter(accCred2El, 0, this.credits, 800);

        this.dom.accCode.textContent = d.connectCode;

        if (d.isAdmin || d.email === 'janpawel212121@gmail.com' || d.username === 'Fleety001') {
            this.isAdmin = true;
            var adminRail = document.getElementById('adminRailBtn');
            if (adminRail) adminRail.classList.remove('hidden');
            if (this.dom.adminTab) this.dom.adminTab.classList.remove('hidden');
        } else {
            this.isAdmin = false;
            var adminRail2 = document.getElementById('adminRailBtn');
            if (adminRail2) adminRail2.classList.add('hidden');
            if (this.dom.adminTab) this.dom.adminTab.classList.add('hidden');
        }

        // Load isolated user chats
        this.loadChats();

        // Start plugin status polling
        var self = this;
        if (this._statusInterval) clearInterval(this._statusInterval);
        this._statusInterval = setInterval(function() { self.checkPluginStatus(); }, 5000);
        setTimeout(function() { self.checkPluginStatus(); }, 800);
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

        // Block if plugin offline
        if (!this._pluginConnected) {
            this.notify('Zanim wyślesz prompt, musisz połączyć się z pluginem w Roblox Studio!', 'error');
            this.dom.msgInput.parentElement.classList.add('shake');
            setTimeout(function() { self.dom.msgInput.parentElement.classList.remove('shake'); }, 500);
            return;
        }

        var agent = this.currentAgent || { model: 'llama-3.3-70b-versatile', cost: 1, name: 'Llama 3.3 70B' };
        var cost  = agent.cost || 1;
        var mode  = 'plan'; // Always plan mode

        if (this.credits < cost) {
            this.notify('Brak kredytów! Potrzebujesz: ' + cost + ', masz: ' + this.credits, 'error');
            return;
        }

        this.dom.welcome.style.display = 'none';
        this.addMsg('user', text);
        this.dom.msgInput.value = '';
        this.dom.sendBtn.disabled = true;
        this.dom.msgInput.disabled = true;
        this.dom.msgInput.classList.add('generating');
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

        var sysPrompt = this.getSysPrompt() + fileCtx;
        // Jeśli user prosi o UI, dodaj instrukcję palety kolorów
        var promptLower = (text || '').toLowerCase();
        var isUiRequest = /\b(gui|ui|screengui|menu|interfejs|okno|sklep gui|hud|frame|button|textbutton|textlabel)\b/.test(promptLower);
        if (isUiRequest) {
            sysPrompt += '\nUżytkownik poprosił o stworzenie interfejsu. Wygeneruj pełny, kompletny kod GUI. Nie pytaj o palety kolorów w kodzie — zostaną wybrane przez UI.\n';
        }

        var apiMsgs = [{ role: 'system', content: sysPrompt }];
        for (var i = 0; i < this.messages.length; i++) {
            apiMsgs.push({ role: this.messages[i].role, content: this.messages[i].text });
        }

        // Include image in last user message if attached
        var imageBase64 = this._attachedImage || null;
        var usedModel = agent.model || 'llama-3.3-70b-versatile';
        if (imageBase64) {
            // Switch to vision-capable model
            usedModel = 'meta-llama/llama-4-scout-17b-16e-instruct';
            // Replace last user message with multimodal content
            var lastMsg = apiMsgs[apiMsgs.length - 1];
            if (lastMsg && lastMsg.role === 'user') {
                lastMsg.content = [
                    { type: 'text', text: lastMsg.content },
                    { type: 'image_url', image_url: { url: imageBase64 } }
                ];
            }
            // Clear attachment after building message
            this._attachedImage = null;
            var imgPreviewBar = document.getElementById('imgPreviewBar');
            var attachBtn = document.getElementById('attachBtn');
            var imgInput = document.getElementById('imageInput');
            if (imgPreviewBar) imgPreviewBar.style.display = 'none';
            if (attachBtn) attachBtn.classList.remove('has-image');
            if (imgInput) imgInput.value = '';
        }

        fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionToken: this.sessionToken,
                messages:     apiMsgs,
                model:        usedModel,
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

            self.credits = d.credits;
            self.usage   = d.usage;
            self.updateCreditsDisplay();
            self.consolePrint('Odpowiedź AI (' + d.cost + ' kr. użyte, pozostało: ' + d.credits + ' kr.)', 'success');

            var blocks = self.extractCode(d.content);
            if (blocks.length > 0) {
                // Show animated plan, then send code after delay
                self.addMsg('bot', d.content);
                self.animatePlanSequence(blocks, d.content, isUiRequest);
            } else {
                self.addMsg('bot', d.content);
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
            self.dom.msgInput.disabled = false;
            self.dom.msgInput.classList.remove('generating');
            self.dom.msgInput.placeholder = 'Opisz co chcesz stworzyć...';
            self.dom.sendBtn.disabled = !self.dom.msgInput.value.trim();
            self.dom.msgInput.focus();
        });
    },

    updateCreditsDisplay: function() {
        this.dom.uiCredits.textContent  = this.credits;
        this.dom.accCredits.textContent = this.credits;
    },

    getSysPrompt: function() {
        return 'Jesteś ekspertem Roblox Studio i Luau. Tworzysz kompletne, działające systemy.\n\n' +
        'INTERFEJS UŻYTKOWNIKA — WAŻNE:\n' +
        'Twoje odpowiedzi są wyświetlane w specjalnym UI, który CHOWA tekst gdy generujesz kod.\n' +
        'Dlatego: NIE pisz opisów, wstępów ani wyjaśnień przed/między blokami kodu.\n' +
        'NIE pisz "Poniżej znajdziesz kod", "Oto kod", "Gotowe!" itp.\n' +
        'Możesz napisać KRÓTKI checklist kroków (patrz PLANOWANIE), a potem od razu kod.\n\n' +
        'FORMAT KODU — KRYTYCZNIE WAŻNE:\n' +
        'Każdy blok kodu MUSI mieć na PIERWSZEJ LINII konfigurację w DOKŁADNIE takim formacie:\n' +
        '-- @NAME: NazwaPliku | @TYPE: TypSkryptu | @PARENT: Lokalizacja | @ACTION: create\n\n' +
        'Dozwolone @TYPE: LocalScript, Script, ModuleScript\n' +
        'Dozwolone @PARENT: StarterGui, ServerScriptService, ReplicatedStorage, StarterPlayerScripts, ServerStorage\n' +
        'Dozwolone @ACTION: create (nowy plik), update (zmień istniejący), delete (usuń plik)\n\n' +
        'PRZYKŁAD POPRAWNEJ ODPOWIEDZI:\n' +
        '```lua\n' +
        '-- @NAME: MainMenuGUI | @TYPE: LocalScript | @PARENT: StarterGui | @ACTION: create\n' +
        'local Players = game:GetService("Players")\n' +
        '-- kod...\n' +
        '```\n\n' +
        'ZASADY KODU:\n' +
        '1. Pisz WYŁĄCZNIE w Luau\n' +
        '2. Kod musi działać od razu bez modyfikacji\n' +
        '3. GUI twórz z Instance.new() — ScreenGui, Frame, TextButton, UICorner, UIGradient itd.\n' +
        '4. ZAWSZE dodawaj animacje TweenService\n' +
        '5. Używaj ładnych kolorów, gradientów, zaokrągleń\n' +
        '6. Pisz KOMPLETNY, SZCZEGÓŁOWY kod — minimum 100 linii na skrypt GUI\n' +
        '7. Dodawaj komentarze po polsku\n' +
        '8. Obsługuj błędy z pcall\n' +
        '9. Generuj WIELE plików naraz jeśli system tego wymaga\n' +
        '10. NIGDY nie przerywaj bloku kodu — zawsze kończ ```\n\n' +
        'Odpowiadaj po polsku. Zamiast opisywać co zrobisz — po prostu to zrób.';
    },

    // ==========================================
    // ANIMATED PLAN SEQUENCE
    // ==========================================
    animatePlanSequence: function(blocks, content, isUiRequest) {
        var self = this;

        // Find the last bot message div that was just added
        var msgDivs = this.dom.messages.querySelectorAll('.msg.bot');
        var msgDiv = msgDivs[msgDivs.length - 1];
        if (!msgDiv) return;

        // Build plan steps
        var steps = [
            { label: 'Zrozumienie wymagań',    delay: 0,    doneAt: 2000 },
            { label: 'Tworzenie plików i skryptów', delay: 2000, doneAt: 10000 },
            { label: 'Weryfikacja kodu',        delay: 10000, doneAt: 12000 }
        ];
        if (isUiRequest) {
            steps.push({ label: 'Dostosowanie kolorów do wybranej palety', delay: 12000, doneAt: 13500 });
        }

        // Build plan DOM
        var planBox = document.createElement('div');
        planBox.className = 'plan-box';
        planBox.innerHTML =
            '<div class="plan-box-header">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' +
                '<span>PLAN</span>' +
            '</div>';

        var stepEls = [];
        steps.forEach(function(s, i) {
            var el = document.createElement('div');
            el.className = 'plan-step pending';
            el.style.animationDelay = (i * 0.05) + 's';
            el.innerHTML =
                '<div class="plan-step-icon">' +
                    '<div class="ps-spinner"></div>' +
                    '<div class="ps-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg></div>' +
                    '<div class="ps-empty"></div>' +
                '</div>' +
                '<span class="plan-step-label">' + self.esc(s.label) + '</span>';
            planBox.appendChild(el);
            stepEls.push(el);
        });

        // Insert plan box BEFORE the msg-text div
        var msgTextDiv = msgDiv.querySelector('.msg-text');
        if (msgTextDiv) {
            msgDiv.querySelector('.msg-sender') && msgDiv.insertBefore(planBox, msgTextDiv);
        } else {
            msgDiv.appendChild(planBox);
        }
        self.scrollDown();

        // Animate steps
        var totalSteps = steps.length;
        var filesSent = false;

        steps.forEach(function(s, i) {
            setTimeout(function() {
                stepEls[i].className = 'plan-step active';
            }, s.delay);

            setTimeout(function() {
                stepEls[i].className = 'plan-step done';

                // After step 1 (index 1) finishes — send code to plugin
                if (i === 1 && !filesSent) {
                    filesSent = true;
                    self.consolePrint('Wysyłam ' + blocks.length + ' bloków kodu do pluginu...', 'info');
                    self.sendToPlugin(blocks);

                    // Show created-file card for each block
                    blocks.forEach(function(b) {
                        var card = document.createElement('div');
                        card.className = 'plan-created-card';
                        card.innerHTML =
                            '<div class="plan-created-icon">' +
                                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>' +
                            '</div>' +
                            '<div class="plan-created-info">' +
                                '<div class="plan-created-title">' + self.esc(b.name || 'Plik Lua') + '</div>' +
                                '<div class="plan-created-sub">' + self.esc((b.type || 'Script') + ' · ' + (b.parent || 'StarterGui')) + '</div>' +
                            '</div>' +
                            '<button class="plan-copy-btn" title="Kopiuj kod">' +
                                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>' +
                            '</button>';
                        card.querySelector('.plan-copy-btn').onclick = function() {
                            navigator.clipboard.writeText(b.code || '').then(function() {
                                self.notify('Skopiowano kod!', 'success');
                            });
                        };
                        planBox.appendChild(card);
                    });
                    self.scrollDown();
                }

                // After last step, show color picker if UI request
                if (i === totalSteps - 1 && isUiRequest) {
                    setTimeout(function() {
                        self.renderColorPicker(planBox, blocks);
                        self.scrollDown();
                    }, 400);
                }
            }, s.doneAt);
        });
    },

    renderColorPicker: function(container, blocks) {
        var self = this;
        var palettes = [
            { id: 'lemonade',   name: 'Lemonade' },
            { id: 'midnight',   name: 'Midnight' },
            { id: 'pastel',     name: 'Pastel' },
            { id: 'arcade',     name: 'Arcade' },
            { id: 'industrial', name: 'Industrial' },
            { id: 'freeform',   name: 'Freeform' }
        ];

        var box = document.createElement('div');
        box.className = 'color-picker-box';
        box.innerHTML = '<div class="color-picker-label">Wybierz paletę kolorów UI:</div>';

        var row = document.createElement('div');
        row.className = 'color-picker-palettes';

        palettes.forEach(function(p) {
            var btn = document.createElement('button');
            btn.className = 'cp-palette cp-' + p.id;
            btn.innerHTML =
                '<div class="cp-dots"><div class="cp-dot"></div><div class="cp-dot"></div><div class="cp-dot"></div></div>' +
                '<div class="cp-name">' + p.name + '</div>';

            btn.onclick = function() {
                row.querySelectorAll('.cp-palette').forEach(function(b) { b.classList.remove('selected'); });
                btn.classList.add('selected');

                var label = box.querySelector('.color-picker-label');
                if (label) label.innerHTML = 'Wybrana paleta: <strong>' + p.name + '</strong>';

                // Ask AI to recolor using the chosen palette
                self.sendPaletteRequest(p.name);
            };
            row.appendChild(btn);
        });

        box.appendChild(row);
        container.appendChild(box);
    },

    sendPaletteRequest: function(paletteName) {
        var self = this;
        var paletteDescriptions = {
            'Lemonade':   'jasne, ciepłe odcienie — żółty #FDE68A, miętowy #6EE7B7, niebieski #60A5FA',
            'Midnight':   'granatowe i fioletowe — tło #1E3A5F, akcenty #818CF8, biel #E0E7FF',
            'Pastel':     'delikatne pastele — różowy #F9A8D4, błękitny #A5F3FC, liliowy #D8B4FE',
            'Arcade':     'neonowe kolory retro — pomarańczowy #F97316, fioletowy #A855F7, cyjan #22D3EE',
            'Industrial': 'stonowane odcienie — szary #78716C, amber #F59E0B, jasny szary #E5E7EB',
            'Freeform':   'domyślne kolory — zachowaj aktualne kolory z kodu'
        };
        var desc = paletteDescriptions[paletteName] || paletteName;
        var msg = 'Zmień kolory w wygenerowanym GUI na paletę ' + paletteName + ': ' + desc + '. Zachowaj strukturę i logikę, zmień tylko Color3.fromRGB i kolory tekstów.';
        this.dom.msgInput.value = msg;
        this.send();
    },

    addMsg: function(role, text) {
        this.messages.push({ role: role === 'bot' ? 'assistant' : 'user', text: text });
        var div = document.createElement('div');
        div.className = 'msg ' + role;

        if (role === 'bot') {
            var parsed = this.parseBotMsg(text);
            div.innerHTML =
                '<div class="msg-sender">' +
                    '<img src="ikona.png" alt="" class="msg-logo">' +
                    '<span class="msg-sender-name">Astro</span>' +
                '</div>' +
                (parsed.tools ? '<div class="tool-chain">' + parsed.tools + '</div>' : '') +
                (parsed.text ? '<div class="msg-text">' + parsed.text + '</div>' : '');
        } else {
            var imgHtml = '';
            if (this._attachedImagePreview) {
                imgHtml = '<img src="' + this._attachedImagePreview + '" class="msg-img-preview" alt="załącznik">';
                this._attachedImagePreview = null;
            }
            div.innerHTML =
                '<div class="msg-user-row">' +
                    '<div class="msg-user-bubble">' + imgHtml + this.esc(text) + '</div>' +
                '</div>';
        }

        this.dom.messages.appendChild(div);
        this.saveChats();
        this.scrollDown();
    },

    parseBotMsg: function(text) {
        var self = this;
        var tools = '';
        var remaining = text;

        // Extract and process code blocks → show as tool pills NOT raw code
        remaining = remaining.replace(/```(\w+)?\n([\s\S]*?)```/g, function(_, lang, code) {
            var info = self.parseInfo(code);
            self.addFile(info.name, code, info.type, info.parent);
            self.saveChats();

            var actionIcon = '#ic-file-code';
            var actionLabel = 'Utworzono';
            var actionClass = 'created';
            if (info.action === 'update') { actionLabel = 'Zaktualizowano'; actionClass = 'updated'; }
            if (info.action === 'delete') { actionLabel = 'Usunięto'; actionClass = 'deleted'; actionIcon = '#ic-trash'; }

            // Send to plugin if auto-insert
            if (self.dom.autoInsert && self.dom.autoInsert.checked) {
                self.sendToPlugin([{ code: code }]);
            }

            tools +=
                '<div class="tool-pill ' + actionClass + '">' +
                    '<svg class="tp-icon"><use href="' + actionIcon + '"/></svg>' +
                    '<span class="tp-label">' + actionLabel + ' <span class="tp-name">' + self.esc(info.name) + '</span></span>' +
                    '<span class="tp-meta">' + info.type + ' · ' + info.parent + '</span>' +
                    '<button class="tool-pill-copy" onclick="App.copyCode(this)" data-code="' + self.escAttr(code.trim()) + '" title="Kopiuj kod">' +
                        '<svg><use href="#ic-copy"/></svg>' +
                    '</button>' +
                '</div>';
            return ''; // remove from text
        });

        // Checklist items → plan steps
        var checklistRegex = /(?:^[ \t]*-[ \t]+\[[xX \/]\][ \t]+.*(?:\r?\n|$))+/gm;
        var planHtml = '';
        remaining = remaining.replace(checklistRegex, function(match) {
            var lines = match.trim().split('\n');
            var count = lines.length;
            var stepsHtml = '';
            for (var i = 0; i < lines.length; i++) {
                var line = lines[i].trim();
                var m = line.match(/^[ \t]*-[ \t]+\[(x|X| |\/)\][ \t]+(.*)$/);
                if (m) {
                    var state = m[1].toLowerCase(), label = m[2];
                    if (state === 'x') {
                        stepsHtml += '<div class="plan-step checked"><svg><use href="#ic-check"/></svg> ' + label + '</div>';
                    } else if (state === '/') {
                        stepsHtml += '<div class="plan-step active"><span class="loader-spinner"></span> ' + label + '</div>';
                    } else {
                        stepsHtml += '<div class="plan-step"><div class="empty-checkbox"></div> ' + label + '</div>';
                    }
                }
            }
            planHtml += '<div class="plan-steps-box"><div class="plan-steps-header"><svg><use href="#ic-history"/></svg> Plan (' + count + ' kroków)</div>' + stepsHtml + '</div>';
            return '';
        });

        // Format remaining text
        remaining = remaining
            .replace(/^#{1,3}\s+(.+)$/gm, '<div class="msg-heading">$1</div>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
            .replace(/^[\s]*[-•]\s+(.+)$/gm, '<div class="msg-bullet"><span class="bullet-dot"></span>$1</div>')
            .replace(/\n{2,}/g, '<div class="msg-spacer"></div>')
            .replace(/\n/g, '<br>')
            .trim();

        // Combine: pills go first, then plan steps, then text ONLY if no code was found
        var finalText = planHtml + (tools ? '' : remaining);
        this.renderTree();
        return { tools: tools, text: finalText };
    },

    parseBotMsgSilently: function(text) {
        var self  = this;
        var tools = '';
        var remaining = text;

        // Code blocks → tool pills (same as parseBotMsg but no plugin send / addFile)
        remaining = remaining.replace(/```(\w+)?\n([\s\S]*?)```/g, function(_, lang, code) {
            var info = self.parseInfo(code);
            var actionIcon  = '#ic-file-code';
            var actionLabel = 'Utworzono';
            var actionClass = 'created';
            if (info.action === 'update') { actionLabel = 'Zaktualizowano'; actionClass = 'updated'; }
            if (info.action === 'delete') { actionLabel = 'Usunięto'; actionClass = 'deleted'; actionIcon = '#ic-trash'; }

            tools +=
                '<div class="tool-pill ' + actionClass + '">' +
                    '<svg class="tp-icon"><use href="' + actionIcon + '"/></svg>' +
                    '<span class="tp-label">' + actionLabel + ' <span class="tp-name">' + self.esc(info.name) + '</span></span>' +
                    '<span class="tp-meta">' + info.type + ' · ' + info.parent + '</span>' +
                    '<button class="tool-pill-copy" onclick="App.copyCode(this)" data-code="' + self.escAttr(code.trim()) + '" title="Kopiuj">' +
                        '<svg><use href="#ic-copy"/></svg>' +
                    '</button>' +
                '</div>';
            return '';
        });

        // Checklist items → plan steps
        var checklistRegex = /(?:^[ \t]*-[ \t]+\[[xX \/]\][ \t]+.*(?:\r?\n|$))+/gm;
        remaining = remaining.replace(checklistRegex, function(match) {
            var lines = match.trim().split('\n');
            var stepsHtml = '';
            for (var i = 0; i < lines.length; i++) {
                var line = lines[i].trim();
                var m = line.match(/^[ \t]*-[ \t]+\[(x|X| |\/)\][ \t]+(.*)$/);
                if (m) {
                    var state = m[1].toLowerCase(), label = m[2];
                    if (state === 'x') stepsHtml += '<div class="plan-step checked"><svg><use href="#ic-check"/></svg> ' + label + '</div>';
                    else if (state === '/') stepsHtml += '<div class="plan-step active"><span class="loader-spinner"></span> ' + label + '</div>';
                    else stepsHtml += '<div class="plan-step"><div class="empty-checkbox"></div> ' + label + '</div>';
                }
            }
            return '<div class="plan-steps-box"><div class="plan-steps-header"><svg><use href="#ic-history"/></svg> Plan</div>' + stepsHtml + '</div>';
        });

        // Format remaining text (same rules as parseBotMsg)
        remaining = remaining
            .replace(/^#{1,3}\s+(.+)$/gm, '<div class="msg-heading">$1</div>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
            .replace(/^[\s]*[-•]\s+(.+)$/gm, '<div class="msg-bullet"><span class="bullet-dot"></span>$1</div>')
            .replace(/\n{2,}/g, '<div class="msg-spacer"></div>')
            .replace(/\n/g, '<br>')
            .trim();

        if (tools) {
            return '<div class="msg-sender"><img src="ikona.png" alt="" class="msg-logo"><span class="msg-sender-name">Astro</span></div>' +
                   '<div class="tool-chain">' + tools + '</div>' +
                   (remaining ? '<div class="msg-text">' + remaining + '</div>' : '');
        }
        return remaining;
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

    checkPluginStatus: function() {
        if (!this.sessionToken || !this.userId) return;
        var self = this;
        var code = this.connectCode || '';
        if (!code) return;
        fetch('/api/status?cc=' + encodeURIComponent(code))
            .then(function(r) { return r.json(); })
            .then(function(d) {
                var connected = d.online === true;
                var wasConnected = self._pluginConnected;
                self._pluginConnected = connected;

                if (connected !== wasConnected) {
                    self.consolePrint(connected ? 'Plugin połączony ✓' : 'Plugin rozłączony', connected ? 'success' : 'warn');
                }

                // New plugin card dot (.pcc-dot)
                var pccDot = document.getElementById('pluginStatusDot');
                if (pccDot) {
                    pccDot.classList.toggle('connected',    connected);
                    pccDot.classList.toggle('disconnected', !connected);
                }

                // New badge
                var badge = document.getElementById('pluginStatusBadge');
                if (badge) {
                    badge.textContent = connected ? 'Online' : 'Offline';
                    badge.className = 'pcc-badge ' + (connected ? 'online' : 'offline');
                }

                // Rail brand dot
                var railDot = document.getElementById('pluginDot');
                if (railDot) railDot.classList.toggle('connected', connected);

                // Top bar pill
                var topLabel = document.getElementById('topPluginLabel');
                var topDot   = document.getElementById('topPluginDot');
                if (topLabel) topLabel.textContent = connected ? 'Online' : 'Offline';
                if (topDot) {
                    topDot.classList.toggle('connected',    connected);
                    topDot.classList.toggle('disconnected', !connected);
                }

                // Legacy labels
                var statusLabel = document.getElementById('pluginStatusText');
                if (statusLabel) statusLabel.textContent = connected ? 'Online' : 'Offline';

            }).catch(function(e) {
                self.consolePrint('Status check error: ' + e.message, 'error');
            });
    },

    toggleDropdown: function(id) {
        var el = document.getElementById(id);
        if (el) el.classList.toggle('show');
    },

    // ==========================================
    // PLUGIN & FILES
    // ==========================================
    sendToPlugin: function(blocks) {
        // Guard: don't queue if plugin is not connected
        if (!this._pluginConnected) {
            this.notify('Plugin nie jest podłączony! Podłącz plugin w Roblox Studio.', 'warn');
            this.consolePrint('Kod wygenerowany — ale plugin offline. Podłącz plugin i spróbuj ponownie.', 'warn');
            return;
        }

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
                self.notify(tasks.length + ' plików wysłanych do Roblox Studio!', 'success');
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
            if (roleClass === 'bot') {
                // parseBotMsgSilently returns full HTML (msg-sender + tool-chain + msg-text)
                div.innerHTML = this.parseBotMsgSilently(m.text);
            } else {
                div.innerHTML =
                    '<div class="msg-user-row">' +
                        '<div class="msg-user-bubble">' + this.esc(m.text) + '</div>' +
                    '</div>';
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
        var self  = this;
        var email = document.getElementById('adminUserEmail') ? document.getElementById('adminUserEmail').value.trim() : '';
        var p     = document.getElementById('adminPassCredits') ? document.getElementById('adminPassCredits').value : this.dom.adminPass.value;
        var a     = parseInt(this.dom.adminAmount.value);
        if (!p)       { this.notify('Wpisz hasło admina', 'warn'); return; }
        if (!email)   { this.notify('Wpisz email użytkownika', 'warn'); return; }
        if (!a || a <= 0) { this.notify('Podaj prawidłową ilość kredytów', 'warn'); return; }

        fetch('/api/admin', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'addCredits', password: p, userId: email, amount: a })
        })
        .then(function(r) { return r.json(); })
        .then(function(d) {
            if (d.ok) {
                self.notify('Dodano ' + a + ' kr. dla ' + (d.username || email), 'success');
                self.consolePrint('Admin: +' + a + ' kr. → ' + email, 'success');
                if (d.userId === self.userId) self.verifySession();
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
        var passEl = this.dom.adminPass;
        var p = (passEl && passEl.value) ? passEl.value : '';
        fetch('/api/admin', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'getApiKey', password: p || (process && process.env ? '' : '') })
        })
        .then(function(r) { return r.json(); })
        .then(function(d) {
            var el = document.getElementById('currentApiKey');
            if (el) el.textContent = d.ok ? (d.apiKey || '(brak)') : '(wpisz hasło aby sprawdzić)';
        }).catch(function() {
            var el = document.getElementById('currentApiKey');
            if (el) el.textContent = '(błąd sieci)';
        });
    },

    adminSetClaudeKey: function() {
        var self = this;
        var passEl = document.getElementById('adminPassClaude') || this.dom.adminPass;
        var p    = passEl ? passEl.value : '';
        var keyEl = document.getElementById('adminClaudeKey');
        var key  = keyEl ? keyEl.value.trim() : '';
        
        if (!p)   { this.notify('Wpisz hasło admina', 'warn'); return; }
        if (!key) { this.notify('Wpisz klucz API (Claude)', 'warn'); return; }

        fetch('/api/admin', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'setClaudeKey', password: p, apiKey: key })
        })
        .then(function(r) { return r.json(); })
        .then(function(d) {
            if (d.ok) {
                self.notify('Klucz API Claude ustawiony globalnie!', 'success');
                self.consolePrint('Globalny klucz Claude zaktualizowany', 'success');
                if (keyEl) keyEl.value = '';
                self.adminLoadClaudeKey();
            } else {
                self.notify('Błąd: ' + (d.error || 'Nieprawidłowe hasło'), 'error');
            }
        }).catch(function() { self.notify('Błąd sieci', 'error'); });
    },

    adminLoadClaudeKey: function() {
        var passEl = document.getElementById('adminPassClaude') || this.dom.adminPass;
        var p = (passEl && passEl.value) ? passEl.value : '';
        fetch('/api/admin', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'getClaudeKey', password: p })
        })
        .then(function(r) { return r.json(); })
        .then(function(d) {
            var el = document.getElementById('currentClaudeKey');
            if (el) el.textContent = d.ok ? (d.apiKey || '(brak)') : '(wpisz hasło aby sprawdzić)';
        }).catch(function() {
            var el = document.getElementById('currentClaudeKey');
            if (el) el.textContent = '(błąd sieci)';
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
