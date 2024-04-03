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

    const reader = fs.createReadStream(uri.fsPath);
    const rl = readline.createInterface({
        input: reader,
        // Note: we use the crlfDelay option to recognize all instances of CR LF
        // ('\r\n') in input.txt as a single line break.
        crlfDelay: Infinity,
    });

    for await (const line of rl) {
        const matcher = line.match(SCRIPT_EXPORT_NAME_REG);
        if (matcher) {
            scriptSet.add(matcher[1]);
        }
    }

    rl.close();
    reader.close();

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