#!/bin/bash

# Скрипт для обхода проблемы SingletonSocket при сборке electron-builder на Linux

# Создаем все возможные директории scoped_dir*
for i in {A..Z}{A..Z}{A..Z}{A..Z}{A..Z}{A..Z}; do
    DIR="/tmp/scoped_dir$i"
    if [ ! -d "$DIR" ]; then
        mkdir -p "$DIR"
        touch "$DIR/SingletonSocket"
        chmod 777 "$DIR/SingletonSocket"
    fi
done

# Также создаем конкретную директорию из ошибки
mkdir -p /tmp/scoped_dirBEeugW
touch /tmp/scoped_dirBEeugW/SingletonSocket
chmod 777 /tmp/scoped_dirBEeugW/SingletonSocket

echo "SingletonSocket fix applied"

# Запускаем сборку
npm run build:win
