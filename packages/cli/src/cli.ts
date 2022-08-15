import arg from 'arg';
import {bold, magenta, dim} from 'colorette';
import {createUi, PrintableError} from './ui';

const KNOWN_COMMANDS = new Set(['develop', 'build']);

run();

async function run() {
  const args = arg({});

  const {
    _: [command],
  } = args;

  // eslint-disable-next-line no-console
  console.log(`🛍 ${magenta(`shopify-extension ${bold(command!)}`)}`);

  const ui = createUi();

  try {
    if (command == null) {
      throw new PrintableError(
        (ui) =>
          `You must call the CLI with a command (e.g., ${ui.Code(
            'shopify-extensions build',
          )})`,
      );
    }

    switch (command) {
      case 'develop': {
        const {develop} = await import('./commands/develop');
        await develop({ui});
        break;
      }
      case 'build': {
        const {build} = await import('./commands/build');
        await build({ui});
        break;
      }
      default: {
        throw new PrintableError(
          (ui) =>
            `${ui.Code(
              command,
            )} is not a command this app knows how to handle. You can only call one of the following commands: ${[
              ...KNOWN_COMMANDS,
            ]
              .map((command) => ui.Code(command))
              .join(', ')}`,
        );
      }
    }

    // eslint-disable-next-line no-console
    console.log();
  } catch (error) {
    if (error instanceof PrintableError) {
      error.print(ui);
    } else {
      new PrintableError(
        (ui) =>
          `An error happened that we didn’t handle properly. The full content of the error is below, and we’d really appreciate if you could open an issue on ${ui.Link(
            'https://github.com/lemonmade/watch/issues/new',
          )} so we can figure out how to stop this from happening again.`,
      ).print(ui);

      /* eslint-disable no-console */
      console.log();
      console.log(dim((error as any).stack));
      /* eslint-enable no-console */
    }

    process.exitCode = 1;
  }
}
