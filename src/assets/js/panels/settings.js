/**
 * @author Luuxis
 * Licensed under CC BY-NC 4.0
 * https://creativecommons.org/licenses/by-nc/4.0/
 *
 * Edited by CentralCorp Team
 */
'use strict';

import { database, changePanel, Slider, showLoadingOverlay, hideLoadingOverlay, t } from '../utils.js';
const dataDirectory = process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME);

const os = require('os');
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');
const pkg = require('../package.json');
const { ipcRenderer, shell } = require('electron');
const settings_url = pkg.user ? `${pkg.settings}/${pkg.user}` : pkg.settings;

class Settings {
    static id = "settings";

    async init(config) {
        this.config = config;
        this.database = await new database().init();
        this.initSettingsDefault();
        this.initTab();
        this.initRam();
        this.initLauncherSettings();
        this.updateModsConfig();
        this.initOptionalMods();
        this.headplayer();
        this.initSkinDropzone();
        // Инициализируем 3D вьювер асинхронно, не блокируя основную загрузку
        setTimeout(() => this.init3DSkinViewer(), 100);

        // Загружаем credentials асинхронно, чтобы не блокировать инициализацию
        setTimeout(() => {
            console.log('[Settings] Starting loadCredentials...');
            this.loadCredentials().catch(err => {
                console.error('[Settings] Failed to load credentials:', err);
            });
        }, 200);
    }

    initSkinDropzone() {
        this.initDropzone('skinDropzone', 'fileInput', (file) => this.handleSkinFile(file));
        this.initDropzone('capeDropzone', 'capeFileInput', (file) => this.handleCapeFile(file));
    }

    initDropzone(dropzoneId, inputId, handler) {
        const dropzone = document.getElementById(dropzoneId);
        const fileInput = document.getElementById(inputId);

        if (!dropzone || !fileInput) return;

        dropzone.addEventListener('click', () => {
            fileInput.click();
        });

        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                await handler(file);
            }
        });

        dropzone.addEventListener('dragenter', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.add('drag-over');
        });

        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.add('drag-over');
        });

        dropzone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.remove('drag-over');
        });

        dropzone.addEventListener('drop', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.remove('drag-over');

            const files = e.dataTransfer.files;
            if (files.length > 0) {
                await handler(files[0]);
            }
        });
    }

    async handleSkinFile(file) {
        if (!file) return;

        if (file.type !== 'image/png') {
            this.showNotification('Ошибка', 'Требуется PNG файл', 'error');
            return;
        }

        const img = new Image();
        img.src = URL.createObjectURL(file);
        img.onload = async () => {
            if (img.width !== 64 || img.height !== 64) {
                this.showNotification('Ошибка', 'Скин должен быть 64x64 пикселей', 'error');
                return;
            }

            const dropzone = document.getElementById('skinDropzone');
            dropzone.classList.add('upload-success');

            await this.processSkinChange(file);

            setTimeout(() => {
                dropzone.classList.remove('upload-success');
            }, 2000);
        };
    }

    async handleCapeFile(file) {
        if (!file) return;

        if (file.type !== 'image/png') {
            this.showNotification('Ошибка', 'Требуется PNG файл', 'error');
            return;
        }

        const img = new Image();
        img.src = URL.createObjectURL(file);
        img.onload = async () => {
            if (img.width !== 64 || img.height !== 32) {
                this.showNotification('Ошибка', 'Плащ должен быть 64x32 пикселей', 'error');
                return;
            }

            const dropzone = document.getElementById('capeDropzone');
            dropzone.classList.add('upload-success');

            await this.processCapeChange(file);

            setTimeout(() => {
                dropzone.classList.remove('upload-success');
            }, 2000);
        };
    }

    async processCapeChange(file) {
        if (!file) {
            console.error('No file provided');
            return;
        }
        const azauth = this.getAzAuthUrl();
        let uuid = (await this.database.get('1234', 'accounts-selected')).value;
        let account = (await this.database.get(uuid.selected, 'accounts')).value;
        const access_token = account.access_token;
        const formData = new FormData();
        formData.append('access_token', access_token);
        formData.append('type', 'CAPE');
        formData.append('file', file);
        const xhr = new XMLHttpRequest();

        xhr.open('POST', `${azauth}api/skin-api/update`, true);

        xhr.onload = async () => {
            console.log(`XHR Response: ${xhr.response}`);
            if (xhr.status === 200) {
                console.log('Cape updated successfully!');
                await this.initPreviewSkin();
            } else {
                console.error(`Failed to update cape. Status code: ${xhr.status}`);
            }
        };

        xhr.onerror = () => {
            console.error('Request failed');
        };

        xhr.send(formData);
    }

    async processSkinChange(file) {
        if (!file) {
            console.error('No file provided');
            return;
        }
        const azauth = this.getAzAuthUrl();
        let uuid = (await this.database.get('1234', 'accounts-selected')).value;
        let account = (await this.database.get(uuid.selected, 'accounts')).value;
        const access_token = account.access_token;
        const formData = new FormData();
        formData.append('access_token', access_token);
        formData.append('type', 'SKIN');
        formData.append('file', file);
        const xhr = new XMLHttpRequest();

        xhr.open('POST', `${azauth}api/skin-api/update`, true);

        xhr.onload = async () => {
            console.log(`XHR Response: ${xhr.response}`);
            if (xhr.status === 200) {
                console.log('Skin updated successfully!');
                await this.init3DSkinViewer();
            } else {
                console.error(`Failed to update skin. Status code: ${xhr.status}`);
            }
        };

        xhr.onerror = () => {
            console.error('Request failed');
        };

        xhr.send(formData);
    }

    async refreshData() {
        const playerName = document.querySelector('.player-name');
        const playerRoleText = document.querySelector('.player-role-text');

        if (playerName) playerName.textContent = '';
        if (playerRoleText) playerRoleText.textContent = '';

        await this.initOthers();
        await this.initPreviewSkin();
        await this.updateAccountImage();
        hideLoadingOverlay();
    }

    async headplayer() {
        const uuid = (await this.database.get('1234', 'accounts-selected')).value;
        const account = (await this.database.get(uuid.selected, 'accounts')).value;
        const pseudo = account.name;
        const azauth = this.getAzAuthUrl();
        const timestamp = new Date().getTime();
        const skin_url = `${azauth}api/skin-api/avatars/${pseudo}/?t=${timestamp}`;
        document.querySelector(".player-head").style.backgroundImage = `url(${skin_url})`;
    }

    async updateAccountImage() {
        const uuid = (await this.database.get('1234', 'accounts-selected')).value;
        const account = (await this.database.get(uuid.selected, 'accounts')).value;
        const azauth = this.getAzAuthUrl();
        const timestamp = new Date().getTime();

        const accountDiv = document.getElementById(account.uuid);
        if (accountDiv) {
            const accountImage = accountDiv.querySelector('.account-image');
            if (accountImage) {
                accountImage.src = `${azauth}api/skin-api/avatars/${account.name}/?t=${timestamp}`;
            } else {
                console.error('Image not found in the selected account div.');
            }
        } else {
            console.error(`No div found with UUID: ${account.uuid}`);
        }
    }

    async init3DSkinViewer() {
        // Ждём загрузки библиотеки skinview3d с таймаутом
        let attempts = 0;
        const maxAttempts = 50; // 5 секунд максимум

        while (typeof skinview3d === 'undefined' && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }

        // Проверяем доступность skinview3d библиотеки после ожидания
        if (typeof skinview3d === 'undefined') {
            console.error('skinview3d library not loaded after timeout');
            return;
        }

        const canvas = document.getElementById('skin_container');
        if (!canvas) {
            console.error('Canvas element not found');
            return;
        }

        // Получаем данные аккаунта
        const uuid = (await this.database.get('1234', 'accounts-selected')).value;
        const account = (await this.database.get(uuid.selected, 'accounts')).value;
        const pseudo = account.name;
        const azauth = this.getAzAuthUrl();

        console.log('Initializing 3D skin viewer for:', pseudo);

        // Создаём 3D вьювер скина
        const skinViewer = new skinview3d.SkinViewer({
            canvas: canvas,
            width: 319,
            height: 221,
            enableControls: true,
        });

        skinViewer.autoRotate = true;
        skinViewer.autoRotateSpeed = 0.8;
        skinViewer.controls.enableRotate = true;
        skinViewer.controls.enableZoom = false;
        skinViewer.controls.enablePan = true;
        skinViewer.animation = new skinview3d.WalkingAnimation();
        skinViewer.animation.speed = 0.8;

        // Загружаем скин и плащ
        try {
            await skinViewer.loadSkin(`${azauth}api/skin-api/skins/${pseudo}`);
            console.log('Skin loaded successfully');
            try {
                await skinViewer.loadCape(`${azauth}api/skin-api/capes/${pseudo}`);
                console.log('Cape loaded successfully');
            } catch (capeError) {
                console.log('No cape found for user:', pseudo);
            }
        } catch (error) {
            console.error('Error loading skin:', error);
        }

        // Сохраняем ссылку на вьювер для обновления
        this.skinViewer = skinViewer;
    }

    async initOthers() {
        const uuid = (await this.database.get('1234', 'accounts-selected')).value;
        const account = (await this.database.get(uuid.selected, 'accounts')).value;

        this.updateRole(account);
        this.updateMoney(account);
        this.updateWhitelist(account);
    }

    updateRole(account) {
        const playerName = document.querySelector('.player-name');
        const playerRoleText = document.querySelector('.player-role-text');

        if (playerName) {
            playerName.textContent = account.name;
        }

        if (account.user_info && account.user_info.role) {
            const roleName = account.user_info.role.name;
            if (playerRoleText) {
                playerRoleText.textContent = roleName;
                playerRoleText.style.display = '';
            }
        } else {
            if (playerRoleText) {
                playerRoleText.style.display = 'none';
            }
        }
    }

    updateMoney(account) {
        // Метод більше не використовується, оскільки елемент player-monnaie видалено
    }

    updateWhitelist(account) {
        const playBtn = document.querySelector(".play-btn");

        if (this.config.whitelist_activate &&
            (!this.config.whitelist.includes(account.name) &&
                !this.config.whitelist_roles.includes(account.user_info.role.name))) {
            playBtn.style.background = "#696969";
            playBtn.style.pointerEvents = "none";
            playBtn.style.boxShadow = "none";
            playBtn.textContent = t('unavailable');
        } else {
            playBtn.style.background = "";
            playBtn.style.pointerEvents = "auto";
            playBtn.style.boxShadow = "";
            playBtn.style.opacity = "1";
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


    async initRam() {
        const ramDatabase = (await this.database.get('1234', 'ram'))?.value;
        const totalMem = Math.trunc(os.totalmem() / 1073741824 * 10) / 10;
        const freeMem = Math.trunc(os.freemem() / 1073741824 * 10) / 10;

        document.getElementById("total-ram").textContent = `${totalMem} Go RAM`;
        document.getElementById("free-ram").textContent = `${freeMem} Go RAM disponible`;

        const sliderDiv = document.querySelector(".memory-slider");
        sliderDiv.setAttribute("max", Math.trunc((80 * totalMem) / 100));

        const ram = ramDatabase ? ramDatabase : { ramMin: this.config.ram_min, ramMax: this.config.ram_max };
        const slider = new Slider(".memory-slider", parseFloat(ram.ramMin), parseFloat(ram.ramMax));

        const minSpan = document.querySelector(".slider-touch-left span");
        const maxSpan = document.querySelector(".slider-touch-right span");

        minSpan.setAttribute("value", `${ram.ramMin} Go`);
        maxSpan.setAttribute("value", `${ram.ramMax} Go`);

        slider.on("change", (min, max) => {
            minSpan.setAttribute("value", `${min} Go`);
            maxSpan.setAttribute("value", `${max} Go`);
            this.database.update({ uuid: "1234", ramMin: `${min}`, ramMax: `${max}` }, 'ram');
        });
    }

    async updateModsConfig() {
        const modsDir = path.join(`${dataDirectory}/${process.platform == 'darwin' ? this.config.dataDirectory : `.${this.config.dataDirectory}`}`, 'mods');
        const launcherConfigDir = path.join(`${dataDirectory}/${process.platform == 'darwin' ? this.config.dataDirectory : `.${this.config.dataDirectory}`}`, 'launcher_config');
        const modsConfigFile = path.join(launcherConfigDir, 'mods_config.json');

        const db = new database();
        await db.init();
        const serverData = await db.get('server-selected', 'server-selected');
        const serverId = serverData?.value?.selectedServer?.id || null;

        const baseUrl = settings_url.endsWith('/') ? settings_url : `${settings_url}/`;
        const apiUrl = pkg.env === 'azuriom' ? `${baseUrl}api/centralcorp/mods` : `${baseUrl}utils/mods`;
        const response = await fetch(serverId ? `${apiUrl}?server_id=${serverId}` : apiUrl);
        const apiMods = await response.json();
        const apiModsSet = new Set(apiMods.optionalMods);

        let localModsConfig;
        try {
            localModsConfig = JSON.parse(fs.readFileSync(modsConfigFile));
        } catch (error) {
            await this.createModsConfig(modsConfigFile);
            localModsConfig = JSON.parse(fs.readFileSync(modsConfigFile));
        }

        for (const localMod in localModsConfig) {
            if (!apiModsSet.has(localMod)) {
                if (!localModsConfig[localMod]) {
                    const modFiles = fs.readdirSync(modsDir).filter(file => file.startsWith(localMod) && file.endsWith('.jar-disable'));
                    if (modFiles.length > 0) {
                        const modFile = modFiles[0];
                        const modFilePath = path.join(modsDir, modFile);
                        const newModFilePath = modFilePath.replace('.jar-disable', '.jar');
                        fs.renameSync(modFilePath, newModFilePath);
                    }
                }
                delete localModsConfig[localMod];
            }
        }

        apiMods.optionalMods.forEach(apiMod => {
            if (!(apiMod in localModsConfig)) {
                localModsConfig[apiMod] = true;
            }
        });

        fs.writeFileSync(modsConfigFile, JSON.stringify(localModsConfig, null, 2));
    }

    async initOptionalMods() {
        const modsDir = path.join(`${dataDirectory}/${process.platform == 'darwin' ? this.config.dataDirectory : `.${this.config.dataDirectory}`}`, 'mods');
        const launcherConfigDir = path.join(`${dataDirectory}/${process.platform == 'darwin' ? this.config.dataDirectory : `.${this.config.dataDirectory}`}`, 'launcher_config');
        const modsConfigFile = path.join(launcherConfigDir, 'mods_config.json');
        const modsListElement = document.getElementById('mods-list');

        if (!fs.existsSync(launcherConfigDir)) {
            fs.mkdirSync(launcherConfigDir, { recursive: true });
        }

        if (!fs.existsSync(modsDir) || fs.readdirSync(modsDir).length === 0) {
            this.displayEmptyModsMessage(modsListElement);
            if (!fs.existsSync(modsConfigFile)) {
                await this.createModsConfig(modsConfigFile);
            }
        } else {
            await this.displayMods(modsConfigFile, modsDir, modsListElement);
        }
    }

    displayEmptyModsMessage(modsListElement) {
        const modElement = document.createElement('div');
        modElement.innerHTML = `
            <div class="mods-container-empty">
              <h2>⚠️ Дополнительные моды еще не загружены. Пожалуйста, запустите игру в первый раз, чтобы вы могли их настроить, а затем перезапустите программу запуска. ⚠️<h2>
            </div>`;
        modsListElement.appendChild(modElement);
    }

    async createModsConfig(modsConfigFile) {
        const db = new database();
        await db.init();
        const serverData = await db.get('server-selected', 'server-selected');
        const serverId = serverData?.value?.selectedServer?.id || null;

        const baseUrl = settings_url.endsWith('/') ? settings_url : `${settings_url}/`;
        const apiUrl = pkg.env === 'azuriom' ? `${baseUrl}api/centralcorp/mods` : `${baseUrl}utils/mods`;
        const response = await fetch(serverId ? `${apiUrl}?server_id=${serverId}` : apiUrl);
        const data = await response.json();
        const modsConfig = {};

        data.optionalMods.forEach(mod => {
            modsConfig[mod] = true;
        });

        fs.writeFileSync(modsConfigFile, JSON.stringify(modsConfig, null, 2));
    }

    async displayMods(modsConfigFile, modsDir, modsListElement) {
        let modsConfig;

        try {
            modsConfig = JSON.parse(fs.readFileSync(modsConfigFile));
        } catch (error) {
            await this.createModsConfig(modsConfigFile);
            modsConfig = JSON.parse(fs.readFileSync(modsConfigFile));
        }

        const db = new database();
        await db.init();
        const serverData = await db.get('server-selected', 'server-selected');
        const serverId = serverData?.value?.selectedServer?.id || null;

        const baseUrl = settings_url.endsWith('/') ? settings_url : `${settings_url}/`;
        const apiUrl = pkg.env === 'azuriom' ? `${baseUrl}api/centralcorp/mods` : `${baseUrl}utils/mods`;
        const response = await fetch(serverId ? `${apiUrl}?server_id=${serverId}` : apiUrl);
        const data = await response.json();

        if (!data.optionalMods || !data.mods) {
            console.error('La réponse API ne contient pas "optionalMods" ou "mods".');
            return;
        }

        data.optionalMods.forEach(mod => {
            const modElement = document.createElement('div');
            const modInfo = data.mods[mod];
            if (!modInfo) {
                console.error(`Les informations pour le mod "${mod}" sont manquantes dans "mods".`);
                modElement.innerHTML = `
                <div class="mods-container">
                  <h2>${t('mod_info_missing_admin').replace('${mod}', mod)}<h2>
                   <div class="switch">
                      <label class="switch-label">
                        <input type="checkbox" id="${mod}" name="mod" value="${mod}" ${modsConfig[mod] ? 'checked' : ''}>
                        <span class="slider round"></span>
                      </label>
                  </div>
                </div>
                <hr>`;
                return;
            }

            const modName = modInfo.name;
            const modDescription = modInfo.description || t('no_mod_description');
            const modLink = modInfo.icon;
            const modRecommanded = modInfo.recommanded;

            modElement.innerHTML = `
                <div class="mods-container">
                  ${modLink ? `<img src="${modLink}" class="mods-icon" alt="${modName} logo">` : ''}
                  <div class="mods-container-text">
                    <div class="mods-container-name">                    
                        <h2>${modName}</h2>
                        <div class="mods-recommanded" style="display: none;">${t('recommended')}</div>
                    </div>
                    <div class="mod-description">${modDescription}</div>
                  </div>
                  <div class="switch">
                    <label class="switch-label">
                      <input type="checkbox" id="${mod}" name="mod" value="${mod}" ${modsConfig[mod] ? 'checked' : ''}>
                      <span class="slider round"></span>
                    </label>
                  </div>
                </div>
                <hr>
            `;

            if (modRecommanded) {
                modElement.querySelector('.mods-recommanded').style.display = 'block';
            }

            modElement.querySelector('input').addEventListener('change', (e) => {
                this.toggleMod(mod, e.target.checked, modsConfig, modsDir, modsConfigFile);
            });

            modsListElement.appendChild(modElement);
        });
    }

    async toggleMod(mod, enabled, modsConfig, modsDir, modsConfigFile) {
        const modFiles = fs.readdirSync(modsDir).filter(file => file.startsWith(mod) && (file.endsWith('.jar') || file.endsWith('.jar-disable')));

        if (modFiles.length > 0) {
            const modFile = modFiles[0];
            const modFilePath = path.join(modsDir, modFile);
            const newModFilePath = enabled ? modFilePath.replace('.jar-disable', '.jar') : modFilePath.replace('.jar', '.jar-disable');

            fs.renameSync(modFilePath, newModFilePath);

            modsConfig[mod] = enabled;
            fs.writeFileSync(modsConfigFile, JSON.stringify(modsConfig, null, 2));
        }
    }

    async selectFile() {
        const input = document.getElementById('fileInput');
        input.click();

        input.onchange = async () => {
            const file = input.files[0];
            if (!file) return;
            if (file.type !== 'image/png') {
                this.showNotification('Ошибка', 'Требуется PNG файл', 'error');
                return;
            }
            const img = new Image();
            img.src = URL.createObjectURL(file);
            img.onload = async () => {
                if (img.width !== 64 || img.height !== 64) {
                    this.showNotification('Ошибка', 'Скин должен быть 64x64 пикселей', 'error');
                    return;
                }

                await this.processSkinChange.bind(this)(file);
            };
        };
    }

    async processSkinChange(file) {
        if (!file) {
            console.error('No file provided');
            return;
        }
        const azauth = this.getAzAuthUrl();
        let uuid = (await this.database.get('1234', 'accounts-selected')).value;
        let account = (await this.database.get(uuid.selected, 'accounts')).value;
        const access_token = account.access_token;
        const formData = new FormData();
        formData.append('access_token', access_token);
        formData.append('type', 'SKIN');
        formData.append('file', file);
        const xhr = new XMLHttpRequest();

        xhr.open('POST', `${azauth}api/skin-api/update`, true);

        xhr.onload = async () => {
            console.log(`XHR Response: ${xhr.response}`);
            if (xhr.status === 200) {
                console.log('Skin updated successfully!');
                await this.initPreviewSkin();
                await this.headplayer();
            } else {
                console.error(`Failed to update skin. Status code: ${xhr.status}`);
            }
        };

        xhr.onerror = () => {
            console.error('Request failed');
        };

        xhr.send(formData);
    }

    async initPreviewSkin() {
        console.log('initPreviewSkin called');
        const azauth = this.getAzAuthUrl();
        let uuid = (await this.database.get('1234', 'accounts-selected')).value;
        let account = (await this.database.get(uuid.selected, 'accounts')).value;

        let title = document.querySelector('.player-skin-title');
        if (title) {
            title.innerHTML = `Скин ${account.name}`;
        }

        // Обновляем 3D вьювер скина если он уже инициализирован
        if (this.skinViewer) {
            try {
                await this.skinViewer.loadSkin(`${azauth}api/skin-api/skins/${account.name}`);
                try {
                    await this.skinViewer.loadCape(`${azauth}api/skin-api/capes/${account.name}`);
                } catch (capeError) {
                    console.log('No cape found for user:', account.name);
                }
            } catch (error) {
                console.error('Error updating skin:', error);
            }
        }
    }

    async initResolution() {
        let resolutionDatabase = (await this.database.get('1234', 'screen'))?.value?.screen;
        let resolution = resolutionDatabase ? resolutionDatabase : { width: "1280", height: "720" };

        let width = document.querySelector(".width-size");
        width.value = resolution.width;

        let height = document.querySelector(".height-size");
        height.value = resolution.height;

        let select = document.getElementById("select");
        select.addEventListener("change", (event) => {
            let resolution = select.options[select.options.selectedIndex].value.split(" x ");
            select.options.selectedIndex = 0;

            width.value = resolution[0];
            height.value = resolution[1];
            this.database.update({ uuid: "1234", screen: { width: resolution[0], height: resolution[1] } }, 'screen');
        });
    }

    async initLauncherSettings() {
        let launcherDatabase = (await this.database.get('1234', 'launcher'))?.value;
        let settingsLauncher = {
            uuid: "1234",
            launcher: {
                close: launcherDatabase?.launcher?.close || 'close-launcher'
            }
        }

        let closeLauncher = document.getElementById("launcher-close");
        let closeAll = document.getElementById("launcher-close-all");
        let openLauncher = document.getElementById("launcher-open");

        if (settingsLauncher.launcher.close === 'close-launcher') {
            closeLauncher.checked = true;
        } else if (settingsLauncher.launcher.close === 'close-all') {
            closeAll.checked = true;
        } else if (settingsLauncher.launcher.close === 'open-launcher') {
            openLauncher.checked = true;
        }

        closeLauncher.addEventListener("change", () => {
            if (closeLauncher.checked) {
                openLauncher.checked = false;
                closeAll.checked = false;
            }
            if (!closeLauncher.checked) closeLauncher.checked = true;
            settingsLauncher.launcher.close = 'close-launcher';
            this.database.update(settingsLauncher, 'launcher');
        })

        closeAll.addEventListener("change", () => {
            if (closeAll.checked) {
                closeLauncher.checked = false;
                openLauncher.checked = false;
            }
            if (!closeAll.checked) closeAll.checked = true;
            settingsLauncher.launcher.close = 'close-all';
            this.database.update(settingsLauncher, 'launcher');
        })

        openLauncher.addEventListener("change", () => {
            if (openLauncher.checked) {
                closeLauncher.checked = false;
                closeAll.checked = false;
            }
            if (!openLauncher.checked) openLauncher.checked = true;
            settingsLauncher.launcher.close = 'open-launcher';
            this.database.update(settingsLauncher, 'launcher');
        })
    }

    initTab() {
        let TabBtn = document.querySelectorAll('.tab-btn');
        let TabContent = document.querySelectorAll('.tabs-settings-content');

        for (let i = 0; i < TabBtn.length; i++) {
            TabBtn[i].addEventListener('click', () => {
                if (TabBtn[i].classList.contains('save-tabs-btn') || TabBtn[i].classList.contains('logout-tabs-btn')) return;
                for (let j = 0; j < TabBtn.length; j++) {
                    TabContent[j].classList.remove('active-tab-content');
                    TabBtn[j].classList.remove('active-tab-btn');
                }
                TabContent[i].classList.add('active-tab-content');
                TabBtn[i].classList.add('active-tab-btn');
            });
        }

        document.querySelector('.save-tabs-btn').addEventListener('click', async () => {
            document.querySelector('.default-tab-btn').click();
            showLoadingOverlay();
            changePanel("home");
            await this.refreshData();
        });

        document.querySelector('.logout-tabs-btn').addEventListener('click', async () => {
            const allAccounts = await this.database.getAll('accounts');
            for (const account of allAccounts) {
                await this.database.delete(account.value.uuid, 'accounts');
            }
            changePanel("login");
        });

        document.getElementById('accounts-tab').innerHTML = `<i class="fas fa-user"></i><span>${t('accounts')}</span>`;
        document.getElementById('ram-tab').innerHTML = `<i class="fab fa-java"></i><span>${t('ram_settings')}</span>`;
        document.getElementById('launch-tab').innerHTML = `<i class="fas fa-rocket"></i><span>${t('launcher_loading')}</span>`;
        document.getElementById('mods-tab').innerHTML = `<i class="fas fa-puzzle-piece"></i><span>${t('optional_mods')}</span>`;
        document.getElementById('save-tab').innerHTML = `<i class="fas fa-save"></i><span>${t('save')}</span>`;
        document.getElementById('logout-tab').innerHTML = `<i class="fas fa-sign-out-alt"></i><span>Выход</span>`;

        document.getElementById('ram-title').textContent = t('ram_settings');
        document.getElementById('ram-info').innerHTML = t('ram_detailed_info');
        document.getElementById('total-ram').textContent = t('total_ram');
        document.getElementById('free-ram').textContent = t('free_ram');
        document.getElementById('launch-title').textContent = t('launcher_loading');
        document.getElementById('close-launcher-text').textContent = t('close_launcher');
        document.getElementById('close-all-text').textContent = t('close_all');
        document.getElementById('open-launcher-text').textContent = t('open_launcher');
        document.getElementById('mods-title').textContent = t('optional_mods');
        document.getElementById('mods-info').innerHTML = t('mods_detailed_info');
        document.getElementById('skin-title').textContent = t('skin');

        const dropzoneText = document.getElementById('dropzone-text');
        if (dropzoneText) dropzoneText.textContent = t('dropzone_drag');
        const dropzoneSubtext = document.querySelector('.dropzone-subtext');
        if (dropzoneSubtext) dropzoneSubtext.textContent = t('dropzone_click');
        const dropzoneReq = document.querySelector('.dropzone-requirements');
        if (dropzoneReq) dropzoneReq.textContent = t('dropzone_requirements');
        const dropzoneHoverSpan = document.querySelector('.dropzone-hover-state span');
        if (dropzoneHoverSpan) dropzoneHoverSpan.textContent = t('dropzone_drop');

        this.initCredentialsForm();
    }

    initCredentialsForm() {
        // Инициализация модальных окон
        this.initEmailModal();
        this.initPasswordModal();

        // Общие toggle для паролей
        document.querySelectorAll('.toggle-password-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetId = btn.getAttribute('data-target');
                const input = document.getElementById(targetId);
                if (input) {
                    const isPassword = input.type === 'password';
                    input.type = isPassword ? 'text' : 'password';
                    btn.querySelector('i').className = isPassword ? 'fas fa-eye-slash' : 'fas fa-eye';
                }
            });
        });

        this.loadCredentials();
    }

    showNotification(title, message, type = 'success') {
        const container = document.getElementById('notification-container');
        if (!container) return;

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;

        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            info: 'fa-info-circle',
            warning: 'fa-exclamation-triangle'
        };

        notification.innerHTML = `
            <div class="notification-icon">
                <i class="fas ${icons[type]}"></i>
            </div>
            <div class="notification-content">
                <div class="notification-title">${title}</div>
                <div class="notification-message">${message}</div>
            </div>
            <button class="notification-close">
                <i class="fas fa-times"></i>
            </button>
        `;

        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => {
            notification.classList.add('closing');
            setTimeout(() => notification.remove(), 300);
        });

        container.appendChild(notification);

        // Автоматически убираем через 5 секунд
        setTimeout(() => {
            if (notification.parentElement) {
                notification.classList.add('closing');
                setTimeout(() => notification.remove(), 300);
            }
        }, 5000);
    }

    initEmailModal() {
        const modal = document.getElementById('email-modal');
        const openBtn = document.getElementById('edit-email-btn');
        const closeBtn = document.getElementById('close-email-modal');

        const step1 = document.getElementById('email-step-1');
        const step2 = document.getElementById('email-step-2');
        const errorDiv = document.getElementById('email-modal-error');

        openBtn.addEventListener('click', () => {
            modal.classList.add('active');
            step1.classList.remove('hidden');
            step2.classList.add('hidden');
            errorDiv.classList.add('hidden');
        });

        closeBtn.addEventListener('click', () => {
            modal.classList.remove('active');
            this.resetEmailModal();
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
                this.resetEmailModal();
            }
        });

        // Отправка кода на текущий email
        document.getElementById('send-email-code-1').addEventListener('click', async () => {
            try {
                const azauth = this.getAzAuthUrl();
                const uuidValue = (await this.database.get('1234', 'accounts-selected')).value;
                let account = (await this.database.get(uuidValue.selected, 'accounts')).value;

                // Логируем полный объект аккаунта для отладки
                console.log('[send-email-code-1] Full account object:', JSON.stringify(account, null, 2));
                console.log('[send-email-code-1] Account UUID:', account.uuid);
                console.log('[send-email-code-1] Account email:', account.email);

                // Если email не загружен - загружаем его сейчас из API
                if (!account.email && account.uuid) {
                    console.log('[send-email-code-1] Email not loaded, fetching from API...');
                    try {
                        const response = await fetch(`${azauth}api/apiextender/account-info`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ uuid: account.uuid })
                        });

                        if (response.ok) {
                            const data = await response.json();
                            if (data.user && data.user.email) {
                                account.email = data.user.email;
                                // Сохраняем email в локальную базу данных
                                await this.database.update(account, 'accounts');
                                console.log('[send-email-code-1] Email loaded:', account.email);
                            } else {
                                console.error('[send-email-code-1] No email in API response');
                                this.showEmailError('Не удалось получить email из API');
                                return;
                            }
                        } else {
                            const errorText = await response.text();
                            console.error('[send-email-code-1] Failed to fetch account info, status:', response.status);
                            console.error('[send-email-code-1] Error response:', errorText);
                            this.showEmailError('Ошибка загрузки данных аккаунта');
                            return;
                        }
                    } catch (fetchError) {
                        console.error('[send-email-code-1] Error fetching account info:', fetchError);
                        this.showEmailError('Ошибка подключения к API');
                        return;
                    }
                } else if (!account.uuid) {
                    console.error('[send-email-code-1] Account UUID is empty or undefined');
                    this.showEmailError('UUID аккаунта не найден');
                    return;
                }

                const url = `${azauth}api/apiextender/send-email-verification`;
                console.log('[send-email-code-1] Sending request to:', url);
                console.log('[send-email-code-1] UUID:', account.uuid);
                console.log('[send-email-code-1] Email:', account.email);

                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        uuid: account.uuid,
                        email: account.email
                    })
                });

                console.log('[send-email-code-1] Response status:', response.status);
                console.log('[send-email-code-1] Response OK:', response.ok);
                const responseText = await response.text();
                console.log('[send-email-code-1] Response body:', responseText);

                if (response.ok) {
                    try {
                        const data = JSON.parse(responseText);
                        this.showNotification('Успешно', 'Код отправлен на почту', 'success');
                    } catch (parseError) {
                        console.error('[send-email-code-1] JSON parse error:', parseError);
                        console.error('[send-email-code-1] Response was:', responseText);
                        this.showEmailError('Ошибка парсинга ответа сервера');
                    }
                } else {
                    console.error('[send-email-code-1] Error response:', responseText);
                    this.showEmailError('Ошибка отправки кода: ' + response.status);
                }
            } catch (error) {
                console.error('[send-email-code-1] Fetch error:', error);
                console.error('[send-email-code-1] Error name:', error.name);
                console.error('[send-email-code-1] Error message:', error.message);
                console.error('[send-email-code-1] Error stack:', error.stack);
                this.showEmailError('Ошибка подключения: ' + error.message);
            }
        });

        // Проверка кода для текущего email
        document.getElementById('verify-email-code-1').addEventListener('click', async () => {
            const code = document.getElementById('email-verify-code-1').value;
            if (!code) {
                this.showEmailError('Введите код');
                return;
            }

            try {
                const azauth = this.getAzAuthUrl();
                const uuidValue = (await this.database.get('1234', 'accounts-selected')).value;
                const account = (await this.database.get(uuidValue.selected, 'accounts')).value;

                const response = await fetch(`${azauth}api/apiextender/verify-email-code`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        uuid: account.uuid,
                        code: code
                    })
                });

                if (response.ok) {
                    step1.classList.add('hidden');
                    step2.classList.remove('hidden');
                    errorDiv.classList.add('hidden');
                } else {
                    const errorText = await response.text();
                    console.error('[verify-email-code-1] Error:', errorText);
                    this.showEmailError('Неверный код');
                }
            } catch (error) {
                console.error('[verify-email-code-1] Fetch error:', error);
                this.showEmailError('Ошибка подключения');
            }
        });

        // Отправка кода на новый email
        document.getElementById('send-email-code-2').addEventListener('click', async () => {
            const newEmail = document.getElementById('new-email-input').value;
            if (!newEmail) {
                this.showEmailError('Введите новый email');
                return;
            }

            try {
                const azauth = this.getAzAuthUrl();
                const uuidValue = (await this.database.get('1234', 'accounts-selected')).value;
                const account = (await this.database.get(uuidValue.selected, 'accounts')).value;

                const response = await fetch(`${azauth}api/apiextender/send-email-verification`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        uuid: account.uuid,
                        email: newEmail
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    this.showNotification('Успешно', 'Код отправлен на новую почту', 'success');
                } else {
                    const errorText = await response.text();
                    console.error('[send-email-code-2] Error:', errorText);
                    this.showEmailError('Ошибка отправки кода');
                }
            } catch (error) {
                console.error('[send-email-code-2] Fetch error:', error);
                this.showEmailError('Ошибка подключения');
            }
        });

        // Проверка кода и смена email
        document.getElementById('verify-email-code-2').addEventListener('click', async () => {
            const newEmail = document.getElementById('new-email-input').value;
            const code = document.getElementById('email-verify-code-2').value;

            if (!newEmail || !code) {
                this.showEmailError('Заполните все поля');
                return;
            }

            try {
                const azauth = this.getAzAuthUrl();
                const uuidValue = (await this.database.get('1234', 'accounts-selected')).value;
                const account = (await this.database.get(uuidValue.selected, 'accounts')).value;

                const response = await fetch(`${azauth}api/apiextender/change-email`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        uuid: account.uuid,
                        new_email: newEmail,
                        code: code
                    })
                });

                if (response.ok) {
                    account.email = newEmail;
                    await this.database.update(account, 'accounts');
                    modal.classList.remove('active');
                    this.resetEmailModal();
                    this.loadCredentials();
                    this.showNotification('Успешно', 'Email успешно изменен', 'success');
                } else {
                    this.showEmailError('Неверный код или ошибка смены email');
                }
            } catch (error) {
                console.error(error);
                this.showEmailError('Ошибка подключения');
            }
        });
    }

    initPasswordModal() {
        const modal = document.getElementById('password-modal');
        const openBtn = document.getElementById('edit-password-btn');
        const closeBtn = document.getElementById('close-password-modal');
        const errorDiv = document.getElementById('password-modal-error');

        openBtn.addEventListener('click', () => {
            modal.classList.add('active');
            errorDiv.classList.add('hidden');
        });

        closeBtn.addEventListener('click', () => {
            modal.classList.remove('active');
            this.resetPasswordModal();
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
                this.resetPasswordModal();
            }
        });

        document.getElementById('change-password-btn').addEventListener('click', async () => {
            const currentPassword = document.getElementById('current-password-input').value;
            const newPassword = document.getElementById('new-password-input').value;
            const confirmPassword = document.getElementById('confirm-password-input').value;

            if (!currentPassword || !newPassword || !confirmPassword) {
                this.showPasswordError('Заполните все поля');
                return;
            }

            if (newPassword !== confirmPassword) {
                this.showPasswordError('Пароли не совпадают');
                return;
            }

            if (newPassword.length < 8) {
                this.showPasswordError('Пароль должен быть не менее 8 символов');
                return;
            }

            try {
                const azauth = this.getAzAuthUrl();
                const uuid = (await this.database.get('1234', 'accounts-selected')).value;
                const account = (await this.database.get(uuid.selected, 'accounts')).value;

                const response = await fetch(`${azauth}api/apiextender/change-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        uuid: account.uuid,
                        current_password: currentPassword,
                        new_password: newPassword
                    })
                });

                if (response.ok) {
                    modal.classList.remove('active');
                    this.resetPasswordModal();
                    this.showNotification('Успешно', 'Пароль успешно изменен', 'success');
                } else {
                    const data = await response.json();
                    this.showPasswordError(data.message || 'Неверный текущий пароль');
                }
            } catch (error) {
                console.error(error);
                this.showPasswordError('Ошибка подключения');
            }
        });
    }

    resetEmailModal() {
        document.getElementById('email-verify-code-1').value = '';
        document.getElementById('new-email-input').value = '';
        document.getElementById('email-verify-code-2').value = '';
        document.getElementById('email-modal-error').classList.add('hidden');
    }

    resetPasswordModal() {
        document.getElementById('current-password-input').value = '';
        document.getElementById('new-password-input').value = '';
        document.getElementById('confirm-password-input').value = '';
        document.getElementById('password-modal-error').classList.add('hidden');
    }

    showEmailError(message, isError = true) {
        const errorDiv = document.getElementById('email-modal-error');
        errorDiv.textContent = message;
        errorDiv.classList.remove('hidden');
        if (!isError) {
            errorDiv.style.background = 'rgba(34, 197, 94, 0.15)';
            errorDiv.style.borderColor = 'rgba(34, 197, 94, 0.3)';
            errorDiv.style.color = '#22c55e';
        } else {
            errorDiv.style.background = 'rgba(239, 68, 68, 0.15)';
            errorDiv.style.borderColor = 'rgba(239, 68, 68, 0.3)';
            errorDiv.style.color = '#ef4444';
        }
    }

    showPasswordError(message) {
        const errorDiv = document.getElementById('password-modal-error');
        errorDiv.textContent = message;
        errorDiv.classList.remove('hidden');
    }

    async loadCredentials() {
        try {
            const azauth = this.getAzAuthUrl();
            console.log('[loadCredentials] AzAuth URL:', azauth);

            const uuid = (await this.database.get('1234', 'accounts-selected')).value;
            console.log('[loadCredentials] Selected UUID:', uuid);

            const account = (await this.database.get(uuid.selected, 'accounts')).value;
            console.log('[loadCredentials] Full account object:', JSON.stringify(account, null, 2));
            console.log('[loadCredentials] Account UUID:', account.uuid);
            console.log('[loadCredentials] Account email:', account.email);

            const url = `${azauth}api/apiextender/account-info`;
            console.log('[loadCredentials] Full URL:', url);
            console.log('[loadCredentials] Request body:', JSON.stringify({ uuid: account.uuid }));

            // Получаем информацию об аккаунте с сервера
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uuid: account.uuid })
            });

            console.log('[loadCredentials] Response status:', response.status);

            if (response.ok) {
                const data = await response.json();
                console.log('[loadCredentials] Response data:', data);

                const emailDisplay = document.getElementById('email-display');
                const currentEmailDisplay = document.getElementById('current-email-display');

                if (emailDisplay && data.user.email) {
                    emailDisplay.value = data.user.email;
                    account.email = data.user.email; // Сохраняем email в локальной базе
                    await this.database.update(account, 'accounts');
                }

                if (currentEmailDisplay && data.user.email) {
                    currentEmailDisplay.value = data.user.email;
                }
            } else {
                console.warn('[loadCredentials] API failed, using local email');
                const errorText = await response.text();
                console.error('[loadCredentials] Error response:', errorText);

                // Fallback: пытаемся использовать email из локальной базы
                const emailDisplay = document.getElementById('email-display');
                const currentEmailDisplay = document.getElementById('current-email-display');

                if (emailDisplay && account.email) {
                    emailDisplay.value = account.email;
                }

                if (currentEmailDisplay && account.email) {
                    currentEmailDisplay.value = account.email;
                }
            }
        } catch (error) {
            console.error('[loadCredentials] Error:', error);
            console.error('[loadCredentials] Error stack:', error.stack);
        }
    }

    async initSettingsDefault() {
        if (!(await this.database.getAll('accounts-selected')).length) {
            this.database.add({ uuid: "1234" }, 'accounts-selected')
        }

        if (!(await this.database.getAll('java-path')).length) {
            this.database.add({ uuid: "1234", path: false }, 'java-path')
        }

        if (!(await this.database.getAll('java-args')).length) {
            this.database.add({ uuid: "1234", args: [] }, 'java-args')
        }

        if (!(await this.database.getAll('launcher')).length) {
            this.database.add({
                uuid: "1234",
                launcher: {
                    close: 'close-launcher'
                }
            }, 'launcher')
        }

        if (!(await this.database.getAll('ram')).length) {
            this.database.add({ uuid: "1234", ramMin: "2", ramMax: "4" }, 'ram')
        }

        if (!(await this.database.getAll('screen')).length) {
            this.database.add({ uuid: "1234", screen: { width: "1280", height: "720" } }, 'screen')
        }
    }

    getAzAuthUrl() {
        const baseUrl = settings_url.endsWith('/') ? settings_url : `${settings_url}/`;
        return pkg.env === 'azuriom'
            ? baseUrl
            : this.config.azauth.endsWith('/')
                ? this.config.azauth
                : `${this.config.azauth}/`;
    }
}
export default Settings;