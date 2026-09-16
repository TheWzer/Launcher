/**
 * @author Luuxis
 * Licensed under CC BY-NC 4.0
 * https://creativecommons.org/licenses/by-nc/4.0/
 *
 * Edited by CentralCorp Team
 */
"use strict";

import { logger, database, changePanel, t } from "../utils.js";
import gameConsole from "../utils/gameConsole.js";
const { Launch, Status } = require("minecraft-java-core-azbetter");
const { ipcRenderer, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const launch = new Launch();
const pkg = require("../package.json");
const settings_url = pkg.user ? `${pkg.settings}/${pkg.user}` : pkg.settings;

const dataDirectory =
  process.env.APPDATA ||
  (process.platform == "darwin"
    ? `${process.env.HOME}/Library/Application Support`
    : process.env.HOME);
const MONTHS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

class Home {
  static id = "home";

  async init(config, news) {
    this.database = await new database().init();
    this.config = config;
    this.news = await news;
    this.servers = config.servers || [];
    this.currentServer = null;

    console.log("Servers loaded:", this.servers);

    this.setStaticTexts();
    await this.initServerSelector();
    this.initNews();
    this.initLaunch();
    this.initStatusServer();
    this.initBtn();
    this.initAdvert();
    this.verifyModsBeforeLaunch();
    this.initSidebarToggle();
    await this.updatePlayerInfo();
  }

  setStaticTexts() {
    // Статичні тексти видалено, оскільки відео блок більше не використовується
  }

  async initServerSelector() {
    const serversList = document.getElementById("servers-list");
    console.log("initServerSelector called");
    console.log("Servers list element:", serversList);
    console.log("Available servers:", this.servers);

    if (!serversList) {
      console.error("Servers list element not found!");
      return;
    }

    if (!this.servers || this.servers.length === 0) {
      console.warn("No servers available");
      serversList.innerHTML = '<div class="no-servers">Нет доступных серверов</div>';
      return;
    }

    // Получаем текущий выбранный сервер из БД или используем сервер по умолчанию
    const savedServer = await this.database.get("1234", "server-selected");
    let selectedServerId = savedServer?.value?.serverId;
    console.log("Saved server ID:", selectedServerId);

    // Если нет сохраненного сервера, ищем сервер по умолчанию
    if (!selectedServerId && this.servers.length > 0) {
      const defaultServer = this.servers.find(s => s.is_default);
      selectedServerId = defaultServer ? defaultServer.id : this.servers[0].id;
      console.log("Using default/first server:", selectedServerId);
    }

    // Создаем карточки серверов
    serversList.innerHTML = '';
    this.servers.forEach(server => {
      const serverCard = this.createServerCard(server, server.id === selectedServerId);
      serversList.appendChild(serverCard);
    });
    console.log("Server cards created:", this.servers.length);

    // Проверяем статус всех серверов ПОСЛЕ добавления в DOM
    this.servers.forEach(server => {
      this.checkServerStatus(server);
    });

    // Устанавливаем текущий сервер
    this.currentServer = this.servers.find(s => s.id === selectedServerId);
    if (this.currentServer) {
      console.log("Current server set to:", this.currentServer.name);
      this.config.status = {
        nameServer: this.currentServer.name,
        ip: this.currentServer.ip,
        port: this.currentServer.port
      };
      this.config.server_icon = this.currentServer.icon;

      // Применяем версию игры и лоадер выбранного сервера
      this.config.game_version = this.currentServer.game_version || this.config.game_version;
      this.config.loader = {
        type: this.currentServer.loader_type || this.config.loader.type,
        build: this.currentServer.loader_build || this.config.loader.build,
        enable: this.currentServer.loader_enable !== undefined ? this.currentServer.loader_enable : this.config.loader.enable
      };

      console.log("Using game version:", this.config.game_version);
      console.log("Using loader:", this.config.loader);
    }
  }

  createServerCard(server, isSelected) {
    const card = document.createElement("div");
    card.classList.add("server-card");
    if (isSelected) card.classList.add("selected");
    card.dataset.serverId = server.id;

    card.innerHTML = `
      <div class="online off server-indicator" data-server-id="${server.id}"></div>
      ${server.icon ? `<img class="server-img" src="${server.icon}" />` : '<div class="server-img-placeholder"></div>'}
      <div class="server-text">
        <div class="name">${server.name}</div>
      </div>
      <button class="play-server-btn" data-server-id="${server.id}">ИГРАТЬ</button>
    `;

    // Обробник кліку на кнопку "Играть"
    const playBtn = card.querySelector(".play-server-btn");
    playBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      await this.selectServerCard(server.id);
      // Симулюємо клік на головну кнопку "Играть"
      document.getElementById("play-btn").click();
    });

    // Обробник кліку на картку (тільки вибір, без запуску)
    card.addEventListener("click", async () => {
      await this.selectServerCard(server.id);
    });

    return card;
  }

  async selectServerCard(serverId) {
    // Убираем выделение со всех карточек
    document.querySelectorAll(".server-card").forEach(card => {
      card.classList.remove("selected");
    });

    // Выделяем выбранную карточку
    const selectedCard = document.querySelector(`[data-server-id="${serverId}"]`).closest(".server-card");
    if (selectedCard) {
      selectedCard.classList.add("selected");
    }

    // Меняем сервер
    await this.changeServer(serverId);
  }

  async checkServerStatus(server) {
    const indicatorEl = document.querySelector(`.server-indicator[data-server-id="${server.id}"]`);

    if (!indicatorEl) {
      console.error("Server status elements not found for server:", server.id);
      return;
    }

    const address = server.port ? `${server.ip}:${server.port}` : server.ip;
    console.log(`Checking status for ${server.name} (${address})...`);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(
        `https://api.mcsrvstat.us/3/${encodeURIComponent(address)}`,
        { signal: controller.signal }
      );

      clearTimeout(timeout);

      if (!response.ok) {
        console.log(`Server ${server.name} API response not OK:`, response.status);
        this.setServerOffline(indicatorEl, server);
        return;
      }

      const data = await response.json();
      console.log(`Server ${server.name} API response:`, data);

      if (data.online) {
        indicatorEl.classList.remove("off");

        const onlinePlayers = data.players?.online ?? 0;
        // Зберігаємо онлайн у серверах
        server.onlinePlayers = onlinePlayers;
      } else {
        this.setServerOffline(indicatorEl, server);
      }

      // Оновлюємо загальний онлайн
      this.updateTotalOnline();
    } catch (e) {
      console.error(`Error checking server ${server.name}:`, e);
      this.setServerOffline(indicatorEl, server);
      this.updateTotalOnline();
    }
  }

  setServerOffline(indicatorEl, server) {
    indicatorEl.classList.add("off");
    server.onlinePlayers = 0;
  }

  updateTotalOnline() {
    const totalOnline = this.servers.reduce((sum, server) => {
      return sum + (server.onlinePlayers || 0);
    }, 0);

    const onlineNumbersEl = document.querySelector('.online-numbers');
    if (onlineNumbersEl) {
      onlineNumbersEl.textContent = totalOnline;
    }
  }

  async changeServer(serverId) {
    const server = this.servers.find(s => s.id === serverId);
    if (!server) return;

    this.currentServer = server;

    // Обновляем конфигурацию
    this.config.status = {
      nameServer: server.name,
      ip: server.ip,
      port: server.port
    };
    this.config.server_icon = server.icon;

    // Обновляем версию игры и лоадер для выбранного сервера
    this.config.game_version = server.game_version || this.config.game_version;
    this.config.loader = {
      type: server.loader_type || this.config.loader.type,
      build: server.loader_build || this.config.loader.build,
      enable: server.loader_enable !== undefined ? server.loader_enable : this.config.loader.enable
    };

    console.log("Server changed:", server.name);
    console.log("New game version:", this.config.game_version);
    console.log("New loader:", this.config.loader);

    // Сохраняем выбор в БД
    await this.database.update(
      { uuid: "1234", serverId: server.id },
      "server-selected"
    );
  }

  async initNews() {
    const newsContainer = document.querySelector(".news-list");
    if (this.news) {
      if (!this.news.length) {
        this.createNewsBlock(
          newsContainer,
          t("no_news_available"),
          t("news_follow_here"),
        );
      } else {
        for (const newsItem of this.news) {
          const date = await this.getDate(newsItem.publish_date);
          this.createNewsBlock(
            newsContainer,
            newsItem.title,
            newsItem.content,
            newsItem.author,
            date,
            newsItem.image,
          );
        }
      }
    } else {
      this.createNewsBlock(
        newsContainer,
        t("error_contacting_server"),
        t("error_contacting_server"),
      );
    }
  }

  createNewsBlock(
    container,
    title,
    content,
    author = "",
    date = {},
    image = null,
    likes = 0,
  ) {
    const blockNews = document.createElement("div");
    blockNews.classList.add("news-block", "opacity-1");

    // Встановлюємо фон картинки
    if (image) {
      blockNews.style.backgroundImage = `url('${image}')`;
    }

    // Видаляємо HTML теги з контенту
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;
    let textContent = tempDiv.textContent || tempDiv.innerText || '';

    // Обрізаємо текст до максимальної кількості символів для 2 рядків
    // При розмірі шрифта 20px та середній ширині символів, обрізаємо до 35 символів
    const maxLength = 35;
    if (textContent.length > maxLength) {
      textContent = textContent.substring(0, 32).trim() + '...';
    }

    // Форматуємо дату
    const dateString = date.day ? `${date.day} ${date.month}` : '';

    blockNews.innerHTML = `
      <div class="news-header">
        <div class="header-text">
          <div class="title">${title}</div>
        </div>
      </div>
      <div class="news-content">
        ${dateString ? `<div class="news-date">${dateString}</div>` : ''}
        <div class="news-text">${textContent}</div>
        <div class="news-likes">
          <i class="fas fa-heart"></i>
          <span>${likes || 0}</span>
        </div>
      </div>
    `;

    container.appendChild(blockNews);
  }

  async initLaunch() {
    document.querySelector(".play-btn").addEventListener("click", async () => {
      await this.verifyModsBeforeLaunch();
      const opts = await this.getLaunchOptions();
      const playBtn = document.querySelector(".play-btn");
      const info = document.querySelector(".text-download");
      const progressBar = document.querySelector(".progress-bar");

      // Показываем консоль игры
      gameConsole.show();

      playBtn.style.display = "none";
      info.style.display = "block";

      launch.Launch(opts);

      const launcherSettings = (await this.database.get("1234", "launcher"))
        .value;
      this.setupLaunchListeners(
        launch,
        info,
        progressBar,
        playBtn,
        launcherSettings,
      );
    });
  }

  async getLaunchOptions() {
    const urlpkg = this.getBaseUrl();
    const uuid = (await this.database.get("1234", "accounts-selected")).value;
    const account = (await this.database.get(uuid.selected, "accounts")).value;
    const ram = (await this.database.get("1234", "ram")).value;
    const javaPath = (await this.database.get("1234", "java-path")).value;
    const javaArgs = (await this.database.get("1234", "java-args")).value;
    const resolution = (await this.database.get("1234", "screen")).value;
    const launcherSettings = (await this.database.get("1234", "launcher"))
      .value;

    const screen =
      resolution.screen.width === "<auto>"
        ? false
        : { width: resolution.screen.width, height: resolution.screen.height };

    // Добавляем ID сервера к пути для разделения данных каждого сервера
    const serverPath = this.currentServer ? `server-${this.currentServer.id}` : 'default';
    const gameDirectory = `${dataDirectory}/${process.platform == "darwin" ? this.config.dataDirectory : `.${this.config.dataDirectory}`}`;
    const serverGamePath = `${gameDirectory}/${serverPath}`;

    // Используем сохраненный путь Java из БД или null для автозагрузки Java 17
    console.log("Java path from DB:", javaPath);
    let javaConfig = {
      path: javaPath?.path || null,
      version: "17",
      type: 'jre'
    };
    console.log("Java config:", javaConfig);

    // Формируем правильный формат build для Forge: {minecraft_version}-{forge_build}
    let loaderBuild = this.config.loader.build;
    if (this.config.loader.type === 'forge' && loaderBuild && !loaderBuild.includes('-')) {
      // Если build не содержит дефис, значит это просто номер версии без префикса minecraft версии
      loaderBuild = `${this.config.game_version}-${loaderBuild}`;
    }
    console.log("Loader build resolved:", loaderBuild);

    // Путь к authlib-injector.jar в корне директории клиента сервера
    const authlibPath = path.join(serverGamePath, 'authlib-injector.jar');
    // Нормализуем путь для Windows - заменяем обратные слэши на прямые для JVM
    const authlibPathNormalized = authlibPath.replace(/\\/g, '/');
    const authlibUrl = 'https://lumine.li/api/apiextender/authlib';
    const authlibDownloadUrl = 'https://github.com/yushijinhun/authlib-injector/releases/download/v1.2.5/authlib-injector-1.2.5.jar';

    // Скачиваем authlib-injector.jar если его нет
    if (!fs.existsSync(authlibPath)) {
      console.log('Downloading authlib-injector.jar...');
      try {
        const https = require('https');
        const file = fs.createWriteStream(authlibPath);

        await new Promise((resolve, reject) => {
          https.get(authlibDownloadUrl, (response) => {
            response.pipe(file);
            file.on('finish', () => {
              file.close();
              console.log('authlib-injector.jar downloaded successfully');
              resolve();
            });
          }).on('error', (err) => {
            fs.unlink(authlibPath, () => {});
            console.error('Error downloading authlib-injector:', err);
            reject(err);
          });
        });
      } catch (err) {
        console.error('Failed to download authlib-injector.jar:', err);
      }
    } else {
      console.log('authlib-injector.jar already exists');
    }

    // JVM аргументы для Authlib Injector
    const jvmArgs = [];

    // Добавляем authlib-injector только если файл существует
    if (fs.existsSync(authlibPath)) {
      jvmArgs.push(
        `-javaagent:${authlibPathNormalized}=${authlibUrl}`,
        '-Dauthlibinjector.side=client',
        '-Dauthlibinjector.mojang.strict=false'
      );
      console.log('Authlib Injector enabled:', authlibPathNormalized);
    } else {
      console.warn('authlib-injector.jar not found, skipping Authlib Injector integration');
    }

    // Добавляем пользовательские JVM аргументы если они есть
    if (javaArgs && javaArgs.args && javaArgs.args.length > 0) {
      jvmArgs.push(...javaArgs.args);
    }

    return {
      url: urlpkg,
      authenticator: account,
      timeout: 10000,
      path: serverGamePath,
      version: this.config.game_version,
      detached: launcherSettings.launcher.close === "close-all" ? false : true,
      downloadFileMultiple: 30,
      loader: {
        type: this.config.loader.type,
        build: loaderBuild,
        enable: this.config.loader.enable,
      },
      verify: this.config.verify,
      ignored: [
        ...(Array.isArray(this.config.ignored)
          ? this.config.ignored
          : Object.values(this.config.ignored)),
        "launcher_config",
      ],
      intelEnabledMac:
        process.platform === "darwin" && process.arch === "arm64",
      downloadFileMultiple: 30,
      JVM_ARGS: jvmArgs,
      GAME_ARGS: [],
      java: javaConfig,
      memory: {
        min: `${ram.ramMin * 1024}M`,
        max: `${ram.ramMax * 1024}M`,
      },
    };
  }

  getBaseUrl() {
    const baseUrl = settings_url.endsWith("/")
      ? settings_url
      : `${settings_url}/`;

    if (pkg.env === "azuriom") {
      const filesUrl = `${baseUrl}api/centralcorp/files`;
      // Добавляем server_id если выбран сервер
      return this.currentServer
        ? `${filesUrl}?server_id=${this.currentServer.id}`
        : filesUrl;
    }

    return `${baseUrl}data/`;
  }

  setupLaunchListeners(launch, info, progressBar, playBtn, launcherSettings) {
    let currentDownloadFile = null;
    let lastSpeed = 0;
    let gameStarted = false;

    launch.on("extract", (extract) => {
      console.log(extract);
      gameConsole.addConsoleLine(`Распаковка: ${extract}`, 'info');
    });

    launch.on("progress", (progress, size) => {
      this.updateProgressBar(progressBar, info, progress, size, t("download"));

      const percent = (progress / size) * 100;
      const speed = gameConsole.formatSpeed(lastSpeed);
      gameConsole.updateProgress(percent, t("download"), speed);

      if (currentDownloadFile) {
        gameConsole.updateDownloadFile(currentDownloadFile, 'downloading');
      }
    });

    launch.on("check", (progress, size) => {
      this.updateProgressBar(progressBar, info, progress, size, t("verification"));

      const percent = (progress / size) * 100;
      gameConsole.updateProgress(percent, t("verification"), '—');
    });

    launch.on("estimated", (time) => {
      console.log(this.formatTime(time));
      gameConsole.addConsoleLine(`Осталось времени: ${this.formatTime(time)}`, 'info');
    });

    launch.on("speed", (speed) => {
      lastSpeed = speed;
      const speedMb = (speed / 1067008).toFixed(2);
      console.log(`${speedMb} Mb/s`);
    });

    launch.on("patch", (patch) => {
      info.innerHTML = t("patch_in_progress");
      gameConsole.addConsoleLine('Применение патчей...', 'info');
    });

    launch.on("download", (fileName) => {
      if (currentDownloadFile) {
        gameConsole.updateDownloadFile(currentDownloadFile, 'completed');
      }
      currentDownloadFile = gameConsole.addDownloadFile(fileName, 'downloading');
    });

    launch.on("data", (e) => {
      // Переключаемся на консоль только один раз при первом выводе игры
      if (!gameStarted) {
        gameStarted = true;
        if (currentDownloadFile) {
          gameConsole.updateDownloadFile(currentDownloadFile, 'completed');
        }
        gameConsole.showConsoleSection();
        gameConsole.addConsoleLine('Запуск Minecraft...', 'success');
      }

      this.handleLaunchData(e, info, progressBar, playBtn, launcherSettings);
    });

    launch.on("close", (code) => {
      this.handleLaunchClose(code, info, progressBar, playBtn, launcherSettings);
      gameConsole.addConsoleLine(`Игра завершена с кодом: ${code}`, code === 0 ? 'success' : 'warn');

      // Автоматически скрываем консоль через 3 секунды после успешного завершения
      if (code === 0) {
        setTimeout(() => gameConsole.hide(), 3000);
      }
    });

    launch.on("error", (err) => {
      console.log(err);
      gameConsole.addConsoleLine(`Ошибка: ${err}`, 'error');
    });
  }

  updateProgressBar(progressBar, info, progress, size, text) {
    progressBar.style.display = "block";
    info.innerHTML = `${text} ${((progress / size) * 100).toFixed(0)}%`;
    ipcRenderer.send("main-window-progress", { progress, size });
    progressBar.value = progress;
    progressBar.max = size;
  }

  formatTime(time) {
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time - hours * 3600) / 60);
    const seconds = Math.floor(time - hours * 3600 - minutes * 60);
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  handleLaunchData(e, info, progressBar, playBtn, launcherSettings) {
    new logger("Minecraft", "#36b030");
    if (launcherSettings.launcher.close === "close-launcher")
      ipcRenderer.send("main-window-hide");
    ipcRenderer.send("main-window-progress-reset");
    progressBar.style.display = "none";
    info.innerHTML = t("starting");
    console.log(e);

    // Логирование вывода игры в консоль
    if (e && typeof e === 'string') {
      const line = e.trim();
      if (line) {
        let type = 'info';
        if (line.includes('ERROR') || line.includes('Error')) type = 'error';
        else if (line.includes('WARN') || line.includes('Warning')) type = 'warn';
        else if (line.includes('INFO')) type = 'info';
        else if (line.includes('DEBUG')) type = 'debug';

        gameConsole.addConsoleLineRaw(line);
      }
    }
  }

  handleLaunchClose(code, info, progressBar, playBtn, launcherSettings) {
    if (launcherSettings.launcher.close === "close-launcher")
      ipcRenderer.send("main-window-show");
    progressBar.style.display = "none";
    info.style.display = "none";
    playBtn.style.display = "block";
    info.innerHTML = t("verification");
    new logger("Launcher", "#7289da");
    console.log("Close");
  }

  async initStatusServer() {
    // Статус серверов теперь отображается в карточках
    // Метод оставлен для совместимости, но логика перенесена в checkServerStatus
    console.log("Server status check initialized via card system");
  }

  async initAdvert() {
    const advertBanner = document.querySelector(".advert-banner");
    if (this.config.alert_activate) {
      const message = this.config.alert_msg;
      const firstParagraph = message.split("</p>")[0] + "</p>";
      const scrollingText = document.createElement("div");
      scrollingText.classList.add("scrolling-text");
      scrollingText.innerHTML = `${firstParagraph}`;
      advertBanner.innerHTML = "";
      advertBanner.appendChild(scrollingText);
      scrollingText.classList.toggle("no-scroll", !this.config.alert_scroll);
      advertBanner.style.display = "block";
    } else {
      advertBanner.style.display = "none";
    }
  }

  initBtn() {
    document.querySelector(".settings-btn").addEventListener("click", () => {
      changePanel("settings");
    });

    // Обробники для навігаційних кнопок
    const baseUrl = settings_url.endsWith('/') ? settings_url : `${settings_url}/`;

    document.getElementById("news-btn")?.addEventListener("click", () => {
      shell.openExternal(`${baseUrl}news`);
    });

    document.getElementById("forum-btn")?.addEventListener("click", () => {
      shell.openExternal(`${baseUrl}forum`);
    });

    document.getElementById("telegram-btn")?.addEventListener("click", () => {
      shell.openExternal(`https://t.me/lumine_li`);
    });

    document.getElementById("shop-btn")?.addEventListener("click", () => {
      shell.openExternal(`${baseUrl}shop`);
    });

    document.getElementById("wiki-btn")?.addEventListener("click", () => {
      shell.openExternal(`${baseUrl}wiki`);
    });
  }

  async getDate(e) {
    const date = new Date(e);
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    const months = [
      t("january"),
      t("february"),
      t("march"),
      t("april"),
      t("may"),
      t("june"),
      t("july"),
      t("august"),
      t("september"),
      t("october"),
      t("november"),
      t("december"),
    ];
    return { year, month: months[month], day };
  }

  async verifyModsBeforeLaunch() {
    const modsDir = path.join(
      dataDirectory,
      process.platform == "darwin"
        ? this.config.dataDirectory
        : `.${this.config.dataDirectory}`,
      "mods",
    );
    const launcherConfigDir = path.join(
      dataDirectory,
      process.platform == "darwin"
        ? this.config.dataDirectory
        : `.${this.config.dataDirectory}`,
      "launcher_config",
    );
    const modsConfigFile = path.join(launcherConfigDir, "mods_config.json");

    if (!fs.existsSync(modsDir) || !fs.existsSync(modsConfigFile)) {
      console.log(
        "Mods directory or config not found, skipping mod verification (first launch).",
      );
      return;
    }

    let modsConfig;
    try {
      modsConfig = JSON.parse(fs.readFileSync(modsConfigFile));
    } catch (error) {
      console.error("Failed to read mods config file:", error);
      return;
    }

    for (const mod in modsConfig) {
      const modFiles = fs
        .readdirSync(modsDir)
        .filter(
          (file) =>
            file.startsWith(mod) &&
            (file.endsWith(".jar") || file.endsWith(".jar-disable")),
        );
      if (modFiles.length > 0) {
        const modFile = modFiles[0];
        const modFilePath = path.join(modsDir, modFile);
        const newModFilePath = modsConfig[mod]
          ? modFilePath.replace(".jar-disable", ".jar")
          : modFilePath.endsWith(".jar-disable")
            ? modFilePath
            : `${modFilePath}.disable`;
        if (modFilePath !== newModFilePath) {
          fs.renameSync(modFilePath, newModFilePath);
        }
      }
    }
  }

  displayEmptyModsMessage(modsListElement) {
    const modElement = document.createElement("div");
    modElement.innerHTML = `
            <div class="mods-container-empty">
              <h2>${t("optional_mods_not_downloaded")}</h2>
            </div>`;
    modsListElement.appendChild(modElement);
  }

  updateRole(account) {
    const playerName = document.querySelector(".player-name");
    const playerRoleText = document.querySelector(".player-role-text");

    // Оновлюємо нікнейм
    if (playerName) {
      playerName.textContent = account.name;
    }

    // Оновлюємо роль
    if (account.user_info && account.user_info.role) {
      const roleName = account.user_info.role.name;

      if (playerRoleText) {
        playerRoleText.textContent = roleName;
        playerRoleText.style.display = "";
      }
    } else {
      if (playerRoleText) {
        playerRoleText.style.display = "none";
      }
    }
  }

  updateWhitelist(account) {
    const playBtn = document.querySelector(".play-btn");
    if (
      this.config.whitelist_activate &&
      !this.config.whitelist.includes(account.name) &&
      !this.config.whitelist_roles.includes(account.user_info.role.name)
    ) {
      playBtn.style.background = "#696969";
      playBtn.style.pointerEvents = "none";
      playBtn.style.boxShadow = "none";
      playBtn.style.opacity = "0.6";
    } else {
      playBtn.style.background = "";
      playBtn.style.pointerEvents = "auto";
      playBtn.style.boxShadow = "";
      playBtn.style.opacity = "1";
    }
  }

  async updatePlayerInfo() {
    try {
      const uuid = await this.database.get('1234', 'accounts-selected');
      if (!uuid?.value?.selected) return;

      const account = await this.database.get(uuid.value.selected, 'accounts');
      if (!account?.value) return;

      this.updateRole(account.value);
    } catch (error) {
      console.error('Error updating player info:', error);
    }
  }

  initSidebarToggle() {
    const sidebar = document.querySelector('.sidebar');
    const toggleBtn = document.querySelector('.sidebar-toggle');
    const logoImg = document.querySelector('.sidebar-top img');

    if (!sidebar || !toggleBtn) return;

    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');

      // Зміна логотипу при згортанні
      if (sidebar.classList.contains('collapsed')) {
        logoImg.src = 'assets/images/center-logo.png';
      } else {
        logoImg.src = 'assets/images/logo.png';
      }
    });
  }
}

export default Home;
