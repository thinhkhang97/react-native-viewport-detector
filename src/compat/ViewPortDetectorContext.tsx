import React from 'react';
import {LayoutRectangle} from '../types';

/**
 * Measures the provider's current rectangle in window coordinates.
 * Called on every check so providers nested inside scrolling content stay accurate.
 */
export type MeasureViewport = (
  callback: (viewport: LayoutRectangle) => void,
) => void;

/**
 * Context exposing how to measure the enclosing viewport.
 * @type {React.Context}
 */
export const ViewPortDetectorContext = React.createContext<{
  measureViewport?: MeasureViewport;
}>({});
