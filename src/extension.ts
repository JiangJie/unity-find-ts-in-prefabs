import * as path from 'node:path';
import * as vscode from 'vscode';
import { glob } from 'glob';
import { ALL_PREFABS_PATTERN, COMMAND_ID, LANGUAGE_ID } from './consts';
import { diffWithTwoSets, getFileNameOfScriptFile, getNameOfActiveScriptFile, readAllScriptsFromDocument, uriIsPrefabFile } from './helpers';
import { checkSettings, getConfigPrefabsRoot, prefabsRootIsWorkspace } from './settings';

interface WithFilePathQuickPickItem extends vscode.QuickPickItem {
    filePath: string;
}

const enum IconType {
    explorer = 'explorer-view-icon',
    preview = 'open-preview',
}

// scripts and prefabs are many-to-many relationship

/**
 * one-to-many: cache <script, prefab path set>
 * used for find
 */
const ScriptWithinPrefabs = new Map<string, Set<string>>();

/**
 * one-to-many: cache <prefab path, script set>
 * used for update cache
 */
const PrefabDependOnScripts = new Map<string, Set<string>>();

/**
 * record updated or added prefab files when building cache
 */
const ChangedPrefabFilesWhenBuilding = new Set<vscode.Uri>();

/**
 * record deleted prefab files when building cache
 */
const DeletedPrefabFilesWhenBuilding = new Set<vscode.Uri>();

/**
 * whether cache is building or built
 */
let cacheIsBuilt = false;

function setAsBuildingCache(): void {
    cacheIsBuilt = false;
}

function setAsBuiltCache(): void {
    cacheIsBuilt = true;

    // handle ChangedPrefabFilesWhenBuilding and DeletedPrefabFilesWhenBuilding records
    if (ChangedPrefabFilesWhenBuilding.size > 0) {
        updateCacheWithUris([...ChangedPrefabFilesWhenBuilding]);
        ChangedPrefabFilesWhenBuilding.clear();
    }

    if (DeletedPrefabFilesWhenBuilding.size > 0) {
        for (const uri of DeletedPrefabFilesWhenBuilding) {
            updateCacheWhenDeleteDocument(uri);
        }
        DeletedPrefabFilesWhenBuilding.clear();
    }
}

/**
 * reset status
 */
function reset(): void {
    ScriptWithinPrefabs.clear();
    PrefabDependOnScripts.clear();
    setAsBuildingCache();
}

/**
 * add a prefab file path to ScriptWithinPrefabs
 * @param script script file name
 * @param filePath prefab file path
 */
function addPrefabToScript(script: string, filePath: string): void {
    if (ScriptWithinPrefabs.has(script)) {
        ScriptWithinPrefabs.get(script)!.add(filePath);
    } else {
        ScriptWithinPrefabs.set(script, new Set([filePath]));
    }
}

/**
 * delete a prefab from ScriptWithinPrefabs
 * @param script script file name
 * @param filePath prefab file path
 * @returns
 */
function deletePrefabWithinScript(script: string, filePath: string): void {
    if (!ScriptWithinPrefabs.has(script)) {
        return;
    }

    const prefabs = ScriptWithinPrefabs.get(script)!;
    prefabs.delete(filePath);

    if (prefabs.size === 0) {
        ScriptWithinPrefabs.delete(script);
    }
}

/**
 * read the prefab file then update ScriptWithinPrefabs and PrefabDependOnScripts
 * @param uri prefab file uri
 */
async function readDocumentAndUpdateCache(uri: vscode.Uri) {
    const scriptSet = await readAllScriptsFromDocument(uri);
    const diff = diffWithTwoSets(PrefabDependOnScripts.get(uri.path) ?? new Set<string>(), scriptSet);

    diff.deleted.forEach((script) => {
        deletePrefabWithinScript(script, uri.path);
    });
    diff.added.forEach((script) => {
        addPrefabToScript(script, uri.path);
    });

    if (scriptSet.size > 0) {
        PrefabDependOnScripts.set(uri.path, scriptSet);
    } else {
        PrefabDependOnScripts.delete(uri.path);
    }
}

/**
 * update ScriptWithinPrefabs and PrefabDependOnScripts when delete prefab file
 * @param uri prefab file uri
 * @returns
 */
function updateCacheWhenDeleteDocument(uri: vscode.Uri): void {
    if (!PrefabDependOnScripts.has(uri.path)) {
        return;
    }

    const scriptSet = PrefabDependOnScripts.get(uri.path)!;
    PrefabDependOnScripts.delete(uri.path);

    scriptSet.forEach((script) => {
        deletePrefabWithinScript(script, uri.path);
    });
}

/**
 * update cache with given uri array or all prefabs of workspace
 * @param uris
 * @returns
 */
function updateCacheWithUris(uris: vscode.Uri[] | null = null) {
    return vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Window,
            title: 'Unity: Find TS In Prefabs. Building cache',
            cancellable: true,
        },
        async (progress) => {
            setAsBuildingCache();

            progress.report({ increment: 0 });

            let allUri = uris;
            // search all
            if (allUri == null) {
                const globTimeLabel = 'unity-find-ts-in-prefabs: glob cache';
                console.time(globTimeLabel);

                if (prefabsRootIsWorkspace()) {
                    // use workspace
                    allUri = await vscode.workspace.findFiles(ALL_PREFABS_PATTERN, null)
                } else {
                    allUri = (await glob(ALL_PREFABS_PATTERN, {
                        cwd: getConfigPrefabsRoot(),
                        absolute: true,
                        nodir: true,
                    })).map(x => vscode.Uri.file(x));
                }

                console.timeEnd(globTimeLabel);
            }

            if (allUri) {
                const buildTimeLabel = 'unity-find-ts-in-prefabs: build cache';
                console.time(buildTimeLabel);

                for await (const uri of allUri) {
                    await readDocumentAndUpdateCache(uri);
                }

                console.timeEnd(buildTimeLabel);
            }

            progress.report({ increment: 100 });
            setAsBuiltCache();
        }
    );
}

/**
 * build script and prefab files map cache
 */
async function buildCache() {
    reset();

    await updateCacheWithUris();
    // notify build cache complete
    vscode.window.showInformationMessage('Build cache complete.');
}

/**
 * upgrade cache when prefab file changed or added or deleted
 * @param uri prefab file uri
 * @param isDelete
 * @returns
 */
function upgradeCacheWhenPrefabChange(uri: vscode.Uri, isDelete: boolean): void {
    if (!uriIsPrefabFile(uri)) {
        return;
    }

    // wait for build cache
    if (!cacheIsBuilt) {
        // record
        if (isDelete) {
            DeletedPrefabFilesWhenBuilding.add(uri);
        } else {
            ChangedPrefabFilesWhenBuilding.add(uri);
        }

        return;
    }

    if (isDelete) {
        updateCacheWhenDeleteDocument(uri);
    } else {
        updateCacheWithUris([uri]);
    }
}

/**
 * watch all prefab files change in workspace
 */
function watchAllPrefabFiles(): void {
    if (!prefabsRootIsWorkspace()) {
        return;
    }

    const watcher = vscode.workspace.createFileSystemWatcher(ALL_PREFABS_PATTERN);

    watcher.onDidCreate((uri) => {
        upgradeCacheWhenPrefabChange(uri, false);
    });

    watcher.onDidChange((uri) => {
        upgradeCacheWhenPrefabChange(uri, false);
    });

    watcher.onDidDelete((uri) => {
        upgradeCacheWhenPrefabChange(uri, true);
    });
}

/**
 * create a quick pick view to show results
 * @param script script file name
 */
function showQuickPickByScript(script: string): void {
    const quickPick = vscode.window.createQuickPick<WithFilePathQuickPickItem>();
    let selectedLabel: string | null = null;

    quickPick.items = [...ScriptWithinPrefabs.get(script)!].map((filePath) => {
        const relativePath = vscode.workspace.asRelativePath(filePath);

        let dirname = path.dirname(relativePath);
        if (dirname === '.') {
            dirname = '';
        }

        // filename as label
        // folder as description
        return {
            label: path.basename(relativePath),
            description: dirname,
            buttons: [
                {
                    iconPath: new vscode.ThemeIcon(IconType.explorer),
                    tooltip: 'Reveal In Explorer',
                },
                {
                    iconPath: new vscode.ThemeIcon(IconType.preview),
                    tooltip: 'Open Preview',
                },
            ],
            filePath,
        };
    });

    quickPick.canSelectMany = false;
    quickPick.matchOnDescription = true;
    quickPick.title = `${ getFileNameOfScriptFile() } be dependent by`;
    quickPick.placeholder = 'Select to copy a file name then you can open in Unity.';

    quickPick.onDidHide(() => {
        selectedLabel = null;
        quickPick.dispose();
    });
    quickPick.onDidChangeSelection((items) => {
        selectedLabel = items[0].label;
    });
    quickPick.onDidAccept(() => {
        if (selectedLabel) {
            // copy file name(not include extname) to clipboard
            vscode.env.clipboard.writeText(path.basename(selectedLabel, path.extname(selectedLabel)));
        }

        quickPick.hide();
    });

    quickPick.onDidTriggerItemButton((event) => {
        const iconID = (event.button.iconPath as vscode.ThemeIcon).id;
        const uri = vscode.Uri.file(event.item.filePath);

        if (iconID === IconType.explorer) {
            vscode.commands.executeCommand('revealInExplorer', uri);
        } else if (iconID === IconType.preview) {
            vscode.window.showTextDocument(uri);
        }
    });

    quickPick.show();
}

// this method is called when your extension is activated
export function activate(context: vscode.ExtensionContext): void {
    console.log('Unity: Find TS In Prefabs is now active!');

    if (!checkSettings()) {
        vscode.window.showErrorMessage('Must set the `ExportName` config!');
        return;
    }

    buildCache();
    watchAllPrefabFiles();

    // The command has been defined in the package.json file
    // The commandId parameter must match the command field in package.json
    const disposable = vscode.commands.registerCommand(COMMAND_ID, async () => {
        // The code you place here will be executed every time your command is executed
        const { activeTextEditor } = vscode.window;
        if (!activeTextEditor) return;

        if (activeTextEditor.document.languageId !== LANGUAGE_ID) {
            vscode.window.showErrorMessage('Only support TS file!');
            return;
        }

        if (!cacheIsBuilt) {
            vscode.window.showInformationMessage('Please wait for building cache.');
            return;
        }

        const script = getNameOfActiveScriptFile();
        if (!ScriptWithinPrefabs.has(script)) {
            vscode.window.showInformationMessage('No found prefab files.');
            return;
        }

        // show result in quick pick view
        showQuickPickByScript(script);
    });

    context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate(): void {
    reset();
}
