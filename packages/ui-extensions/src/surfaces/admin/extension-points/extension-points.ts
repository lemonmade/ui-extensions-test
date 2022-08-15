import type {RenderExtension} from '../../../extension';
import type {AnyComponent} from '../components';

import type {StandardApi} from './api/standard';

export type {StandardApi};

export interface ExtensionPoints {
  'Admin::CheckoutEditor::RenderSettings': RenderExtension<
    StandardApi<'Admin::CheckoutEditor::RenderSettings'>,
    AnyComponent
  >;
}

export type ExtensionPoint = keyof ExtensionPoints;

export type ExtensionForExtensionPoint<T extends ExtensionPoint> =
  ExtensionPoints[T];
