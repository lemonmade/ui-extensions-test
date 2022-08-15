import {Text, type TextProps, View, type ViewProps} from '../../../components';

export {Text, View};

export interface Components {
  Text: typeof Text;
  View: typeof View;
}

export type AnyComponent = Components[keyof Components];

export type {TextProps, ViewProps};
