import {createPackage} from '@shopify/loom';
import {buildLibrary} from '@shopify/loom-plugin-build-library';

export default createPackage((pkg) => {
  pkg.binary({name: 'shopify-extensions', root: './src/cli.ts'});
  pkg.use(
    buildLibrary({
      commonjs: true,
      esmodules: true,
      targets: 'maintained node versions',
    }),
  );
});
