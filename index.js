// Enderal Special Edition Plugin for Vortex 2.X

const { fs, log, selectors, util } = require('vortex-api');
const path = require('path');

const GAME_ID = 'enderalspecialedition';
const STEAMAPP_ID = '976620';

const ENDERAL_ESM = 'Enderal - Forgotten Stories.esm';
const SKYUI_ESP = 'SkyUI_SE.esp';


// Must Have Data

const fileChecks = {
    'skse64_loader.exe': {
        relPath: 'skse64_loader.exe',
        url: 'https://skse.silverlock.org/',
        name: 'Skyrim Script Extender 64 (Current SE Build 2.0.19+)',
    },
    'Enderal - Forgotten Stories.esm': {
        relPath: path.join('Data', 'Enderal - Forgotten Stories.esm'),
        url: 'https://www.nexusmods.com/enderalspecialedition/mods/1',
        name: 'Enderal Special Edition',
    },
    'SkyUI_SE.esp': {
        relPath: path.join('Data', 'SkyUI_SE.esp'),
        url: 'https://www.nexusmods.com/skyrimspecialedition/mods/12604',
        name: 'SkyUI Special Edition',
    },
    'JContainers64.dll': {
        relPath: path.join('Data', 'SKSE', 'Plugins', 'JContainers64.dll'),
        url: 'https://www.nexusmods.com/skyrimspecialedition/mods/16495',
        name: 'JContainers64',
    },
};

const tools = [
    {
        id: 'skse64-enderal',
        name: 'Skyrim Script Extender 64',
        shortName: 'SKSE64',
        executable: () => 'skse64_loader.exe',
        requiredFiles: [
            'skse64_loader.exe',
            'SkyrimSE.exe',
        ],
        relative: true,
        exclusive: true,
        defaultPrimary: true,
    },
    {
        id: 'enderal-se-launcher',
        name: 'Launcher',
        executable: () => 'Enderal Launcher.exe',
        requiredFiles: [
            'Enderal Launcher.exe',
        ],
        logo: 'launcher-icon.png',
        relative: true,
        exclusive: true,
    },
];

// Game Directory

function findGame() {
    return util.GameStoreHelper.findByAppId([STEAMAPP_ID])
        .then(game => game.gamePath);
}

// Game Version

function getGameVersion(gamePath /*, exePath */) {
    const exePath = path.join(gamePath, 'SkyrimSE.exe');

    return new Promise((resolve) => {
        try {
            const { execFile } = require('child_process');
            execFile(
                'wmic',
                ['datafile', `where name="${exePath.replace(/\\/g, '\\\\')}"`, 'get', 'Version', '/value'],
                { timeout: 5000 },
                (err, stdout) => {
                    if (err || !stdout) {
                        log('warn', 'Enderal SE: getGameVersion Error', err);
                        return resolve('');
                    }
                    const match = stdout.match(/Version=([\d.]+)/i);
                    resolve(match ? match[1] : '');
                }
            );
        } catch (err) {
            log('warn', 'Enderal SE: getGameVersion Exception', err);
            resolve('');
        }
    });
}


// Missing Dependencies

function missingModsModal(api, missingDependencies, dismiss) {
    api.showDialog('warn', 'Enderal Dependencies Missing', {
        bbcode:
            'Enderal Special Edition requires several mods to be installed before it will work correctly. ' +
            'Vortex detected the following mods as missing:<br /><br />' +
            missingDependencies
                .map(mod => `- [url=${mod.url}]${mod.name}[/url]<br />`)
                .join('<br/>') +
            '<br /><br />You will not be able to start playing Enderal until these mods have been installed.',
    }, [
        {
            label: 'Check again',
            action: () => testMissingMods(api),
        },
        {
            label: 'Close',
            action: () => dismiss(),
        },
    ]);
}

// Plugins activated?

function testMandatoryPlugins(api) {
    const state = api.store.getState();

    if (selectors.activeGameId(state) !== GAME_ID) return Promise.resolve(undefined);

    const pluginInfo = util.getSafe(state, ['session', 'plugins', 'pluginInfo'], {});
    if (!pluginInfo) return Promise.resolve(undefined);

    const enderalMaster = util.getSafe(pluginInfo, [ENDERAL_ESM.toLowerCase()], undefined);
    const skyUIPlugin   = util.getSafe(pluginInfo, [SKYUI_ESP.toLowerCase()], undefined);

    if (enderalMaster && !enderalMaster.enabled) {
        log('info', 'Force-enabling required plugin', ENDERAL_ESM);
        api.store.dispatch({
            type: 'SET_PLUGIN_ENABLED',
            payload: { pluginName: ENDERAL_ESM.toLowerCase(), enabled: true },
        });
    }

    if (skyUIPlugin && !skyUIPlugin.enabled) {
        log('info', 'Force-enabling required plugin', SKYUI_ESP);
        api.store.dispatch({
            type: 'SET_PLUGIN_ENABLED',
            payload: { pluginName: SKYUI_ESP.toLowerCase(), enabled: true },
        });
    }

    return Promise.resolve(undefined);
}

// Test Dependencies

async function testMissingMods(api) {
    api.dismissNotification('enderal-missing-mods');

    const state = api.store.getState();
    if (selectors.activeGameId(state) !== GAME_ID) return;

    const gamePath = util.getSafe(
        state,
        ['settings', 'gameMode', 'discovered', GAME_ID, 'path'],
        undefined
    );
    if (!gamePath) return;

    const missingDependencies = [];

    for (const key of Object.keys(fileChecks)) {
        const check = fileChecks[key];
        const checkPath = path.join(gamePath, check.relPath);
        try {
            await fs.statAsync(checkPath);
        } catch (err) {
            if (err.code === 'ENOENT') {
                log('warn', 'Enderal SE: mandatory file missing ', checkPath);
                missingDependencies.push(check);
            } else {
                log('warn', 'Enderal SE: Error checking dependencies', { err, checkPath });
            }
        }
    }

    if (missingDependencies.length > 0) {
        api.sendNotification({
            id: 'enderal-missing-mods',
            type: 'warning',
            title: 'Dependencies Missing',
            message: 'Enderal SE is not installed correctly.',
            actions: [
                {
                    title: 'More',
                    action: (dismiss) => missingModsModal(api, missingDependencies, dismiss),
                },
            ],
        });
    }
}

// Main Function

function main(context) {
    context.requireVersion('^2.0.0');
    context.requireExtension('gamebryo-plugin-management');
    context.registerGame({
        id: GAME_ID,
        name: 'Enderal Special Edition',
        shortName: 'Enderal SE',
        mergeMods: true,
        queryPath: findGame,
        queryModPath: () => 'data',
        logo: 'gameart.jpg',
        executable: () => 'SkyrimSE.exe',
        getGameVersion,
        requiredFiles: [
            'SkyrimSE.exe',
        ],
        supportedTools: tools,
        environment: {
            SteamAPPId: STEAMAPP_ID,
        },
        details: {
            steamAppId: Number(STEAMAPP_ID),
            supportsSymlinks: false,
            nexusPageId: GAME_ID,
            compatibleDownloads: [
                'skyrimse',
                'skyrimspecialedition',
            ],
        },
    });


    // Registering Plugin-Tests

    context.registerTest('enderal-se-plugins', 'plugins-changed',  () => testMandatoryPlugins(context.api));
    context.registerTest('enderal-se-plugins', 'loot-info-updated', () => testMandatoryPlugins(context.api));

    context.once(() => {
        context.api.onAsync('did-deploy', () => testMissingMods(context.api));
    });

    return true;
}

module.exports = {
    default: main,
};
