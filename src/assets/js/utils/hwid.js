/**
 * HWID - Hardware ID module
 * Собирает информацию о железе и проверяет баны
 */

const si = require('systeminformation');

class HwidManager {
    constructor(apiUrl) {
        this.apiUrl = apiUrl;
        this.hwid = null;
    }

    /**
     * Собрать информацию о железе
     */
    async collect() {
        try {
            const [
                system,
                baseboard,
                cpu,
                graphics,
                mem,
                osInfo,
                battery
            ] = await Promise.all([
                si.system(),
                si.baseboard(),
                si.cpu(),
                si.graphics(),
                si.mem(),
                si.osInfo(),
                si.battery()
            ]);

            // Получаем hwDiskId (серийный номер диска)
            const diskLayout = await si.diskLayout();
            const hwDiskId = diskLayout && diskLayout[0] ? diskLayout[0].serialNum : 'unknown';

            this.hwid = {
                hwDiskId: hwDiskId || 'unknown',
                baseboardSerialNumber: baseboard.serial || 'unknown',
                graphicCard: graphics.controllers && graphics.controllers[0]
                    ? graphics.controllers[0].model
                    : 'unknown',
                displayId: graphics.displays && graphics.displays[0]
                    ? graphics.displays[0].vendor
                    : 'unknown',
                bitness: osInfo.arch === 'x64' ? 64 : 32,
                totalMemory: mem.total,
                logicalProcessors: cpu.cores,
                physicalProcessors: cpu.physicalCores,
                processorMaxFreq: cpu.speed ? cpu.speed * 1000000000 : 0,
                battery: battery.hasBattery ? 1 : 0
            };

            console.log('[HWID] Collected hardware info:', this.hwid);
            return this.hwid;
        } catch (error) {
            console.error('[HWID] Error collecting hardware info:', error);
            throw error;
        }
    }

    /**
     * Проверить HWID на бан
     */
    async check() {
        if (!this.hwid) {
            await this.collect();
        }

        try {
            const baseUrl = this.apiUrl.endsWith('/') ? this.apiUrl : `${this.apiUrl}/`;
            const url = `${baseUrl}api/centralcorp/hwid/check`;

            console.log('[HWID] Checking ban status at:', url);

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    hwDiskId: this.hwid.hwDiskId
                })
            });

            const data = await response.json();
            console.log('[HWID] Check response:', data);

            return data;
        } catch (error) {
            console.error('[HWID] Error checking HWID:', error);
            throw error;
        }
    }

    /**
     * Зарегистрировать HWID на сервере
     */
    async register() {
        if (!this.hwid) {
            await this.collect();
        }

        try {
            const baseUrl = this.apiUrl.endsWith('/') ? this.apiUrl : `${this.apiUrl}/`;
            const url = `${baseUrl}api/centralcorp/hwid/register`;

            console.log('[HWID] Registering at:', url);

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(this.hwid)
            });

            const data = await response.json();
            console.log('[HWID] Register response:', data);

            return data;
        } catch (error) {
            console.error('[HWID] Error registering HWID:', error);
            throw error;
        }
    }

    /**
     * Полная проверка: собрать HWID, проверить бан, зарегистрировать
     * @returns {Promise<{banned: boolean, message: string}>}
     */
    async validate() {
        try {
            // Собираем информацию о железе
            await this.collect();

            // Проверяем на бан
            const checkResult = await this.check();

            if (checkResult.banned) {
                return {
                    banned: true,
                    message: 'Ваше железо заблокировано. Обратитесь к администрации.'
                };
            }

            // Регистрируем/обновляем HWID
            const registerResult = await this.register();

            if (registerResult.banned) {
                return {
                    banned: true,
                    message: 'Ваше железо заблокировано. Обратитесь к администрации.'
                };
            }

            return {
                banned: false,
                message: 'HWID проверен успешно'
            };
        } catch (error) {
            console.error('[HWID] Validation error:', error);
            // В случае ошибки проверки пропускаем (не блокируем игрока)
            return {
                banned: false,
                message: 'Ошибка проверки HWID, пропускаем'
            };
        }
    }
}

module.exports = HwidManager;
