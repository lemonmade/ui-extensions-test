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
    createWorkspacePlugin('UiExtensions.WorkspaceHacks', ({tasks}) => {
      tasks.test.hook(({hooks}) => {
        hooks.configure.hook(({jestFlags}) => {
          // We currently have no tests, this forces Jest to pass anyways
          jestFlags?.hook((flags) => ({
            ...flags,
            passWithNoTests: true,
          }));
        });
      });
    }),
  );
});
