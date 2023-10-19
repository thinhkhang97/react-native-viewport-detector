import React from 'react';
import {LayoutRectangle} from '../types';

/**
 * Context to provide the parent layout information.
 * @type {React.Context}
 */
export const ViewPortDetectorContext = React.createContext<{
  parentLayout?: LayoutRectangle;
}>({});
