# Fading Tooltip

## Description
A lightweight jQuery plugin for tooltips that fade in and out smoothly. Easily add informative tooltips to any element with customizable fade effects.

## Features
- Simple integration with jQuery
- Smooth fade-in and fade-out animations
- Customizable appearance and timing
- Works with any HTML element

## Demo
![Tooltip Demo](smiley.gif)

Open `jquery.tooltip.html` in your browser to see a demo.

## Installation
1. Download or clone this repository.
2. Include jQuery and `jquery.tooltip.js` in your HTML file:
	 ```html
	 <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
	 <script src="jquery.tooltip.js"></script>
	 ```

## Usage
1. Add a `title` attribute to any element you want to have a tooltip. Initialize the plugin with:
```js

$(function() {
	$('[selector]').tooltip();
});
```

2. Add a tooltip with content, which might include html tags, and options, which are not required.
```js
$(function() {
	$('[selector]').tooltip(content, options);
});
```

## Options

You can customize the tooltip by passing the following options:

| Option           | Type    | Description                                      | Example Value           |
|------------------|---------|--------------------------------------------------|-------------------------|
| tooltipClass     | string  | Css class(es) to style tooltip.                  |                         |
|                  |         | Will apply this class to the tooltip instead of default style.             |
| placement        | string  | Tooltip position relative to the element         | hover                   |
| fadeinTime       | number  | Fade-in duration in seconds                      | 3                       |
| fadeoutTime      | number  | Fade-out duration in seconds                     | 3                       |
| displayTime      | number  | Time tooltip remains visible (seconds)           | 10                      |
| tooltipOpacity   | number  | Tooltip opacity final (0 to 1)                   | 0.9                     |
| tooltipOffsetX   | number  | Horizontal offset in pixels                      | 10                      |
| tooltipOffsetY   | number  | Vertical offset in pixels                        | 10                      |

placement values are: hover, top, bottom, left, right, top-left, top-right, bottom-left, bottom-right
Example usage:

```js
$('[selector]').tooltip({
	placement: $("#placement").val(),
	fadeinTime: 3,
	fadeoutTime: 3,
	displayTime: 10,
	tooltipOpacity: 1.0,
	tooltipOffsetX: 10,
	tooltipOffsetY: 10
});
```
To change options use, setTooltipOptions:
```js
$(['selector']).tooltip('options',options);
```
To change the content, 
```js
$('[selector]').setTooltipContents(content);

To get the current options, use:
$('[selector]').getTooltipOptions();

To get current contents, use:
$('[selector]').getTooltipContents();

## Browser Compatibility
Tested in all modern browsers.

## Contributing
Pull requests and suggestions are welcome!

## License
MIT License

## Credits
This is inspired by Edward Pring of IBM, Finite state machines in JavaScript, Parts 1, 2, 3, 2007. This was my first introduction to finite state machines. The writing was straightforward, comprehensive and enjoyable. I read this many years ago and just found the original on one of my home servers. I decided to update it to current standards and implement it as a jquery plugin. That wasn't really necessary, but it was instructive for me.
Various plugins
