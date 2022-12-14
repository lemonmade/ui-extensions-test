import '@quilted/polyfills/fetch';

import * as path from 'path';
import type {Server} from 'http';
import {stat, readFile} from 'fs/promises';
import {on, createEmitter, NestedAbortController} from '@quilted/events';
import {createThread, acceptThreadAbortSignal} from '@quilted/threads';
import type {ThreadTarget, ThreadAbortSignal} from '@quilted/threads';

import {
  createHttpHandler,
  noContent,
  json,
  notFound,
} from '@quilted/http-handlers';
import {createHttpServer} from '@quilted/http-handlers/node';

import * as WebSocket from 'ws';
import mime from 'mime';
import open from 'open';

import {parse} from 'graphql';

import {watch as rollupWatch} from 'rollup';

import {PrintableError} from '../../ui';
import type {Ui} from '../../ui';

import {
  rootOutputDirectory,
  ensureRootOutputDirectory,
} from '../../utilities/build';

import {loadLocalApp, LocalExtension} from '../../utilities/app';
import type {LocalApp} from '../../utilities/app';

import {findPortAndListen, makeStoppableServer} from '../../utilities/http';
import {createRollupConfiguration} from '../../utilities/rollup';

import {run, createQueryResolver} from './graphql';
import type {Builder, BuildState} from './types';

export async function develop({ui}: {ui: Ui}) {
  const app = await loadLocalApp();

  if (app.extensions.length === 0) {
    ui.Heading('heads up!', {style: (content, style) => style.yellow(content)});
    ui.TextBlock(
      `Your app doesn’t have any extensions to develop yet. Run ${ui.Code(
        'yarn create @shopilemon extension',
      )} to get started!`,
    );

    process.exitCode = 1;

    return;
  }

  await ensureRootOutputDirectory(app);
  const devServer = await createDevServer(app, {ui});

  try {
    const result = await devServer.listen();

    const localUrl = new URL(`http://localhost:${result.port}`);

    const hasMultipleExtensions = app.extensions.length > 1;

    ui.Heading('success!', {style: (content, style) => style.green(content)});
    ui.TextBlock(
      `We’ve started a development server at ${ui.Link(
        localUrl,
      )}. You can press any of the following keys to interact with your ${
        hasMultipleExtensions ? 'extensions' : 'extension'
      }:`,
    );

    ui.List(({Item}) => {
      Item(`${ui.Code('enter')} to open the developer console in your browser`);
      Item(
        `${ui.Code('/')} or ${ui.Code('?')} to open ${
          hasMultipleExtensions ? 'one of your extension’s' : 'your extension'
        } in your browser`,
      );
      Item(`${ui.Code('esc')} to close the development server`);
    });

    ui.Spacer();

    process.stdin.setRawMode(true);

    for await (const data of on(process.stdin, 'data')) {
      switch ((data as Buffer)[0]) {
        case 3:
        case 27: {
          // Ctrl-C and Esc
          process.exit(0);
          return;
        }
        case 26: {
          // Ctrl-Z
          // I thought this would work, but it just hangs forever...
          // process.kill(process.pid, 'SIGSTOP');
          process.exit(0);
          return;
        }
        case 10:
        case 13: {
          // Enter
          open(localUrl.href);
          break;
        }
        // /, ?, F, and f
        case 47:
        case 63:
        case 70:
        case 102: {
          console.log('TODO: jump to extension');
          break;
        }
      }
    }
  } catch (error) {
    throw new PrintableError(
      `There was a problem while running your development server...`,
      {original: error as any},
    );
  }
}

async function createDevServer(app: LocalApp, {ui}: {ui: Ui}) {
  const handler = createHttpHandler();
  const outputRoot = path.resolve(rootOutputDirectory(app), 'develop');

  const builder = await createBuilder(app, {ui, outputRoot});
  const resolver = createQueryResolver(app, {builder});

  handler.get('/', () =>
    json(app, {
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json',
      },
    }),
  );

  handler.options('/graphql', () =>
    noContent({
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    }),
  );

  handler.post('/graphql', async (request) => {
    try {
      const {query, variables} = await request.json();

      const result = await run(query, resolver, {
        variables,
        context: {rootUrl: new URL('/', request.url)},
      }).untilAvailable();

      return json(result, {
        headers: {
          'Timing-Allow-Origin': '*',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    } catch (error) {
      return json(
        {errors: [{message: (error as any).message}]},
        {
          headers: {
            'Timing-Allow-Origin': '*',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        },
      );
    }
  });

  handler.get(
    '/assets',
    async (request) => {
      const assetPath = path.join(
        outputRoot,
        new URL(request.url).pathname.replace('/assets/', ''),
      );

      try {
        const assetStats = await stat(assetPath);

        if (assetStats.isFile()) {
          return new Response(await readFile(assetPath, {encoding: 'utf8'}), {
            headers: {
              'Timing-Allow-Origin': '*',
              'Content-Type': mime.getType(assetPath)!,
            },
          });
        } else {
          return notFound();
        }
      } catch {
        return notFound();
      }
    },
    {exact: false},
  );

  const httpServer = createHttpServer(handler);
  const stopListening = makeStoppableServer(httpServer);
  let webSocketServer: WebSocket.WebSocketServer | undefined;

  return {
    async listen() {
      const port = await findPortAndListen(httpServer);
      webSocketServer = createWebSocketServer(httpServer, {resolver});
      return {port};
    },
    async close() {
      webSocketServer?.close();
      await stopListening();
    },
  };
}

function createWebSocketServer(
  httpServer: Server,
  {resolver}: {resolver: ReturnType<typeof createQueryResolver>},
) {
  const webSocketServer = new WebSocket.WebSocketServer({
    server: httpServer,
    path: '/connect',
  });

  webSocketServer.on('connection', async (socket) => {
    const abort = new AbortController();
    const {signal} = abort;

    const expose = {
      query(
        query: string,
        {
          variables,
          signal: threadSignal,
        }: {
          signal?: ThreadAbortSignal;
          // eslint-disable-next-line @typescript-eslint/consistent-indexed-object-style
          variables?: Record<string, unknown>;
        } = {},
      ) {
        const resolvedSignal = threadSignal
          ? acceptThreadAbortSignal(threadSignal)
          : new NestedAbortController(signal).signal;

        return (async function* () {
          yield* run(parse(query) as any, resolver, {
            variables,
            signal: resolvedSignal,
            // eslint-disable-next-line no-warning-comments
            // TODO: get thr right port, handle proxies, etc
            context: {rootUrl: new URL('http://localhost:3000')},
          });
        })();
      },
    };

    createThread<typeof expose>(threadTargetFromWebSocket(socket), {
      expose,
      signal,
    });

    socket.once('close', () => abort.abort());
  });

  return webSocketServer;
}

async function createBuilder(
  app: LocalApp,
  {ui, outputRoot}: {ui: Ui; outputRoot: string},
): Promise<Builder> {
  const buildStateByExtension = new Map<string, BuildState>();
  const emitter = createEmitter<{
    update: {readonly extension: LocalExtension; readonly state: BuildState};
  }>();

  for (const extension of app.extensions) {
    const baseConfiguration = await createRollupConfiguration(extension, {
      mode: 'development',
    });

    const watcher = rollupWatch({
      ...baseConfiguration,
      output: {
        format: 'iife',
        dir: path.join(outputRoot, 'extensions'),
        entryFileNames: `${extension.id.split('/').pop()}.js`,
      },
    });

    watcher.on('event', (event) => {
      const existingState = buildStateByExtension.get(extension.id);

      switch (event.code) {
        case 'BUNDLE_START': {
          updateBuildState(extension, {
            id: (existingState?.id ?? 0) + 1,
            status: 'building',
            startedAt: Date.now(),
          });

          break;
        }
        case 'BUNDLE_END': {
          const {duration} = event;

          updateBuildState(extension, {
            id: existingState?.id ?? 1,
            status: 'success',
            duration,
            startedAt: existingState?.startedAt ?? Date.now() - duration,
          });

          break;
        }
        case 'ERROR': {
          const startedAt = existingState?.startedAt ?? Date.now();
          const {error} = event;

          updateBuildState(extension, {
            id: existingState?.id ?? 1,
            status: 'error',
            duration: Date.now() - startedAt,
            startedAt,
            errors: [{message: error.message, stack: error.stack}],
          });

          new PrintableError(
            `There was an error while trying to build your extension:`,
            {original: error},
          ).print(ui);

          break;
        }
      }
    });
  }

  return {
    async *watch({id}, {signal} = {}) {
      const initialState = buildStateByExtension.get(id);
      if (initialState) yield initialState;

      if (signal?.aborted) return;

      for await (const {extension, state} of emitter.on('update', {signal})) {
        if (extension.id === id) yield state;
      }
    },
  };

  function updateBuildState(extension: LocalExtension, state: BuildState) {
    buildStateByExtension.set(extension.id, state);
    emitter.emit('update', {extension, state});
  }
}

function threadTargetFromWebSocket(socket: WebSocket.WebSocket): ThreadTarget {
  return {
    send(message) {
      socket.send(JSON.stringify(message));
    },
    async *listen({signal}) {
      const messages = on<{message: {data: WebSocket.Data}}>(
        socket,
        'message',
        {signal},
      );

      for await (const {data} of messages) {
        yield JSON.parse(data.toString());
      }
    },
  };
}
