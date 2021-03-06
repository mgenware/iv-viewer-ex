# iv-viewer-ex (WIP)
A fork of the original [iv-viewer](https://github.com/s-yadav/iv-viewer)

Changes to the original project:
* Convert to TypeScript
* Better imaging loading detection
* Compiles to a single JS file as UMD module
* Fix some examples not working properly

### Installation
```sh
yarn add iv-viewer-ex
```

## Usage
Node.js:
```js
import ImageViewer from 'iv-viewer-ex';

// Or
import {
  ImageViewer,
  FullScreenViewer,
} from 'iv-viewer-ex';

// Style file
import 'iv-viewer-ex/dist/main.css';
```

Browsers:
```html
<!-- Style file -->
<link href="./iv-viewer-ex/dist/main.css" rel="stylesheet" type="text/css" />

<script src="./iv-viewer-ex/dist/main.js"></script>
<script>
  const {
    ImageViewer,
    FullScreenViewer,
  } = window.ivViewerEx;
</script>
```

## Thanks
All credit to the original [iv-viewer](https://github.com/s-yadav/iv-viewer)