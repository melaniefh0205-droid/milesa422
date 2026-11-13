---
name: map-tiles-api-web-api
description: Use this skill when the user wants to fetch 2D map tiles (roadmap, satellite, terrain), customize 2D roadmap styles and features, render photorealistic 3D tiles using OGC format or CesiumJS, or retrieve Google Street View tiles, thumbnails, and metadata via the Map Tiles API.
license: Apache-2.0
metadata:
  version: 1.0.55
---

> [!IMPORTANT] **Core Dependency:** This skill requires active context from
> [google-maps-platform/SKILL.md](https://www.gstatic.com/googlemapsplatform-agent-skills/google-maps-platform/SKILL.md).

### Overview

The Map Tiles API provides direct HTTP REST access to Google's high-resolution
map data, enabling developers to integrate customized 2D maps, photorealistic 3D
models, and Street View imagery into custom rendering engines and web
applications.

Use this skill to manage session tokens, construct HTTP requests for specific
tile coordinates and zoom levels, customize map appearances, and integrate
OGC-compliant 3D tilesets with compatible renderers like CesiumJS.

## Primary Orchestration Integration Workflow

Follow this multi-phase sequential integration checklist to compose features
robustly. For each phase, read the referenced capability sub-workflow file and
satisfy its *Evidence Checkpoint* before advancing.

### Phase 1: Feature Layer & Custom Enrichment (Supplemental)

#### Feature Module: Maps (Optional - Use-Case Dependent)

-   [ ] **Returns an image file of a 2D roadmap tile for a specified set of map
    tile coordinates (x, y) and zoom level (z) using a session token.** Read
    [references/return-image-file-2d-roadmap-tile-set-map-tile-coordinates-and-zoom-level.md](https://www.gstatic.com/googlemapsplatform-agent-skills/map-tiles-api-web-api/references/return-image-file-2d-roadmap-tile-set-map-tile-coordinates-and-zoom-level.md).
    *Trigger Condition*: Use when the user wants to fetch 2D roadmap tiles via
    the Map Tiles API. *Evidence Checkpoint*: A session token is generated with
    mapType 'roadmap', and the HTTP GET tile request returns a 200 OK status
    with a valid image payload.
-   [ ] **Returns an image file of a 2D satellite map tile for a specified set
    of map tile coordinates (x, y) and zoom level (z) using a session token.**
    Read
    [references/return-image-file-2d-satellite-map-tile-set-map-tile-coordinates-and-zoom-level.md](https://www.gstatic.com/googlemapsplatform-agent-skills/map-tiles-api-web-api/references/return-image-file-2d-satellite-map-tile-set-map-tile-coordinates-and-zoom-level.md).
    *Trigger Condition*: Use when the user wants to fetch 2D satellite imagery
    tiles via the Map Tiles API. *Evidence Checkpoint*: A session token is
    generated with mapType 'satellite', and the HTTP GET tile request returns a
    200 OK status with a valid satellite image payload.
-   [ ] **Returns an image file of a 2D terrain map tile for a specified set of
    map tile coordinates (x, y) and zoom level (z) using a session token.** Read
    [references/return-image-file-2d-terrain-map-tile-set-map-tile-coordinates-and-zoom-level.md](https://www.gstatic.com/googlemapsplatform-agent-skills/map-tiles-api-web-api/references/return-image-file-2d-terrain-map-tile-set-map-tile-coordinates-and-zoom-level.md).
    *Trigger Condition*: Use when the user wants to fetch 2D terrain and
    topography map tiles via the Map Tiles API. *Evidence Checkpoint*: A session
    token is generated with mapType 'terrain' and 'layerRoadmap', and the HTTP
    GET tile request returns a 200 OK status with a valid terrain image payload.
-   [ ] **Customizes the visual styling (colors, weight, saturation, lightness)
    of map features and elements on 2D roadmap tiles via session creation
    parameters.** Read
    [references/change-style-map-features-2d-roadmap-tiles.md](https://www.gstatic.com/googlemapsplatform-agent-skills/map-tiles-api-web-api/references/change-style-map-features-2d-roadmap-tiles.md).
    *Dependencies*:
    `["references/return-image-file-2d-roadmap-tile-set-map-tile-coordinates-and-zoom-level.md"]` \
    *Trigger Condition*: Use when the user wants to apply custom visual styles
    to 2D roadmap tiles. *Evidence Checkpoint*: The createSession HTTP POST
    request includes the 'styles' array in its JSON payload and returns a 200 OK
    with a session token that renders styled 2D roadmap tiles.
-   [ ] **Controls the visibility (on, off, or simplified) of specific map
    features such as points of interest, transit, or road labels on 2D roadmap
    tiles.** Read
    [references/display-or-hide-map-features-2d-roadmap-tiles.md](https://www.gstatic.com/googlemapsplatform-agent-skills/map-tiles-api-web-api/references/display-or-hide-map-features-2d-roadmap-tiles.md).
    *Dependencies*:
    `["references/return-image-file-2d-roadmap-tile-set-map-tile-coordinates-and-zoom-level.md"]` \
    *Trigger Condition*: Use when the user wants to show, hide, or simplify
    specific map features on 2D roadmap tiles. *Evidence Checkpoint*: The
    createSession HTTP POST request includes visibility rules in the 'styles'
    array and returns a 200 OK with a session token that renders tiles with the
    specified feature visibility.
-   [ ] **Renders an interactive Photorealistic 3D Tiles map view on a web page
    using the CesiumJS library and the Map Tiles API 3D endpoint.** Read
    [references/add-interactive-photorealistic-3d-map-view-web-page-using-cesium-js-renderer.md](https://www.gstatic.com/googlemapsplatform-agent-skills/map-tiles-api-web-api/references/add-interactive-photorealistic-3d-map-view-web-page-using-cesium-js-renderer.md).
    *Dependencies*:
    `["references/return-uri-photorealistic-3d-tile-ogc-format.md"]` \
    *Trigger Condition*: Use when the user wants to build an interactive 3D map
    visualization in a web browser using CesiumJS and Google Photorealistic 3D
    Tiles. *Evidence Checkpoint*: The Cesium Viewer initializes without errors
    and loads the 3D tileset from the root.json endpoint using a valid API key.
-   [ ] **Retrieves the root tileset JSON and subsequent glTF 3D tile URIs in
    OGC 3D Tiles format for Photorealistic 3D Tiles.** Read
    [references/return-uri-photorealistic-3d-tile-ogc-format.md](https://www.gstatic.com/googlemapsplatform-agent-skills/map-tiles-api-web-api/references/return-uri-photorealistic-3d-tile-ogc-format.md).
    *Trigger Condition*: Use when the user wants to directly request
    Photorealistic 3D Tiles URIs or integrate OGC 3D tiles into a custom 3D
    renderer. *Evidence Checkpoint*: An HTTP GET request to the
    /v1/3dtiles/root.json endpoint with a valid API key returns a 200 OK status
    and a valid OGC 3D Tiles JSON response containing child tile URIs and
    session parameters.
-   [ ] **Returns an image file of a Google Street View panorama tile for a
    specific panorama ID or location, zoom level, and tile coordinates (x, y).**
    Read
    [references/return-image-file-google-street-view-tile-set-map-tile-coordinates-and-zoom-level.md](https://www.gstatic.com/googlemapsplatform-agent-skills/map-tiles-api-web-api/references/return-image-file-google-street-view-tile-set-map-tile-coordinates-and-zoom-level.md).
    *Trigger Condition*: Use when the user wants to fetch full-resolution Street
    View image tiles to construct or display a Street View panorama. *Evidence
    Checkpoint*: A Street View session token is created, and the HTTP GET
    request to the /v1/streetview/tiles/{z}/{x}/{y} endpoint with a valid panoId
    or lat/lng returns a 200 OK image response.
-   [ ] **Returns a customizable thumbnail image of a Google Street View
    panorama for a given location or panorama ID with configurable size,
    heading, pitch, and field of view.** Read
    [references/return-thumbnail-image-file-google-street-view-panorama-set-map-tile-coordinates-and-zoom-level.md](https://www.gstatic.com/googlemapsplatform-agent-skills/map-tiles-api-web-api/references/return-thumbnail-image-file-google-street-view-panorama-set-map-tile-coordinates-and-zoom-level.md).
    *Trigger Condition*: Use when the user wants a static preview or thumbnail
    image of a Street View panorama rather than tiled panorama segments.
    *Evidence Checkpoint*: An HTTP GET request to the /v1/streetview/thumbnail
    endpoint with a valid session token and location/panoId parameters returns a
    200 OK response containing the thumbnail image.
-   [ ] **Returns panorama metadata (such as panorama ID, exact coordinates,
    copyright, capture date, and image dimensions) for a Google Street View
    location or panorama ID.** Read
    [references/return-metadata-google-street-view-tile.md](https://www.gstatic.com/googlemapsplatform-agent-skills/map-tiles-api-web-api/references/return-metadata-google-street-view-tile.md).
    *Trigger Condition*: Use when the user wants to query Street View
    availability, get the panoId for coordinates, or retrieve attribution and
    orientation metadata. *Evidence Checkpoint*: An HTTP GET request to the
    /v1/streetview/metadata endpoint with a valid session token and location or
    panoId returns a 200 OK JSON payload containing panorama metadata.
