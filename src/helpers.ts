import * as fs from 'node:fs';
import * as path from 'node:path';
import * as readline from 'node:readline';
import * as vscode from 'vscode';
import { FILE_EXT_NAMES, SCRIPT_EXPORT_NAME_REG } from './consts';

/**
 * util function to diff two set
 * @param left
 * @param right
 * @returns
 */
export function diffWithTwoSets<T>(left: Set<T>, right: Set<T>) {
    return {
        deleted: [...left].filter((x) => !right.has(x)),
        added: [...right].filter((x) => !left.has(x)),
    };
}

/**
 * whether an uri is a prefab or scene file
 * @param uri
 * @returns
 */
export function uriIsPrefabFile(uri: vscode.Uri): boolean {
    const extname = path.extname(uri.fsPath);
    return extname === FILE_EXT_NAMES.Prefab || extname === FILE_EXT_NAMES.Scene;
}

/**
 * read all script names of given prefab file
 * @param uri
 * @returns
 */
export async function readAllScriptsFromDocument(uri: vscode.Uri): Promise<Set<string>> {
    const scriptSet = new Set<string>();

    const data = await fs.promises.readFile(uri.fsPath, {
        encoding: 'utf8',
    }).catch(err => {
        console.error(err);
    });

    if (data) {
        const matchers = data.matchAll(SCRIPT_EXPORT_NAME_REG);
        if (matchers) {
            for (const matcher of matchers) {
                scriptSet.add(matcher[1]);
            }
        }
    }

    return scriptSet;
}

/**
 * get the TS file's script name
 */
export function getNameOfActiveScriptFile(): string {
    return path.basename(vscode.window.activeTextEditor!.document.uri.fsPath, FILE_EXT_NAMES.TypeScript);
}

/**
 * get the TS file's name
 */
export function getFileNameOfScriptFile(): string {
    return path.basename(vscode.window.activeTextEditor!.document.uri.fsPath);
}