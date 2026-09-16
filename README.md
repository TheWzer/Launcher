<p align="center">
  <img src="https://centralcorp.github.io/img/minecraft_title.png" alt="CentralCorp Minecraft Launcher logo" width="760">
</p>

# CentralCorp Launcher

CentralCorp Launcher is a customizable Minecraft launcher designed to work with the self-hosted CentralCorp web panel and the Azuriom ecosystem. It retrieves launcher configuration and game files from the panel, authenticates players through Azuriom, and starts the configured Minecraft version with loaders such as Forge or Fabric.

[![Latest release](https://img.shields.io/github/v/release/CentralCorp/CentralCorp-Launcher?label=release)](https://github.com/CentralCorp/CentralCorp-Launcher/releases/latest)
[![Launcher build](https://github.com/CentralCorp/CentralCorp-Launcher/actions/workflows/ci.yml/badge.svg)](https://github.com/CentralCorp/CentralCorp-Launcher/actions/workflows/ci.yml)
[![License: CC BY-NC 4.0](https://img.shields.io/badge/license-CC%20BY--NC%204.0-3451b2.svg)](LICENSE.md)
[![Documentation](https://img.shields.io/badge/docs-centralcorp.github.io-0ea5e9.svg)](https://centralcorp.github.io/)

**[Documentation](https://centralcorp.github.io/)** · **[Panel](https://github.com/CentralCorp/centralpanel-v2)** · **[Installer](https://github.com/CentralCorp/Installer)** · **[Preview](https://centralcorp.github.io/en/preview)**

![CentralCorp Minecraft Launcher home screen](https://centralcorp.github.io/img/image.png)

## ✨ Features

- Azuriom authentication, including two-factor authentication handling;
- Minecraft server status and player count;
- configurable Minecraft version, game directory and minimum/maximum memory;
- Forge, Fabric, LegacyFabric, NeoForge and Quilt loader values supplied by the panel;
- file verification and synchronization from a self-hosted panel or Azuriom plugin endpoint;
- optional mods that players can enable or disable;
- maintenance mode and access lists based on Azuriom users or roles;
- news feed, alert message, video content and configurable interface color;
- player role, currency and skin display when the required Azuriom data and skin services are configured;
- Discord Rich Presence, Electron release updates and five interface languages.

## 🖼️ Preview

| Account management | Launcher settings |
| --- | --- |
| ![Account management in CentralCorp Minecraft Launcher](https://centralcorp.github.io/img/image2.png) | ![Skin settings in CentralCorp Minecraft Launcher](https://centralcorp.github.io/img/image3.png) |

| Optional mods | Launcher interface |
| --- | --- |
| ![Optional mod selection in CentralCorp Minecraft Launcher](https://centralcorp.github.io/img/image4.png) | ![CentralCorp Minecraft Launcher interface preview](https://centralcorp.github.io/img/image5.png) |

More product views and explanations are available in the [launcher showcase](docs/README.md) and on the [preview page](https://centralcorp.github.io/en/preview).

## Minecraft Launcher

The player application combines the configured Minecraft version, loader, game files and memory settings into a launch profile. Routine server-side changes are retrieved from the panel, while the repository controls the desktop application identity and build configuration.

## 🖥️ Minecraft Launcher Panel

The launcher consumes configuration from either [CentralCorp Panel](https://github.com/CentralCorp/centralpanel-v2) or the CentralCorp Azuriom plugin, according to the `env` value in `package.json`. The web panel manages the Minecraft version, loader, server, files, mods, maintenance, access controls and interface settings without requiring a launcher rebuild for those routine changes.

![CentralCorp Minecraft Launcher Panel configuration dashboard](https://centralcorp.github.io/img/config.png)

Read the [Minecraft Launcher Panel documentation](https://centralcorp.github.io/en/minecraft-launcher-panel) for the complete data flow and hosting requirements.

## Azuriom integration

Player authentication uses the Azuriom authentication API. In standalone panel mode, the panel stores the Azuriom URL and API key and exposes the launcher configuration. In direct Azuriom mode, the launcher reads the CentralCorp plugin endpoints from the configured site.

This launcher targets offline-mode Minecraft server setups connected to Azuriom. Microsoft online-mode servers are not supported.

## ⚙️ Forge and Fabric

The selected Minecraft version and loader are returned by the panel and passed to the launch engine. Forge and Fabric are supported by the current panel configuration, alongside LegacyFabric, NeoForge and Quilt. Test every modpack against its exact Minecraft, loader and mod versions before distribution.

## Optional mods

The panel can describe mods that players may enable or disable before launch. Recommendation labels and mod images are also exposed by the current optional-mod configuration.

## Updates

The launcher checks its configured release repository through the Electron update mechanism. Game files are handled separately: the panel manifest lets the launcher verify and synchronize the files required by the selected configuration.

## Installation

Follow the [CentralCorp installation guide](https://centralcorp.github.io/en/install/prerequis) to prepare the project, install the panel and configure the launcher. For a local launcher checkout:

```bash
npm install
npm run dev
```

## Configuration

The repository-level values in `package.json` define the launcher identity, version, environment, panel or Azuriom URL, and publishing repository. The build script currently reads the existing `preductname` key for the product name; keep that spelling unless the build script and configuration are migrated together.

Panel-managed settings are documented in the [panel configuration guide](https://centralcorp.github.io/en/install/step4).

## Build

Available scripts include:

```bash
npm start
npm run dev
npm run build
```

The GitHub workflow creates a release and builds packages for Windows (`.exe`), Linux (`.AppImage`) and macOS (`.dmg` and `.zip`). Update the launcher version before publishing a release.

## CentralCorp ecosystem

- [Website and documentation](https://github.com/CentralCorp/centralcorp.github.io) — product pages and installation guides
- [CentralCorp Launcher](https://github.com/CentralCorp/CentralCorp-Launcher) — customizable player application
- [CentralCorp Panel](https://github.com/CentralCorp/centralpanel-v2) — self-hosted Minecraft Launcher Panel
- [CentralCorp Installer](https://github.com/CentralCorp/Installer) — hosting checks and panel deployment

## License

CentralCorp Launcher is distributed under [Creative Commons Attribution-NonCommercial 4.0 International](LICENSE.md). Its source code is available, but the non-commercial restriction means the project should not be described as open source in the standard OSI sense. Preserve attribution, identify changes and review the license before commercial use.
