import {createWorkspace, createWorkspacePlugin} from '@shopify/loom';
import {buildLibraryWorkspace} from '@shopify/loom-plugin-build-library';
import {eslint} from '@shopify/loom-plugin-eslint';
import {prettier} from '@shopify/loom-plugin-prettier';

import type {} from '@shopify/loom-plugin-jest';

export default createWorkspace((workspace) => {
  workspace.use(
    buildLibraryWorkspace(),
    eslint(),
    prettier({files: '**/*.{md,json,yaml,yml}'}),
    createWorkspacePlugin('UiExtensions.WorkspaceHacks', ({tasks, api}) => {
      tasks.typeCheck.hook(({hooks}) => {
        hooks.pre.hook((steps) => [...steps, createGraphQLTypeScriptStep()]);
      });

      tasks.build.hook(({hooks}) => {
        hooks.pre.hook((steps) => [
          ...steps.map((step) => {
            if (step.id !== 'Typescript') return step;

            return {
              ...step,
              needs: (otherStep) =>
                otherStep.id === 'Quilt.TypeScriptGraphQL' ||
                (step.needs?.(otherStep) ?? false),
            };
          }),
          createGraphQLTypeScriptStep(),
        ]);
      });

      tasks.test.hook(({hooks}) => {
        hooks.configure.hook(({jestFlags}) => {
          // We currently have no tests, this forces Jest to pass anyways
          jestFlags?.hook((flags) => ({
            ...flags,
            passWithNoTests: true,
          }));
        });
      });

      function createGraphQLTypeScriptStep() {
        return api.createStep(
          {
            id: 'Quilt.TypeScriptGraphQL',
            label: 'GraphQL TypeScript definitions',
          },
          async (step) => {
            await step.exec(
              'node',
              [
                '--experimental-vm-modules',
                'node_modules/@quilted/graphql/bin/quilt-graphql-typescript.mjs',
              ],
              {
                stdio: 'inherit',
              },
            );
          },
        );
      }
    }),
  );
});
