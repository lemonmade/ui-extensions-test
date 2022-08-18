import * as path from 'path';
import {readFile, access} from 'fs/promises';
import {watch} from 'chokidar';
import type {FSWatcher} from 'chokidar';
import {createEmitter} from '@quilted/events';
import type {Emitter} from '@quilted/events';

import glob from 'glob';
import {parse} from '@iarna/toml';

type ExtensionPoint = string;

export interface LocalConfigurationFile<T> {
  readonly path: string;
  readonly value: T;
}

export interface LocalAppConfiguration {
  readonly extensions?: string | readonly string[];
}

export interface LocalApp {
  readonly root: string;
  readonly extensions: readonly LocalExtension[];
  readonly configurationFile?: LocalConfigurationFile<LocalAppConfiguration>;
  readonly on: Emitter<{change: Omit<LocalApp, 'on'>}>['on'];
}

interface LocalExtensionConfigurationTranslatedString {
  readonly translation: string;
}

export type LocalExtensionConfigurationString =
  | string
  | LocalExtensionConfigurationTranslatedString;

interface LocalExtensionUserSettingsStringField {
  type: 'string';
  id: string;
  label: LocalExtensionConfigurationString;
  default?: string;
}

interface LocalExtensionUserSettingsNumberField {
  type: 'number';
  id: string;
  label: LocalExtensionConfigurationString;
  default?: number;
}

interface LocalExtensionUserSettingsOptionsFieldOption {
  readonly value: string;
  readonly label: LocalExtensionConfigurationString;
}

interface LocalExtensionUserSettingsOptionsField {
  type: 'options';
  id: string;
  label: LocalExtensionConfigurationString;
  default?: string;
  options: readonly LocalExtensionUserSettingsOptionsFieldOption[];
}

type LocalExtensionUserSettingsField =
  | LocalExtensionUserSettingsStringField
  | LocalExtensionUserSettingsNumberField
  | LocalExtensionUserSettingsOptionsField;

interface LocalExtensionUserSettings {
  readonly fields: readonly LocalExtensionUserSettingsField[];
}

interface LocalExtensionPointSupportSeriesCondition {
  readonly handle?: string;
}

interface LocalExtensionPointSupportCondition {
  readonly series?: LocalExtensionPointSupportSeriesCondition;
}

interface LocalExtensionPointSupport {
  readonly target: ExtensionPoint;
  readonly module: string;
  readonly conditions?: LocalExtensionPointSupportCondition[];
}

export interface LocalExtensionConfiguration {
  readonly id?: string;
  readonly name: string;
  readonly handle: string;
  readonly extends: readonly LocalExtensionPointSupport[];
  readonly settings?: Partial<LocalExtensionUserSettings>;
}

export interface LocalExtension {
  readonly id: string;
  readonly name: string;
  readonly root: string;
  readonly handle: string;
  readonly extends: readonly LocalExtensionPointSupport[];
  readonly settings: LocalExtensionUserSettings;
  readonly configurationFile: LocalConfigurationFile<LocalExtensionConfiguration>;
}

interface LocalExtensionEntry {
  readonly pattern: string;
  readonly directories: string[];
}

export async function loadLocalApp(): Promise<LocalApp> {
  let currentApp: Omit<LocalApp, 'on'> = await loadAppFromFileSystem();

  let watcher: FSWatcher;
  const emitter = createEmitter<{change: Omit<LocalApp, 'on'>}>();

  return {
    get root() {
      return currentApp.root;
    },
    get extensions() {
      return currentApp.extensions;
    },
    get configurationFile() {
      return currentApp.configurationFile;
    },
    on(...args: any[]) {
      watcher =
        watcher ??
        (() => {
          const fsWatcher = watch(
            [
              ...(currentApp.configurationFile
                ? [currentApp.configurationFile.path]
                : []),
              ...currentApp.extensions.map(
                (extension) => extension.configurationFile.path,
              ),
            ],
            {ignoreInitial: true},
          );

          fsWatcher.on('change', async () => {
            const newApp = await loadAppFromFileSystem();
            currentApp = newApp;
            emitter.emit('change', newApp);
          });

          return fsWatcher;
        })();

      return (emitter as any).on(...args);
    },
  };
}

async function loadAppFromFileSystem(): Promise<Omit<LocalApp, 'on'>> {
  const configurationPath = path.resolve('shopify.app.toml');
  const configuration = await tryLoad<Partial<LocalAppConfiguration>>(
    configurationPath,
  );

  if (configuration != null) {
    validateAppConfig(configuration);
  }

  return {
    root: path.resolve(),
    extensions: await resolveExtensions(
      configuration?.extensions ?? 'extensions/*',
    ),
    configurationFile: configuration
      ? {
          path: configurationPath,
          value: configuration,
        }
      : undefined,
  };
}

async function tryLoad<T>(file: string): Promise<T | undefined> {
  const exists = await access(file)
    .then(() => true)
    .catch(() => false);

  if (!exists) {
    return undefined;
  }

  const result = parse(await readFile(file, {encoding: 'utf8'}));

  return result as any;
}

function validateAppConfig(
  value: Partial<LocalAppConfiguration>,
): asserts value is LocalAppConfiguration {
  return value as any;
}

async function resolveExtensions(
  extensions: LocalAppConfiguration['extensions'],
) {
  if (extensions == null) return [];

  const extensionEntries =
    typeof extensions === 'string'
      ? [loadExtensionEntry(extensions)]
      : extensions.map((extension) => loadExtensionEntry(extension));

  const loadErrors: {directory: string; pattern: string}[] = [];
  const resolvedExtensions: LocalExtension[] = [];

  await Promise.all(
    extensionEntries.map(async ({pattern, directories}) => {
      await Promise.all(
        directories.map(async (directory) => {
          try {
            const resolvedExtension = await loadExtensionFromDirectory(
              directory,
            );

            if (resolvedExtension) {
              resolvedExtensions.push(resolvedExtension);
            }
          } catch (error) {
            loadErrors.push({directory, pattern});
          }
        }),
      );
    }),
  );

  if (loadErrors.length) {
    throw new Error(
      `Failed to load the following extensions from your configuration:\n\n  ${loadErrors
        .map(({directory, pattern}) => `${directory} (pattern: ${pattern})`)
        .join('\n  ')}`,
    );
  }

  return resolvedExtensions;
}

async function loadExtensionFromDirectory(
  directory: string,
): Promise<LocalExtension | undefined> {
  const configurationPath = path.resolve(directory, 'shopify.extension.toml');
  const configuration = await tryLoad<Partial<LocalExtensionConfiguration>>(
    configurationPath,
  );

  if (configuration == null) return undefined;

  validateExtensionConfig(configuration);

  return {
    id:
      configuration.id ??
      `gid://shopify/LocalExtension/${configuration.handle}`,
    name: configuration.name,
    handle: configuration.handle,
    root: directory,
    extends: configuration.extends,
    settings: {fields: [], ...configuration.settings},
    configurationFile: {
      path: configurationPath,
      value: configuration,
    },
  };
}

function validateExtensionConfig(
  value: Partial<LocalExtensionConfiguration>,
): asserts value is LocalExtensionConfiguration {
  if (value.name == null) {
    throw new Error('Extension config missing field `name`');
  }

  if (value.handle == null) {
    throw new Error('Extension config missing field `handle`');
  }

  return value as any;
}

function loadExtensionEntry(pattern: string): LocalExtensionEntry {
  return {
    pattern,
    directories: glob.sync(
      pattern.endsWith(path.sep) ? pattern : `${pattern}${path.sep}`,
      {absolute: true},
    ),
  };
}
