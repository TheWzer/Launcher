/**
 * Модуль для работы с защитой файлов и папок
 * Получает информацию о маркированных файлах и защищенных папках с сервера
 *
 * @author CentralCorp Team
 */

class FileProtection {
    constructor(apiUrl) {
        this.apiUrl = apiUrl;
        this.markedFiles = [];
        this.protectedFolders = [];
        this.serverId = null;
    }

    /**
     * Загрузить информацию о маркированных файлах и защищенных папках для сервера
     * @param {number} serverId - ID сервера
     */
    async load(serverId) {
        this.serverId = serverId;

        try {
            // Загружаем маркированные файлы и папки
            const markersResponse = await fetch(`${this.apiUrl}/api/centralcorp/file-markers/${serverId}`);
            if (markersResponse.ok) {
                const data = await markersResponse.json();
                this.markedFiles = data.marked_files || [];
                console.log(`[FileProtection] Loaded ${this.markedFiles.length} file markers for server ${serverId}`);
            } else {
                console.warn('[FileProtection] Failed to load file markers:', markersResponse.status);
                this.markedFiles = [];
            }

            // Загружаем защищенные папки
            const foldersResponse = await fetch(`${this.apiUrl}/api/centralcorp/protected-folders/${serverId}`);
            if (foldersResponse.ok) {
                const data = await foldersResponse.json();
                this.protectedFolders = data.protected_folders || [];
                console.log(`[FileProtection] Loaded ${this.protectedFolders.length} protected folders for server ${serverId}`);
            } else {
                console.warn('[FileProtection] Failed to load protected folders:', foldersResponse.status);
                this.protectedFolders = [];
            }
        } catch (error) {
            console.error('[FileProtection] Error loading protection data:', error);
            this.markedFiles = [];
            this.protectedFolders = [];
        }
    }

    /**
     * Проверить, является ли файл/папка маркированным
     * @param {string} filePath - относительный путь к файлу/папке
     * @returns {object|null} - объект маркера или null
     */
    getMarker(filePath) {
        const normalizedPath = this.normalizePath(filePath);

        // Сначала ищем точное совпадение
        let marker = this.markedFiles.find(m => this.normalizePath(m.path) === normalizedPath);
        if (marker) return marker;

        // Если не найдено, проверяем папки (файл может быть внутри маркированной папки)
        for (const m of this.markedFiles) {
            if (m.is_folder && this.isPathInFolder(normalizedPath, this.normalizePath(m.path))) {
                return m;
            }
        }

        return null;
    }

    /**
     * Проверить, нужно ли всегда проверять файл/папку
     * @param {string} filePath - относительный путь к файлу/папке
     * @returns {boolean}
     */
    shouldAlwaysVerify(filePath) {
        const marker = this.getMarker(filePath);
        return marker ? marker.always_verify : false;
    }

    /**
     * Проверить, нужно ли всегда перекачивать файл/папку
     * @param {string} filePath - относительный путь к файлу/папке
     * @returns {boolean}
     */
    shouldAlwaysRedownload(filePath) {
        const marker = this.getMarker(filePath);
        return marker ? marker.always_redownload : false;
    }

    /**
     * Проверить, использует ли файл/папка мягкую проверку (не крашить игру при различиях)
     * @param {string} filePath - относительный путь к файлу/папке
     * @returns {boolean}
     */
    shouldSoftVerify(filePath) {
        const marker = this.getMarker(filePath);
        return marker ? marker.soft_verify : false;
    }

    /**
     * Проверить, защищена ли папка от загрузки
     * @param {string} folderPath - относительный путь к папке
     * @returns {boolean}
     */
    isUploadProtected(folderPath) {
        const normalizedPath = this.normalizePath(folderPath);

        for (const folder of this.protectedFolders) {
            const normalizedFolderPath = this.normalizePath(folder.path);
            if (this.isPathInFolder(normalizedPath, normalizedFolderPath) && folder.no_upload) {
                return true;
            }
        }

        return false;
    }

    /**
     * Проверить, защищена ли папка от удаления
     * @param {string} folderPath - относительный путь к папке
     * @returns {boolean}
     */
    isDeleteProtected(folderPath) {
        const normalizedPath = this.normalizePath(folderPath);

        for (const folder of this.protectedFolders) {
            const normalizedFolderPath = this.normalizePath(folder.path);
            if (this.isPathInFolder(normalizedPath, normalizedFolderPath) && folder.no_delete) {
                return true;
            }
        }

        return false;
    }

    /**
     * Проверить, является ли папка только для чтения
     * @param {string} folderPath - относительный путь к папке
     * @returns {boolean}
     */
    isReadOnly(folderPath) {
        const normalizedPath = this.normalizePath(folderPath);

        for (const folder of this.protectedFolders) {
            const normalizedFolderPath = this.normalizePath(folder.path);
            if (this.isPathInFolder(normalizedPath, normalizedFolderPath) && folder.read_only) {
                return true;
            }
        }

        return false;
    }

    /**
     * Получить описание защиты для папки
     * @param {string} folderPath - относительный путь к папке
     * @returns {string|null}
     */
    getProtectionDescription(folderPath) {
        const normalizedPath = this.normalizePath(folderPath);

        for (const folder of this.protectedFolders) {
            const normalizedFolderPath = this.normalizePath(folder.path);
            if (this.isPathInFolder(normalizedPath, normalizedFolderPath)) {
                return folder.description || `Папка защищена: ${folder.protection_type}`;
            }
        }

        return null;
    }

    /**
     * Нормализовать путь (убрать лишние слэши, привести к единому формату)
     * @param {string} path - путь
     * @returns {string}
     */
    normalizePath(path) {
        if (!path) return '';
        return path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').toLowerCase();
    }

    /**
     * Проверить, находится ли путь внутри папки
     * @param {string} path - путь для проверки
     * @param {string} folderPath - путь к папке
     * @returns {boolean}
     */
    isPathInFolder(path, folderPath) {
        if (!path || !folderPath) return false;
        const normalizedPath = this.normalizePath(path);
        const normalizedFolder = this.normalizePath(folderPath);

        return normalizedPath === normalizedFolder ||
               normalizedPath.startsWith(normalizedFolder + '/');
    }

    /**
     * Получить статистику по защите файлов
     * @returns {object}
     */
    getStats() {
        return {
            totalMarkers: this.markedFiles.length,
            folderMarkers: this.markedFiles.filter(m => m.is_folder).length,
            fileMarkers: this.markedFiles.filter(m => !m.is_folder).length,
            alwaysVerify: this.markedFiles.filter(m => m.always_verify).length,
            alwaysRedownload: this.markedFiles.filter(m => m.always_redownload).length,
            softVerify: this.markedFiles.filter(m => m.soft_verify).length,
            protectedFolders: this.protectedFolders.length,
        };
    }
}

// Экспортируем для использования в браузере
window.FileProtection = FileProtection;