import * as vscode from 'vscode';

let exportName: string | null = null;

/**
 * get `findPrefabs.exportName` setting value，default is `ExportName`
 * @returns
 */
export function getConfigExportName(): string {
    if (exportName === null) {
        exportName = (vscode.workspace.getConfiguration('findPrefabs').exportName as string)?.trim() ?? '';
    }

    return exportName;
}

/**
 * check the settings is valid
 * @returns
 */
export function checkSettings(): boolean {
    return !!getConfigExportName();
}