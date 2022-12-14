import {parse} from 'graphql';

import {
  run,
  createQueryResolver as createQueryResolverForSchema,
} from '@lemonmade/graphql-live';

import type {LocalApp, LocalExtension} from '../../utilities/app';

import type {Schema} from './schema';
import type {Builder} from './types';

export interface Context {
  readonly rootUrl: URL;
}

export {run, parse};

export function createQueryResolver(
  app: LocalApp,
  {builder}: {builder: Builder},
) {
  return createQueryResolverForSchema<Schema, Context>(({object}) => {
    return {
      version: 'unstable',
      api: object('Api', {
        version: 'unstable',
        websocketUrl: (_, {rootUrl}) =>
          new URL('/connect', rootUrl.href.replace(/^http/, 'ws')).href,
      }),
      async *app(_, context, {signal}) {
        yield createGraphQLApp(app, context);

        for await (const currentApp of app.on('change', {signal})) {
          yield createGraphQLApp(currentApp, context);
        }
      },
    };

    function createGraphQLApp(app: Omit<LocalApp, 'on'>, context: Context) {
      return object('App', {
        extensions: app.extensions.map((extension) =>
          createGraphQLCLipsExtension(extension, context),
        ),
        extension({id}) {
          const found = app.extensions.find((extension) => extension.id === id);
          return found && createGraphQLCLipsExtension(found, context);
        },
      });
    }

    function createGraphQLCLipsExtension(
      extension: LocalExtension,
      {rootUrl}: Context,
    ) {
      const assetUrl = new URL(
        `/assets/extensions/${extension.id.split('/').pop()}.js`,
        rootUrl,
      );

      return object('Extension', {
        id: extension.id,
        name: extension.name,
        handle: extension.handle,
        extends: extension.extends.map((extensionPoint) =>
          object('ExtensionPointSupport', {
            target: extensionPoint.target,
            module: extensionPoint.module,
          }),
        ),
        async *build(_, __, {signal}) {
          for await (const state of builder.watch(extension, {signal})) {
            switch (state.status) {
              case 'success': {
                yield object('ExtensionBuildSuccess', {
                  id: `gid://watch/ExtensionBuildSuccess/${extension.handle}/${state.id}`,
                  assets: [object('Asset', {source: assetUrl.href})],
                  startedAt: new Date(state.startedAt).toISOString(),
                  finishedAt: new Date(
                    state.startedAt + state.duration,
                  ).toISOString(),
                  duration: state.duration,
                });
                break;
              }
              case 'error': {
                yield object('ExtensionBuildError', {
                  id: `gid://watch/ExtensionBuildError/${extension.handle}/${state.id}`,
                  startedAt: new Date(state.startedAt).toISOString(),
                  finishedAt: new Date(
                    state.startedAt + state.duration,
                  ).toISOString(),
                  duration: state.duration,
                  error: object('BuildError', {
                    message: state.errors[0]!.message,
                    stack: state.errors[0]!.stack,
                  }),
                });
                break;
              }
              case 'building': {
                yield object('ExtensionBuildInProgress', {
                  id: `gid://watch/ExtensionBuildInProgress/${extension.handle}/${state.id}`,
                  startedAt: new Date(state.startedAt).toISOString(),
                });
                break;
              }
            }
          }
        },
      });
    }
  });
}
