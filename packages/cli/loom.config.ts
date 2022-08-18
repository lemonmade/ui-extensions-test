import {createPackage} from '@shopify/loom';
import {buildLibrary} from '@shopify/loom-plugin-build-library';

export default createPackage((pkg) => {
  // Instead of using Loom’s built-in support for generating executables, I had to manually
  // write my own (./bin/shopify-extensions.mjs). Some dependencies of this package do not
  // have CommonJS support at all, but Loom does not provide either a way to bundle them,
  // or a way to emit an ESM executable. Adding the entry ensures that all the necessary
  // files are included in the build.
  // pkg.binary({name: 'shopify-extensions', root: './src/cli.ts'});
  pkg.entry({root: './src/cli.ts'});

  pkg.use(
    buildLibrary({
      commonjs: true,
      esmodules: true,
      targets: 'maintained node versions',
    }),
  );
});
