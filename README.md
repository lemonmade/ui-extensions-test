# UI Extensions

This repo exports two main packages:

- `@shopilemon/ui-extensions`, found in [./packages/ui-extensions](./packages/ui-extensions). This library exports the “vanilla” JavaScript API that UI extensions can use to embed themselves in Shopify surfaces.
- `@shopilemon/ui-extensions-react`, found in [./packages/ui-extensions-react](./packages/ui-extensions-react). This library provides components and utilities that make it easier to write a UI extension using React.

The APIs for these packages are broken up by the surface that the developer is extending. This repo includes two surfaces:

- [`admin`](./packages/ui-extensions/src/surfaces/admin)
- [`checkout`](./packages/ui-extensions/src/surfaces/checkout)

This surface-based grouping is mostly cosmetic; all extensions use the same underlying technology, and most of the same “core” components (e.g., `Layout`, `BlockStack`, etc) and capabilities (e.g., direct API access, session tokens). Separating APIs by surface makes it easier for a developer to see what is available to them in each context, and gives us a flexible system for introducing components and APIs available in only some surfaces.

An admin extension using “vanilla” JavaScript would be written as follows:

```ts
import {extension, TextField, EditorPanel} from '@shopify/ui-extensions/admin';

export default extension((root) => {
  const panel = root.createComponent(EditorPanel, {settings: {}});

  const textfield = root.createComponent(TextField, {
    label: 'Message to buyers',
    onChange(value) {
      console.log(`Merchant changed message to: ${value}`);
      panel.setProps({settings: {message: value}});
    },
  });

  panel.appendChild(textfield);
  root.appendChild(panel);
});
```

The same developer might build a checkout extension using the React library as follows:

```tsx
import {
  extension,
  Banner,
  useSettings,
} from '@shopify/ui-extensions-react/checkout';

export default extension(() => <Extension />);

export function Extension() {
  const {message} = useSettings();

  if (message == null) return null;

  return <Banner>{message}</Banner>;
}
```
