import type {StandardApi} from './standard';

export interface CartLineDetailsRenderAfterApi
  extends StandardApi<'Checkout::CartLineDetails::RenderAfter'> {
  readonly target: any;
}
