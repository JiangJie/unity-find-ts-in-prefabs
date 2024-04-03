import { getConfigExportName } from './settings';

export const COMMAND_ID = 'unity-find-ts-in-prefabs';

export const LANGUAGE_ID = 'typescript';

export const enum FILE_EXT_NAMES {
    TypeScript = '.ts',
    Prefab = '.prefab',
    Scene = '.unity',
}

/**
 * prefab or scene file
 */
export const ALL_PREFABS_PATTERN = '**/*.{prefab,unity}';

/**
 * the regexp of match script guid in prefab file
 */
// export const SCRIPT_EXPORT_NAME_REG = /(?:^|\s*)ExportName\s*:\s*(\w+)\s*(?:\s*|$)/i;
export const SCRIPT_EXPORT_NAME_REG = new RegExp(`(?:^|\\s*)${ getConfigExportName() }\\s*:\\s*(\\w+)\\s*(?:\\s*|$)`, 'i');