import {createPackage} from '@shopify/loom';
import {buildLibrary} from '@shopify/loom-plugin-build-library';

export default createPackage((pkg) => {
  pkg.entry({root: './src/index.ts'});
  pkg.entry({name: 'admin', root: './src/surfaces/admin/index.ts'});
  pkg.entry({name: 'checkout', root: './src/surfaces/checkout/index.ts'});
  pkg.use(
    buildLibrary({
      commonjs: true,
      esmodules: true,
      esnext: true,
      targets: 'extends @shopify/browserslist-config, maintained node versions',
    }),
  );
});
