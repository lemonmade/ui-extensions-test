import type {Configuration} from '@quilted/graphql/configuration';

const configuration: Configuration = {
  projects: {
    cli: {
      schema: './packages/cli/src/commands/develop/schema.graphql',
      extensions: {
        quilt: {
          schema: [
            {
              kind: 'definitions',
              outputPath: './packages/cli/src/commands/develop/schema.ts',
            },
          ],
        },
      },
    },
  },
};

export default configuration;
