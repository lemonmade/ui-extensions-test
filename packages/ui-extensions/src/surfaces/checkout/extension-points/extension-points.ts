import type {RenderExtension} from '../../../extension';
import type {AnyComponent} from '../components';

import type {StandardApi} from './api/standard';
import type {CartLineDetailsRenderAfterApi} from './api/cart-line-details';

export type {StandardApi, CartLineDetailsRenderAfterApi};

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
