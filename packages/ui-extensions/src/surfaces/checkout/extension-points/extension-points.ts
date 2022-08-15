import type {RemoteComponent} from '@remote-ui/core';

import type {RenderExtension} from '../../../extension';

import type {StandardApi} from './api/standard';
import type {CartLineDetailsRenderAfterApi} from './api/cart-line-details';

export interface ExtensionPoints {
  'Checkout::Dynamic::Render': RenderExtension<
    StandardApi<'Checkout::Dynamic::Render'>,
    AnyComponent
  >;
  'Checkout::CartLineDetails::RenderAfter': RenderExtension<
    CartLineDetailsRenderAfterApi,
    AnyComponent
  >;
}

export type ExtensionPoint = keyof ExtensionPoints;

export type ExtensionForExtensionPoint<T extends ExtensionPoint> =
  ExtensionPoints[T];

export type {StandardApi, CartLineDetailsRenderAfterApi};

type ComponentTypes = typeof import('../../../components');

export type Components = {
  [K in keyof ComponentTypes]: ComponentTypes[K] extends RemoteComponent<
    any,
    any
  >
    ? ComponentTypes[K]
    : never;
};

export type AnyComponent = Components[keyof Components];
