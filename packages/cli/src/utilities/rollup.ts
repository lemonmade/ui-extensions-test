import * as path from 'path';

import type {RollupOptions, Plugin} from 'rollup';
import commonjs from '@rollup/plugin-commonjs';
import nodeResolve from '@rollup/plugin-node-resolve';
import esbuild from 'rollup-plugin-esbuild';

import type {LocalExtension} from './app';

const MAGIC_MODULE_EXTENSION_ENTRY = '__MAGIC__/ClipsExtension.tsx';

export async function createRollupConfiguration(
  extension: LocalExtension,
  {mode = 'production'}: {mode?: 'development' | 'production'} = {},
): Promise<RollupOptions> {
  return {
    input: MAGIC_MODULE_EXTENSION_ENTRY,
    plugins: [
      {
        name: '@quilted/magic-module/extension-entry',
        async resolveId(id) {
          if (id === MAGIC_MODULE_EXTENSION_ENTRY) return id;
          return null;
        },
        async load(source) {
          if (source !== MAGIC_MODULE_EXTENSION_ENTRY) return null;

          this.addWatchFile(extension.configurationFile.path);

          return `
            ${extension.extends
              .map((extensionPoint, index) => {
                return `import extension${index} from ${JSON.stringify(
                  path.resolve(extension.root, extensionPoint.module),
                )}`;
              })
              .join('\n')}

              ${extension.extends
                .map((extensionPoint, index) => {
                  return `shopify.extend(${JSON.stringify(
                    extensionPoint.target,
                  )}, extension${index});`;
                })
                .join('\n')}
          `;
        },
      },
      nodeResolve({
        exportConditions: [
          'quilt:esnext',
          'esnext',
          'import',
          'require',
          'default',
        ],
        extensions: ['.tsx', '.ts', '.esnext', '.mjs', '.js', '.json'],
        preferBuiltins: true,
      }),
      commonjs(),
      esbuild({
        minify: false,
        target: 'es2017',
        jsx: 'automatic',
        define: {'process.env.NODE_ENV': JSON.stringify(mode)},
      }),
      esbuild({
        include: /\.esnext$/,
        exclude: [],
        minify: false,
        target: 'es2017',
        loaders: {'.esnext': 'js'},
        define: {'process.env.NODE_ENV': JSON.stringify(mode)},
      }),
      ...(mode === 'production' ? [minifyChunkWithESBuild()] : []),
    ],
  };
}

// @see https://github.com/egoist/rollup-plugin-esbuild/blob/master/src/index.ts#L170-L195
function minifyChunkWithESBuild(): Plugin {
  return {
    name: '@watching/esbuild-minify',
    async renderChunk(code) {
      const {transform, formatMessages} = await import('esbuild');

      const result = await transform(code, {
        loader: 'js',
        minify: false,
        // target: '',
      });

      if (result.warnings.length > 0) {
        const warnings = await formatMessages(result.warnings, {
          kind: 'warning',
          color: true,
        });

        for (const warning of warnings) {
          this.warn(warning);
        }
      }

      return result.code
        ? {
            code: result.code,
            map: result.map || null,
          }
        : null;
    },
  };
}
