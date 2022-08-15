import type {ExtensionPoint, ExtensionPoints} from './extension-points';

export type {Extension, RenderExtension} from '../../extension';

export function extension<Point extends ExtensionPoint>(
  extension: ExtensionPoints[Point],
): ExtensionPoints[Point] {
  return extension;
}
