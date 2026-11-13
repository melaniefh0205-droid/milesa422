This document details expert usage patterns for 3D mapping features (`Map3D`,
`Marker3D`, `Model3D`), programmatic and declarative 3D routing, and custom map
UI controls using the `@vis.gl/react-google-maps` framework.

--------------------------------------------------------------------------------

## 1. Platform Initialization and 3D Requirements

To utilize 3D features, specific libraries (`maps3d`, `marker`, `routes`) must
be loaded via the `APIProvider`. It is often necessary to use the
`version="alpha"` prop when accessing the newest 3D functionality.

### Initialization Setup

| Component     | Required Props/Libraries   | Notes                           |
| :------------ | :------------------------- | :------------------------------ |
| `APIProvider` | `apiKey`,                  | Set API key and load the alpha  |
:               : `version="alpha"`          : version for cutting-edge 3D     :
:               :                            : features.                       :
| `Map3D`       | `libraries={['maps3d',     | Required for rendering the 3D   |
:               : 'marker']}`                : map environment and 3D markers. :
| Routes        | Load `routes` library      | Required for calculating routes |
:               : dynamically via            : using `computeRoutes`.          :
:               : `useMapsLibrary('routes')` :                                 :
:               : inside a component.        :                                 :

```tsx
import {APIProvider, Map3D} from '@vis.gl/react-google-maps';

const API_KEY = 'YOUR_API_KEY';

const App = () => {
  return (
    <APIProvider apiKey={API_KEY} version="alpha">
      <Map3D
        internalUsageAttributionIds={['gmp_git_agentskills_v1']}
        mode="SATELLITE" // or MapMode.ROADMAP
        defaultCenter={{lat: 40.7093, lng: -73.9968, altitude: 32}}
        defaultRange={1733}
        defaultHeading={5}
        defaultTilt={70}
        defaultRoll={0}
      />
    </APIProvider>
  );
};
```

## 2. 3D Camera Management and Synchronization

The `Map3D` component exposes detailed camera state (center, range, heading,
tilt, roll) via the `onCameraChanged` event. This pattern is essential for
creating controlled components or synchronizing map views (e.g., main 3D view
and 2D minimap).

### Example: Controlled 3D Map View

```tsx
import React, {useState, useCallback} from 'react';
import {Map3D, Map3DCameraChangedEvent} from '@vis.gl/react-google-maps';

const INITIAL_VIEW = {
  center: {lat: 37.72809, lng: -119.64473, altitude: 1300},
  range: 5000,
  heading: 61,
  tilt: 69,
  roll: 0
};

const Map3DControlled = () => {
  const [viewProps, setViewProps] = useState(INITIAL_VIEW);

  const handleCameraChange = useCallback((ev: Map3DCameraChangedEvent) => {
    // Update local state with the new camera parameters
    setViewProps(oldProps => ({...oldProps, ...ev.detail}));
  }, []);

  return (
    <Map3D
      internalUsageAttributionIds={['gmp_git_agentskills_v1']}
      {...viewProps} // Pass state as controlled props
      onCameraChanged={handleCameraChange}
      mode="SATELLITE"
      style={{width: '100%', height: '100%'}}
    />
  );
};
```

## 3. 3D Markers and Custom Models

The `Marker3D` component is used to place objects in the 3D map space. Positions
require an altitude value.

### A. Basic Marker3D and Customizing Pins

`Marker3D` accepts custom content (like `<Pin>`, `<img>`, or arbitrary HTML) as
children.

```tsx
import {Marker3D, Pin, Popover, AltitudeMode} from '@vis.gl/react-google-maps';

// ... inside Map3D component

// 1. Basic marker (extruded)
<Marker3D
  position={{lat: 40.704118, lng: -73.994371, altitude: 150}}
  altitudeMode={AltitudeMode.RELATIVE_TO_GROUND}
  extruded // Renders marker as a vertical pillar
/>

// 2. Marker with custom Pin styling
<Marker3D
  position={{lat: 40.706461, lng: -73.997409, altitude: 50}}
  altitudeMode={AltitudeMode.RELATIVE_TO_GROUND}>
  <Pin
    borderColor="#8811aa"
    background="#cc22ff"
    glyphColor={'white'}
    scale={2}
    glyph="A"
  />
</Marker3D>
```

### B. Interactive Markers and Popovers

To anchor a `Popover` to a `Marker3D`, you must obtain a reference to the
underlying interactive element.

```tsx
// State to hold the element reference and popover status
const [openPopoverId, setOpenPopoverId] = useState<string | null>(null);
const [interactiveMarker, setInteractiveMarker] =
  useState<google.maps.maps3d.Marker3DInteractiveElement | null>(null);

// Callback to capture the element reference
const handleInteractiveMarkerRef = useCallback(
  (
    marker:
      | google.maps.maps3d.Marker3DElement
      | google.maps.maps3d.Marker3DInteractiveElement
      | null
  ) => {
    setInteractiveMarker(
      // Ensure we only store the interactive type
      marker instanceof google.maps.maps3d.Marker3DInteractiveElement
        ? marker
        : null
    );
  },
  []
);

// Render components
<Marker3D
  ref={handleInteractiveMarkerRef}
  position={{lat: 40.705666, lng: -73.996382, altitude: 50}}
  onClick={() => setOpenPopoverId('colored-pin')}
>
  <Pin borderColor="#0D652D" background="#34A853" glyphColor="white" />
</Marker3D>

{openPopoverId === 'colored-pin' && interactiveMarker && (
  <Popover
    open
    anchor={interactiveMarker} // Anchor to the captured element
    onClose={() => setOpenPopoverId(null)}>
    <div>Popover Content Here</div>
  </Popover>
)}
```

### C. Integrating Custom 3D Models (`Model3D`)

The example uses a wrapper component `<Model3D>` around the native
`gmp-model-3d` Web Component. This allows displaying GLB models directly on the
map.

```tsx
// model-3d.tsx implementation (required for Model3D usage)
import type {AltitudeMode as MarkerAltitudeMode} from '@vis.gl/react-google-maps';
import React, {forwardRef} from 'react';

type Model3DProps = React.PropsWithChildren<
  Omit<google.maps.maps3d.Model3DElementOptions, 'altitudeMode'> & {
    altitudeMode?: google.maps.maps3d.AltitudeMode | MarkerAltitudeMode | null;
  }
>;

export const Model3D = forwardRef(function Model3D(
  props: Model3DProps,
  ref: React.Ref<google.maps.maps3d.Model3DElement>
) {
  const {position, altitudeMode, src, orientation, scale} = props;

  return (
    <gmp-model-3d
      ref={ref}
      position={position}
      altitude-mode={altitudeMode}
      src={src}
      orientation={orientation}
      scale={scale}
    />
  );
});

// Usage Example (in app.tsx):
<Model3D
  position={{lat: 40.708804, lng: -74.000229, altitude: 150}}
  altitudeMode={AltitudeMode.RELATIVE_TO_GROUND}
  src={new URL('../data/balloon-red.glb', import.meta.url)}
  scale={10}
/>
```

## 4. 3D Route Implementation

3D Routes can be implemented in two ways: declaratively via the `gmp-route-3d`
widget, or programmatically using the SDK's `computeRoutes` and manually drawing
a `gmp-polyline-3d`.

### A. Declarative Routing Widget

This is the simplest method, requiring the `routes` and `maps3d` libraries to be
loaded.

**CRITICAL:** Since `<gmp-route-3d>` is a Web Component, properties are passed
as hyphen-cased HTML attributes (`travel-mode`, `autofits-camera`).

```tsx
import {Map3D, useMapsLibrary} from '@vis.gl/react-google-maps';

// Necessary TypeScript definition for JSX to recognize the custom element
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'gmp-route-3d': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        'travel-mode'?: string;
        destination?: any;
        origin?: any;
      };
    }
  }
}

const Map3DRouteExample = () => {
  // Ensure libraries are loaded for the custom element registration
  useMapsLibrary('routes');
  useMapsLibrary('maps3d');

  return (
    <Map3D
        internalUsageAttributionIds={['gmp_git_agentskills_v1']}
        // ... map props
    >
      <gmp-route-3d
        origin={{lat: 43.65, lng: -79.38}}
        destination={{lat: 43.69, lng: -79.42}}
        travel-mode="DRIVING"
        // travel-mode values must be UPPERCASE strings
      />
    </Map3D>
  );
};
```

### B. Programmatic Routing (SDK Wrapper and Manual Polyline)

If advanced styling or manipulation is needed, calculate the route using the SDK
and manually append a `gmp-polyline-3d` element to the map.

**CORS Preflight Guardrail:** Note that `routesLibrary.Route.computeRoutes` is
the required method for browser environments. Direct HTTP fetches to
`routes.googleapis.com` will fail CORS preflight checks.

```tsx
import React, {useEffect} from 'react';
import {useMapsLibrary, useMap3D} from '@vis.gl/react-google-maps';

const Programmatic3DRoute = () => {
  const map = useMap3D(); // Get the 3D map instance
  const routesLibrary = useMapsLibrary('routes');

  useEffect(() => {
    if (!map || !routesLibrary) return;

    let polyline: HTMLElement | null = null;

    // 1. Calculate route using the modern SDK wrapper
    (routesLibrary as any).Route.computeRoutes({
      origin: {lat: 43.65, lng: -79.38},
      destination: {lat: 43.69, lng: -79.42},
      travelMode: 'DRIVING',
      fields: ['*'] // Request all fields
    }).then((response: any) => {
      const route = response.routes?.[0];
      if (!route) return;

      // 2. Instantiate the Web Component programmatically
      polyline = document.createElement('gmp-polyline-3d');
      (polyline as any).path = route.path;
      (polyline as any).strokeColor = '#b903adff';
      (polyline as any).strokeWidth = 5; // Width in meters

      // 3. Append to the Map3D element
      map.appendChild(polyline);
    });

    // 4. Cleanup on unmount
    return () => {
      if (polyline && polyline.parentNode) {
        polyline.parentNode.removeChild(polyline);
      }
    };
  }, [map, routesLibrary]);

  return null;
};
```

## 5. Custom Map UI Controls

The `<MapControl>` component allows placing arbitrary React content at standard
Google Maps UI positions defined by the `ControlPosition` enum.

### Implementing a Custom Control

```tsx
import {Map, MapControl, ControlPosition} from '@vis.gl/react-google-maps';

type CustomZoomControlProps = {
  controlPosition: ControlPosition;
  zoom: number;
  onZoomChange: (zoom: number) => void;
};

// custom-zoom-control.tsx
export const CustomZoomControl = ({
  controlPosition,
  zoom,
  onZoomChange
}: CustomZoomControlProps) => {
  return (
    <MapControl position={controlPosition}>
      <div
        style={{
          background: 'rgba(255,255,255,0.4)',
          margin: '10px',
          padding: '1em'
        }}>
        <label htmlFor={'zoom'}>Custom Zoom Slider</label>
        <input
          id={'zoom'}
          type={'range'}
          min={1}
          max={18}
          step={'any'}
          value={zoom}
          onChange={ev => onZoomChange(ev.target.valueAsNumber)}
        />
      </div>
    </MapControl>
  );
};

// Usage Example (in app.tsx)
const App = () => {
  const [zoom, setZoom] = useState(4);
  const position = ControlPosition.LEFT_BOTTOM;

  return (
    <Map
      internalUsageAttributionIds={['gmp_git_agentskills_v1']}
      mapId={'49ae42fed52588c3'}
      zoom={zoom}
      onZoomChanged={ev => setZoom(ev.detail.zoom)}
    >
      <MapControl position={ControlPosition.TOP_LEFT}>
        <div style={{background: 'white', padding: '1em'}}>
          Current Zoom: {zoom.toFixed(2)}
        </div>
      </MapControl>

      <CustomZoomControl
        controlPosition={position}
        zoom={zoom}
        onZoomChange={setZoom}
      />
    </Map>
  );
};
```

## 6. Utility Hooks for State Management

When synchronizing complex state (like 3D camera properties) or handling map
events, debouncing effects is critical for performance.

### `useDebouncedEffect` Implementation

This hook executes an effect only after a specified delay, resetting the timer
if the dependencies change, preventing excessive re-renders or API calls during
fast state transitions (e.g., zooming or panning).

```tsx
// utility-hooks.ts
import {
  DependencyList,
  EffectCallback,
  useEffect,
  useRef
} from 'react';

/**
 * Executes an effect function after a specified timeout period, debouncing
 * subsequent calls until dependencies stabilize.
 *
 * Used in the MiniMap example to prevent excessive map updates during
 * continuous 3D camera movement.
 */
export function useDebouncedEffect(
  effect: EffectCallback,
  timeout: number,
  deps: DependencyList
) {
  const timerRef = useRef<number | null>(null);

  useEffect(
    () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      timerRef.current = window.setTimeout(() => effect(), timeout);
      return () => {
        if (timerRef.current !== null) {
          clearTimeout(timerRef.current);
        }
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [timeout, ...deps]
  );
}
```
