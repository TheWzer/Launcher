/**
 * Game Console Manager
 * Управляет окном консоли загрузки файлов и запуска игры
 */

class GameConsole {
    constructor() {
        this.overlay = null;
        this.downloadSection = null;
        this.consoleOutput = null;
        this.isVisible = false;
        this.downloadFiles = [];
        this.currentPhase = 'download'; // 'download' or 'launch'
    }

    init() {
        this.overlay = document.getElementById('game-console-overlay');
        this.downloadSection = document.getElementById('download-section');
        this.consoleOutput = document.getElementById('console-output');

        const closeBtn = document.getElementById('console-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hide());
        }

        // Закрытие по ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                this.hide();
            }
        });
    }

    show() {
        if (!this.overlay) this.init();
        this.overlay.classList.add('visible');
        this.isVisible = true;
        this.reset();
    }

    hide() {
        if (this.overlay) {
            this.overlay.classList.remove('visible');
            this.isVisible = false;
        }
    }

    reset() {
        this.downloadFiles = [];
        this.currentPhase = 'download';
        this.showDownloadSection();
        this.clearConsole();
        this.updateProgress(0, 'Проверка файлов...', '0 KB/s');
        this.clearFilesList();
    }

    showDownloadSection() {
        if (this.downloadSection) {
            this.downloadSection.classList.add('active');
        }
        if (this.consoleOutput) {
            this.consoleOutput.classList.remove('active');
        }
        this.updateTitle('Загрузка файлов');
    }

    showConsoleSection() {
        if (this.downloadSection) {
            this.downloadSection.classList.remove('active');
        }
        if (this.consoleOutput) {
            this.consoleOutput.classList.add('active');
        }
        this.updateTitle('Запуск игры');
        this.currentPhase = 'launch';
    }

    updateTitle(title) {
        const titleElement = document.querySelector('.console-title');
        if (titleElement) {
            const beforeContent = titleElement.querySelector('::before');
            titleElement.textContent = title;
        }
    }

    // === Download Progress Methods ===

    updateProgress(percent, fileName = null, speed = null) {
        const progressFill = document.getElementById('download-progress-fill');
        const progressText = document.getElementById('download-progress-text');
        const fileNameElement = document.getElementById('current-file-name');
        const speedElement = document.getElementById('download-speed');

        if (progressFill) {
            progressFill.style.width = `${Math.min(100, Math.max(0, percent))}%`;
        }

        if (progressText) {
            progressText.textContent = `${Math.round(percent)}%`;
        }

        if (fileName && fileNameElement) {
            fileNameElement.textContent = fileName;
        }

        if (speed && speedElement) {
            speedElement.textContent = speed;
        }
    }

    addDownloadFile(fileName, status = 'pending') {
        const fileId = `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const file = { id: fileId, name: fileName, status };
        this.downloadFiles.push(file);

        const filesList = document.getElementById('download-files-list');
        if (!filesList) return fileId;

        const fileItem = document.createElement('div');
        fileItem.className = `download-file-item ${status}`;
        fileItem.id = fileId;
        fileItem.innerHTML = `
            <div class="download-file-icon">
                ${this.getStatusIcon(status)}
            </div>
            <div class="download-file-text">${this.truncateFileName(fileName)}</div>
        `;

        filesList.appendChild(fileItem);
        filesList.scrollTop = filesList.scrollHeight;

        return fileId;
    }

    updateDownloadFile(fileId, status) {
        const fileItem = document.getElementById(fileId);
        if (!fileItem) return;

        fileItem.className = `download-file-item ${status}`;
        const icon = fileItem.querySelector('.download-file-icon');
        if (icon) {
            icon.innerHTML = this.getStatusIcon(status);
        }

        const file = this.downloadFiles.find(f => f.id === fileId);
        if (file) {
            file.status = status;
        }
    }

    getStatusIcon(status) {
        switch (status) {
            case 'completed':
                return '✓';
            case 'downloading':
                return '⟳';
            case 'error':
                return '✗';
            default:
                return '○';
        }
    }

    truncateFileName(fileName, maxLength = 60) {
        if (fileName.length <= maxLength) return fileName;
        const ext = fileName.split('.').pop();
        const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
        const truncated = nameWithoutExt.substring(0, maxLength - ext.length - 4) + '...';
        return `${truncated}.${ext}`;
    }

    clearFilesList() {
        const filesList = document.getElementById('download-files-list');
        if (filesList) {
            filesList.innerHTML = '';
        }
        this.downloadFiles = [];
    }

    // === Console Output Methods ===

    addConsoleLine(message, type = 'info') {
        if (!this.consoleOutput) return;

        const line = document.createElement('div');
        line.className = `console-line ${type}`;

        const timestamp = this.getTimestamp();
        const timestampSpan = document.createElement('span');
        timestampSpan.className = 'console-timestamp';
        timestampSpan.textContent = timestamp;

        const messageSpan = document.createElement('span');
        messageSpan.textContent = message;

        line.appendChild(timestampSpan);
        line.appendChild(messageSpan);

        this.consoleOutput.appendChild(line);
        this.consoleOutput.scrollTop = this.consoleOutput.scrollHeight;
    }

    addConsoleLineRaw(message) {
        if (!this.consoleOutput) return;

        const line = document.createElement('div');
        line.className = 'console-line';
        line.textContent = message;

        this.consoleOutput.appendChild(line);
        this.consoleOutput.scrollTop = this.consoleOutput.scrollHeight;
    }

    clearConsole() {
        if (this.consoleOutput) {
            this.consoleOutput.innerHTML = '';
        }
    }

    getTimestamp() {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        return `[${hours}:${minutes}:${seconds}]`;
    }

    // === Utility Methods ===

    formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    formatSpeed(bytesPerSecond) {
        return `${this.formatBytes(bytesPerSecond)}/s`;
    }
}

// Создаем глобальный экземпляр
const gameConsole = new GameConsole();

export default gameConsole;
