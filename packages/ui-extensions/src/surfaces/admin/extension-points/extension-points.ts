import type {RemoteComponentType} from '@remote-ui/core';

import type {RenderExtension} from '../../../extension';

import type {StandardApi} from './api/standard';

export interface ExtensionPoints {
  'Admin::CheckoutEditor::RenderSettings': RenderExtension<
    StandardApi<'Admin::CheckoutEditor::RenderSettings'>,
    AnyComponent
  >;
}

export type ExtensionPoint = keyof ExtensionPoints;

export type ExtensionForExtensionPoint<T extends ExtensionPoint> =
  ExtensionPoints[T];

export type {StandardApi};

type ComponentTypes = typeof import('../../../components');

export type Components = {
  [K in keyof ComponentTypes]: ComponentTypes[K] extends RemoteComponentType<
    any,
    any,
    any
  >
    ? ComponentTypes[K]
    : never;
};

export type AnyComponent = Components[keyof Components];
