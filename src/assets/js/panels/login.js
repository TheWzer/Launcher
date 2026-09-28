/**
 * @author Luuxis
 * Licensed under CC BY-NC 4.0
 * https://creativecommons.org/licenses/by-nc/4.0/
 *
 * Edited by CentralCorp Team
 */
import { database, changePanel, showLoadingOverlay, hideLoadingOverlay, t } from '../utils.js';
const { AZauth } = require('minecraft-java-core-azbetter');
const { ipcRenderer, shell } = require('electron');
const HwidManager = require('../utils/hwid.js');
const pkg = window.pkgInfo || {
    preductname: 'Lumine.li',
    version: '4.0.17',
    settings: 'https://lumine.li',
    env: 'azuriom',
    repository: {
        type: 'git',
        url: 'git+https://github.com/TheWzer/Launcher.git'
    }
};
const settings_url = pkg.user ? `${pkg.settings}/${pkg.user}` : pkg.settings;

'use strict';

class Login {
    static id = "login";

    async init(config) {
        this.config = config;
        this.database = await new database().init();
        this.setStaticTexts();
        this.config.online ? this.getOnline() : this.getOffline();
    }

    setStaticTexts() {
        document.getElementById('login-title').textContent = t('connect');
        document.getElementById('cancel-login-btn').textContent = t('cancel');
        document.getElementById('a2f-label').textContent = t('2fa_enabled');
        document.getElementById('a2f-login-btn').textContent = t('play');
        document.getElementById('cancel-a2f-btn').textContent = t('cancel');
        document.getElementById('email-verify-label').textContent = t('verify_email');
        document.getElementById('cancel-email-btn').textContent = t('cancel');
        document.getElementById('username-label').textContent = t('username');
        document.getElementById('password-label').textContent = t('password');
        document.getElementById('login-btn').textContent = t('play');
        document.getElementById('password-reset-link').textContent = t('forgot_password');
        document.getElementById('new-user-link').textContent = t('no_account');
    }

    async refreshData(account) {
        const roleElement = document.querySelector('.player-role');
        const monnaieElement = document.querySelector('.player-monnaie');
        if (roleElement) roleElement.innerHTML = '';
        if (monnaieElement) monnaieElement.innerHTML = '';

        // Если передан аккаунт, используем его напрямую, иначе читаем из базы
        if (account) {
            await this.initOthers(account);
            await this.initPreviewSkin(account);
        } else {
            await this.initOthers();
            await this.initPreviewSkin();
        }
        hideLoadingOverlay();
    }

    async initPreviewSkin(account) {
        console.log('initPreviewSkin called');
        const baseUrl = settings_url.endsWith('/') ? settings_url : `${settings_url}/`;
        const websiteUrl = pkg.env === 'azuriom' ? `${baseUrl}` : this.config.azauth;

        // Если аккаунт не передан, читаем из базы
        if (!account) {
            const selectedRecord = await this.database.get('1234', 'accounts-selected');
            if (!selectedRecord || !selectedRecord.value) {
                console.warn('No account selected');
                return;
            }
            const uuid = selectedRecord.value;
            if (!uuid || !uuid.selected) {
                console.warn('Invalid selected record');
                return;
            }
            const accountRecord = await this.database.get(uuid.selected, 'accounts');
            if (!accountRecord || !accountRecord.value) {
                console.warn('Account not found');
                return;
            }
            account = accountRecord.value;
        }

        const skinTitleElement = document.querySelector('.player-skin-title');
        const skinRendererElement = document.querySelector('.skin-renderer-settings');

        if (skinTitleElement) {
            skinTitleElement.innerHTML = `${t('skin_of')} ${account.name}`;
        }

        if (skinRendererElement) {
            skinRendererElement.src = `${websiteUrl}skin3d/3d-api/skin-api/${account.name}`;
        } else {
            console.warn('Skin renderer element not found in DOM');
        }
    }

    async initOthers(account) {
        // Если аккаунт не передан, читаем из базы
        if (!account) {
            const selectedRecord = await this.database.get('1234', 'accounts-selected');
            if (!selectedRecord || !selectedRecord.value) {
                console.warn('No account selected');
                return;
            }
            const uuid = selectedRecord.value;
            if (!uuid || !uuid.selected) {
                console.warn('Invalid selected record');
                return;
            }
            const accountRecord = await this.database.get(uuid.selected, 'accounts');
            if (!accountRecord || !accountRecord.value) {
                console.warn('Account not found');
                return;
            }
            account = accountRecord.value;
        }

        this.updateRole(account);
        this.updateMoney(account);
        this.updateWhitelist(account);
    }

    updateRole(account) {
        const roleElement = document.querySelector('.player-role');
        if (!roleElement) return;

        if (this.config.role && account.user_info.role) {
            const blockRole = document.createElement("div");
            blockRole.innerHTML = `<div>${t('grade')}: ${account.user_info.role.name}</div>`;
            roleElement.appendChild(blockRole);
        } else {
            roleElement.style.display = "none";
        }
    }

    updateMoney(account) {
        const monnaieElement = document.querySelector('.player-monnaie');
        if (!monnaieElement) return;

        if (this.config.money) {
            const blockMonnaie = document.createElement("div");
            blockMonnaie.innerHTML = `<div>${account.user_info.monnaie} Lumi</div>`;
            monnaieElement.appendChild(blockMonnaie);
        } else {
            monnaieElement.style.display = "none";
        }
    }

    updateWhitelist(account) {
        const playBtn = document.querySelector(".play-btn");
        if (this.config.whitelist_activate &&
            (!this.config.whitelist.includes(account.name) &&
                !this.config.whitelist_roles.includes(account.user_info.role.name))) {
            playBtn.style.backgroundColor = "#696969";
            playBtn.style.pointerEvents = "none";
            playBtn.style.boxShadow = "none";
            playBtn.textContent = t('unavailable');
        } else {
            playBtn.style.backgroundColor = "#01C5FF";
            playBtn.style.pointerEvents = "auto";
            playBtn.style.boxShadow = "2px 2px 5px rgba(0, 0, 0, 0.3)";
            playBtn.textContent = t('play');
        }
    }

    updateBackground(account) {
        return new Promise((resolve) => {
            const defaultBg = '../src/assets/images/background/light.jpg';
            let backgroundUrl = null;

            if (this.config.role_data && account.user_info && account.user_info.role) {
                for (const roleKey in this.config.role_data) {
                    if (this.config.role_data.hasOwnProperty(roleKey)) {
                        const role = this.config.role_data[roleKey];
                        if (account.user_info.role.name === role.name && role.background) {
                            const urlPattern = /^(https?:\/\/)/;
                            if (urlPattern.test(role.background)) {
                                backgroundUrl = role.background;
                            }
                            break;
                        }
                    }
                }
            }

            const finalBgUrl = backgroundUrl || defaultBg;
            const img = new Image();
            img.onload = () => {
                document.body.style.background = `linear-gradient(rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.4)), url(${finalBgUrl}) black no-repeat center center scroll`;
                document.body.style.backgroundSize = 'cover';
                resolve();
            };

            img.onerror = () => {
                document.body.style.background = `linear-gradient(rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.4)), url(${defaultBg}) black no-repeat center center scroll`;
                document.body.style.backgroundSize = 'cover';
                resolve();
            };

            img.src = finalBgUrl;
        });
    }

    getOnline() {
        console.log(`Initializing Az Panel...`);
        this.loginAzAuth();
    }

    async loginAzAuth() {
        const elements = this.getElements();
        const azauth = this.getAzAuthUrl();

        this.setupExternalLinks(azauth);
        this.setupEventListeners(elements, azauth);
        this.setupPasswordToggle();
    }

    getElements() {
        return {
            mailInput: document.querySelector('.Mail'),
            passwordInput: document.querySelector('.Password'),
            cancelLoginBtn: document.querySelector('.cancel-login'),
            infoLogin: document.querySelector('.info-login'),
            loginBtn: document.querySelector(".login-btn"),
            loginBtn2f: document.querySelector('.login-btn-2f'),
            a2finput: document.querySelector('.a2f'),
            infoLogin2f: document.querySelector('.info-login-2f'),
            cancel2f: document.querySelector('.cancel-2f'),
            infoLoginEmail: document.querySelector('.info-login-email'),
            cancelEmail: document.querySelector('.cancel-email')
        };
    }

    getAzAuthUrl() {
        const baseUrl = settings_url.endsWith('/') ? settings_url : `${settings_url}/`;
        return pkg.env === 'azuriom'
            ? baseUrl
            : this.config.azauth.endsWith('/')
                ? this.config.azauth
                : `${this.config.azauth}/`;
    }

    setupExternalLinks(azauth) {
        const newuserurl = `${azauth}user/register`;
        const passwordreseturl = `${azauth}user/password/reset`;

        this.newuser = document.querySelector(".new-user");
        this.newuser.innerHTML = t('no_account');
        this.newuser.addEventListener('click', () => shell.openExternal(newuserurl));

        this.passwordreset = document.querySelector(".password-reset");
        this.passwordreset.innerHTML = t('forgot_password');
        this.passwordreset.addEventListener('click', () => shell.openExternal(passwordreseturl));

        // Добавляем обработчик для кнопки регистрации
        const registerBtn = document.querySelector("#register-btn");
        if (registerBtn) {
            registerBtn.addEventListener('click', (e) => {
                e.preventDefault();
                shell.openExternal('https://lumine.li/user/register');
            });
        }
    }

    setupEventListeners(elements, azauth) {
        elements.cancelLoginBtn.addEventListener("click", () => {
            changePanel("settings");
        });
        elements.cancel2f.addEventListener("click", () => this.resetLoginForm(elements));
        elements.cancelEmail.addEventListener("click", () => this.resetLoginForm(elements));

        elements.loginBtn2f.addEventListener("click", async () => {
            elements.infoLogin2f.innerHTML = t('connecting');
            if (elements.a2finput.value === "") {
                elements.infoLogin2f.innerHTML = t('enter_2fa_code');
                return;
            }
            await this.handleLogin(elements, azauth, elements.a2finput.value);
        });

        elements.loginBtn.addEventListener("click", async () => {
            elements.loginBtn.disabled = true;
            elements.mailInput.disabled = true;
            elements.passwordInput.disabled = true;
            elements.infoLogin.innerHTML = t('connecting');

            if (elements.mailInput.value === "") {
                elements.infoLogin.innerHTML = t('enter_username');
                this.enableLoginForm(elements);
                return;
            }

            if (elements.passwordInput.value === "") {
                elements.infoLogin.innerHTML = t('enter_password');
                this.enableLoginForm(elements);
                return;
            }

            await this.handleLogin(elements, azauth);
        });
    }

    toggleLoginCards(cardType) {
        const loginCardMain = document.querySelector(".login-card-main");
        const a2fCard = document.querySelector('.a2f-card');
        const emailVerifyCard = document.querySelector('.email-verify-card');

        loginCardMain.style.display = cardType === "default" || cardType === "mojang" ? "block" : "none";
        a2fCard.style.display = cardType === "a2f" ? "block" : "none";
        emailVerifyCard.style.display = cardType === "email" ? "block" : "none";
    }

    resetLoginForm(elements) {
        this.toggleLoginCards("default");
        elements.infoLogin.innerHTML = "";
        elements.infoLogin2f.innerHTML = "";
        elements.mailInput.value = "";
        elements.loginBtn.disabled = false;
        elements.mailInput.disabled = false;
        elements.passwordInput.disabled = false;
        elements.passwordInput.value = "";
        elements.a2finput.value = "";
    }

    enableLoginForm(elements) {
        elements.loginBtn.disabled = false;
        elements.mailInput.disabled = false;
        elements.passwordInput.disabled = false;
    }

    async handleLogin(elements, azauth, a2fCode = null) {
        const azAuth = new AZauth(azauth);

        // Сохраняем email из формы ДО любых манипуляций
        const emailFromForm = elements.mailInput.value;
        console.log('[handleLogin] Email from form (saved early):', emailFromForm);

        try {
            const account_connect = a2fCode
                ? await azAuth.login(elements.mailInput.value, elements.passwordInput.value, a2fCode)
                : await azAuth.login(elements.mailInput.value, elements.passwordInput.value);

            if (account_connect.error) {
                if (account_connect.reason === 'user_banned') {
                    elements.infoLogin.innerHTML = t('account_banned');
                } else if (account_connect.reason === 'invalid_credentials') {
                    elements.infoLogin.innerHTML = t('invalid_credentials');
                } else if (account_connect.reason === 'invalid_2fa') {
                    elements.infoLogin2f.innerHTML = t('invalid_2fa_code');
                } else {
                    elements.infoLogin.innerHTML = t('error_occurred');
                    elements.infoLogin2f.innerHTML = t('error_occurred');
                }
                this.enableLoginForm(elements);
                return;
            }

            if (account_connect.A2F === true) {
                this.toggleLoginCards("a2f");
                elements.a2finput.value = "";
                elements.cancelMojangBtn.disabled = false;
                return;
            }

            if (this.config.email_verified && !account_connect.user_info.verified) {
                elements.infoLogin.innerHTML = t('verify_email');
                elements.infoLogin2f.innerHTML = t('verify_email');
                this.enableLoginForm(elements);
                return;
            }

            console.log('[handleLogin] Full account_connect object:', account_connect);
            console.log('[handleLogin] account_connect.email:', account_connect.email);
            console.log('[handleLogin] account_connect.user_info:', account_connect.user_info);
            console.log('[handleLogin] mailInput value:', elements.mailInput.value);
            console.log('[handleLogin] emailFromForm (saved early):', emailFromForm);

            const account = this.createAccountObject(account_connect, emailFromForm);
            console.log('[handleLogin] Created account object:', account);
            console.log('[handleLogin] Account email field:', account.email);

            // Проверяем HWID перед входом
            console.log('[handleLogin] Checking HWID...');
            const hwidManager = new HwidManager(azauth);
            const hwidValidation = await hwidManager.validate();

            if (hwidValidation.banned) {
                console.error('[handleLogin] HWID is banned');
                elements.infoLogin.innerHTML = 'Ваше железо заблокировано. Обратитесь к администрации.';
                elements.infoLogin2f.innerHTML = 'Ваше железо заблокировано. Обратитесь к администрации.';
                this.enableLoginForm(elements);
                return;
            }

            console.log('[handleLogin] HWID check passed:', hwidValidation.message);

            // Проверяем чекбокс "чужой компьютер"
            const foreignComputerCheckbox = document.querySelector('#foreign-computer');
            const isForeignComputer = foreignComputerCheckbox && foreignComputerCheckbox.checked;

            if (isForeignComputer) {
                // Если отмечен "чужой компьютер", не сохраняем в базу данных
                // Только обновляем UI и переходим на главную панель
                await this.updateUIWithoutSaving(account);
            } else {
                // Обычное сохранение в базу данных
                await this.saveAccount(account);
            }

            this.resetLoginForm(elements);
            elements.loginBtn.style.display = "block";
            elements.infoLogin.innerHTML = "&nbsp;";
        } catch (err) {
            console.error(err);
            elements.infoLogin.innerHTML = t('connection_error');
            this.enableLoginForm(elements);
        }
    }

    createAccountObject(account_connect, emailFromForm = '') {
        return {
            access_token: account_connect.access_token,
            client_token: account_connect.uuid,
            uuid: account_connect.uuid,
            name: account_connect.name,
            email: '', // Email будет загружен из API в saveAccount
            user_properties: account_connect.user_properties,
            meta: {
                type: account_connect.meta.type,
                offline: true
            },
            user_info: {
                role: account_connect.user_info.role,
                monnaie: account_connect.user_info.money,
                verified: account_connect.user_info.verified,
            },
        };
    }

    async saveAccount(account) {
        console.log('[saveAccount] Starting save for account:', account.name, account.uuid);
        const existingAccount = await this.database.get(account.uuid, 'accounts');
        console.log('[saveAccount] Existing account:', existingAccount);
        showLoadingOverlay();

        // Получаем email из нашего API
        try {
            const azauth = this.getAzAuthUrl();
            const baseUrl = azauth.endsWith('/') ? azauth : `${azauth}/`;
            const url = `${baseUrl}api/centralcorp/account-info?uuid=${account.uuid}`;
            console.log('[saveAccount] Fetching email from:', url);

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const accountInfo = await response.json();
                console.log('[saveAccount] Account info from API:', accountInfo);
                if (accountInfo.email) {
                    account.email = accountInfo.email;
                    console.log('[saveAccount] Email updated from API:', account.email);
                }
            } else {
                console.warn('[saveAccount] Failed to fetch email from API:', response.status);
            }
        } catch (error) {
            console.error('[saveAccount] Error fetching email from API:', error);
        }

        if (existingAccount && existingAccount.value) {
            console.log('[saveAccount] Updating existing account');
            await this.database.update(account, 'accounts');
        } else {
            console.log('[saveAccount] Adding new account');
            await this.database.add(account, 'accounts');
        }

        console.log('[saveAccount] Account saved, now saving selected record');

        // Проверяем существование записи accounts-selected
        const selectedRecord = await this.database.get('1234', 'accounts-selected');
        console.log('[saveAccount] Existing selected record:', selectedRecord);

        if (selectedRecord && selectedRecord.value) {
            console.log('[saveAccount] Updating selected record');
            await this.database.update({ uuid: "1234", selected: account.uuid }, 'accounts-selected');
        } else {
            console.log('[saveAccount] Adding new selected record');
            await this.database.add({ uuid: "1234", selected: account.uuid }, 'accounts-selected');
        }

        console.log('[saveAccount] Selected record saved, verifying...');

        // Добавляем небольшую задержку, чтобы IndexedDB успел завершить транзакции
        await new Promise(resolve => setTimeout(resolve, 100));

        // Проверяем, что данные действительно сохранились
        const verifyAccount = await this.database.get(account.uuid, 'accounts');
        const verifySelected = await this.database.get('1234', 'accounts-selected');
        console.log('[saveAccount] Verify account:', verifyAccount);
        console.log('[saveAccount] Verify selected:', verifySelected);

        const azauth = this.getAzAuthUrl();
        const timestamp = new Date().getTime();
        const skin_url = `${azauth}api/skin-api/avatars/${account.name}/?t=${timestamp}`;
        document.querySelector(".player-head").style.backgroundImage = `url(${skin_url})`;

        // Сохраняем аккаунт во временную переменную для передачи в home.js
        // Это решает проблему race condition - данные передаются напрямую, как с аватаром
        window.temporaryAccount = account;

        changePanel("home");

        // Примусово оновлюємо UI панелі home після переходу
        console.log('[Login.saveAccount] Manually updating home panel UI');
        if (window.launcherPanels && window.launcherPanels.home) {
            await window.launcherPanels.home.updatePlayerInfo(account);
        }

        // Примусово оновлюємо 3D скін в settings панелі
        console.log('[Login.saveAccount] Manually updating settings skin');
        if (window.launcherPanels && window.launcherPanels.settings) {
            // Викликаємо ініціалізацію 3D скіна з переданим аккаунтом
            await window.launcherPanels.settings.init3DSkinViewer();
        }

        await this.refreshData(account);
    }

    async updateUIWithoutSaving(account) {
        showLoadingOverlay();

        // Обновляем только UI без сохранения в базу
        const azauth = this.getAzAuthUrl();
        const timestamp = new Date().getTime();
        const skin_url = `${azauth}api/skin-api/avatars/${account.name}/?t=${timestamp}`;
        document.querySelector(".player-head").style.backgroundImage = `url(${skin_url})`;

        // Временно сохраняем данные аккаунта в сессии для текущего запуска
        window.temporaryAccount = account;

        changePanel("home");

        // Примусово оновлюємо UI панелі home після переходу
        console.log('[Login.updateUIWithoutSaving] Manually updating home panel UI');
        if (window.launcherPanels && window.launcherPanels.home) {
            await window.launcherPanels.home.updatePlayerInfo(account);
        }

        // Примусово оновлюємо 3D скін в settings панелі
        console.log('[Login.updateUIWithoutSaving] Manually updating settings skin');
        if (window.launcherPanels && window.launcherPanels.settings) {
            await window.launcherPanels.settings.init3DSkinViewer();
        }

        await this.refreshDataTemporary(account);
    }

    async refreshDataTemporary(account) {
        const roleElement = document.querySelector('.player-role');
        const monnaieElement = document.querySelector('.player-monnaie');
        if (roleElement) roleElement.innerHTML = '';
        if (monnaieElement) monnaieElement.innerHTML = '';

        await this.initOthersTemporary(account);
        await this.initPreviewSkinTemporary(account);
        hideLoadingOverlay();
    }

    async initOthersTemporary(account) {
        this.updateRole(account);
        this.updateMoney(account);
        this.updateWhitelistTemporary(account);
    }

    updateWhitelistTemporary(account) {
        const playBtn = document.querySelector(".play-btn");
        if (this.config.whitelist_activate &&
            (!this.config.whitelist.includes(account.name) &&
                !this.config.whitelist_roles.includes(account.user_info.role.name))) {
            playBtn.style.backgroundColor = "#696969";
            playBtn.style.pointerEvents = "none";
            playBtn.style.boxShadow = "none";
            playBtn.textContent = t('unavailable');
        } else {
            playBtn.style.backgroundColor = "#01C5FF";
            playBtn.style.pointerEvents = "auto";
            playBtn.style.boxShadow = "2px 2px 5px rgba(0, 0, 0, 0.3)";
            playBtn.textContent = t('play');
        }
    }

    async initPreviewSkinTemporary(account) {
        console.log('initPreviewSkinTemporary called');
        const baseUrl = settings_url.endsWith('/') ? settings_url : `${settings_url}/`;
        const websiteUrl = pkg.env === 'azuriom' ? `${baseUrl}` : this.config.azauth;

        const skinTitleElement = document.querySelector('.player-skin-title');
        const skinRendererElement = document.querySelector('.skin-renderer-settings');

        if (skinTitleElement) {
            skinTitleElement.innerHTML = `${t('skin_of')} ${account.name}`;
        }

        if (skinRendererElement) {
            skinRendererElement.src = `${websiteUrl}skin3d/3d-api/skin-api/${account.name}`;
        } else {
            console.warn('Skin renderer element not found in DOM');
        }
    }

    setupPasswordToggle() {
        const togglePassword = document.querySelector('.toggle-password');
        const passwordInput = document.querySelector('.Password');

        if (togglePassword && passwordInput) {
            togglePassword.addEventListener('click', () => {
                const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
                passwordInput.setAttribute('type', type);

                togglePassword.classList.toggle('fa-eye');
                togglePassword.classList.toggle('fa-eye-slash');
                togglePassword.classList.toggle('active');
            });
        }
    }
}

export default Login;
