import * as vscode from 'vscode';

let exportName: string | null = null;
let prefabsRoot: string | null = null;

/**
 * get `findPrefabs.exportName` setting value，default is `ExportName`
 * @returns
 */
export function getConfigExportName(): string {
    if (exportName === null) {
        exportName = (vscode.workspace.getConfiguration('findPrefabs').exportName as string)?.trim() ?? '';
        console.log(`unity-find-ts-in-prefabs.findPrefabs.exportName = ${ exportName }`);
    }

    return exportName;
}

/**
 * get `findPrefabs.prefabsRoot` setting value，default is ''
 * @returns
 */
export function getConfigPrefabsRoot(): string {
    if (prefabsRoot === null) {
        prefabsRoot = (vscode.workspace.getConfiguration('findPrefabs').prefabsRoot as string)?.trim() ?? '';
        console.log(`unity-find-ts-in-prefabs.findPrefabs.prefabsRoot = ${ prefabsRoot }`);
    }

    return prefabsRoot;
}

/**
 * check the settings is valid
 * @returns
 */
export function checkSettings(): boolean {
    return !!getConfigExportName();
}

/**
 * whether `prefabsRoot` is default
 * @returns
 */
export function prefabsRootIsWorkspace(): boolean {
    return !getConfigPrefabsRoot();
}