{
	(function ($) {
		const trace = console.log;
		class ToolTip {
			static defaultOptions = {
				tooltipClass: null, // name of a CSS style for rendering the tooltip, or "null" for default style below
				tooltipOpacity: 1, // maximum opacity of tooltip, between 0.0 and 1.0 (after fade-in finishes, before fade-out begins)
				tooltipOffsetX: 0, // horizontal offset from cursor to upper-left corner of tooltip
				tooltipOffsetY: 0, // vertical offset from cursor to upper-left corner of tooltip
				fadeRate: 24, // animation rate for fade-in and fade-out, in steps per second
				pauseTime: 0.5, // how long the cursor must pause over HTML element before fade-in starts, in seconds
				displayTime: 10, // how long the tooltip will be displayed (after fade-in finishes, before fade-out begins), in seconds
				fadeinTime: 1, // how long fade-in animation will take, in seconds
				fadeoutTime: 3,
				placement: 'hover', // where to place the tooltip (e.g. "hover", "top-left", "top", "bottom-left", "bottom", "bottom-right", "left", "right", "top-right")
				trace: false, // whether to trace execution points for debugging
				defaultStyle: {
					maxWidth: "350px",
					height: "auto",
					border: "1.5px solid #3a6ea5",
					borderTopColor: "#b6e0fe", // lighter top accent
					   borderLeftColor: "#e3f0fb", // slightly darker highlight
					borderBottomColor: "#1a365d", // deeper blue for shadow
					borderRightColor: "#1a365d", // deeper blue for shadow
					boxShadow: "2px 4px 10px 0 rgba(60,80,120,0.15)",
					padding: "5px",
					backgroundColor: "#e7f3fe" // info color
				}
			};
			#id = null; // id of tooltip element
			#el = null; // pointer to the HTML element that the tooltip is attached to
			#content = null; // text, Node, HTML tags or jQuery object to be displayed in tooltip
			#options = {};
			// The "initialState" constant specifies the initial state of the finite state
			// machine, which must match one of the state names in the
			// "actionTransitionFunctions" table below.
			#initialState = 'Inactive';
			// These are state variables used by the finite state machine"s
			// action/transition functions (see the "actionTransitionTable" and
			// utility functions defined below).
			#currentState = null; // current state of finite state machine (one of "actionTransitionFunctions" properties)
			#currentTimer = null; // returned by setTimeout, if a timer is currently running
			#currentTicker = null;// returned by setInterval, if a ticker is currently running
			#currentOpacity = 0; // current opacity of tooltip, between 0.0 and "tooltipOpacity"
			#tooltipDivision = null; // pointer to HTML Division element, if tooltip is currently visible
			#lastCursorX = 0; // cursor x-position at most recent mouse event
			#lastCursorY = 0; // cursor y-position at most recent mouse event
			// The "actionTransitionFunctions" table is a two-dimensional associative array
			// of anonymous functions, or, if you prefer, an object containing more objects
			// containing anonymous functions.  The first dimension of the array (the outer
			// object) is indexed by state names; the second dimension of the array (the
			// inner objects) is indexed by event types.  When a mouse or timer event hander 
			// calls the "handleEvent" method, it calls the appropriate function from the table, 
			// passing an "event" object as an argument, ensuring that "this" points at the 
			// FadingTooltip object.  The selected function takes whatever actions are 
			// required for that event in the current state, and returns either the name of 
			// a new state, if a state transition is needed, or "null" if not.  See the design
			// documentation, in particular the state diagram and table, for details.  Note that
			// the array is sparse: state/event combinations that "should not occur" are 
			// empty.  If an event does occur in a state that does not expect it, the 
			// "unexpectedEvent" method will be called.			
			#actionTransitionFunctions = {
				// The "Inactive" column of the "actionTransitionFunctions" table contains a 
				// function for each mouse and timer event that is expected in this state.
				Inactive: {
					// When a "mouseover" event occurs in "Inactive" state, save the current
					// location of the cursor, [re-]start the pause timer, and transition to
					// "Pause" state.  Note that this function is also executed for "mouseover" 
					// events in "Pause" state, and "mousemove" events in "Inactive" state, 
					// since all of the same actions, and the same transition, are appropriate 
					// for them. 
					mouseenter: (event) => {
						this.cancelTimer();
						this.saveCursorPosition(event.clientX, event.clientY);
						this.startTimer(this.#options.pauseTime * 1000);
						return "Pause";
					},
					// When a "mousemove" event occurs in "Inactive" state, take the same 
					// actions, and make the same state transition, as for "mouseenter" 
					// events in "Inactive" state.  Note that this state/event situation
					// was not anticipated in the initial design of the finite state machine; 
					// this function was added when it occurred unexpectedly during testing.  
					// With MSIE, this often happens as soon as the mouse moves over the HTML element, 
					// before any "mouseenter" event occurs, presumably because of a bug in the 
					// browser.  With FF and NN, this can also happen if the mouse remains over
					// the HTML element after the tooltip has been displayed and faded out, and
					// the mouse then moves within the HTML element.
					mousemove: (event) => this.doActionTransition("Inactive", "mouseenter", event),
					// When a "mouseleave" event occurs in "Inactive" state, just ignore the event:
					// take no action and make no state transition.  Note that this state/event 
					// situation was not anticipated in the initial design; this function was added 
					// when it occurred unexpectedly during testing.  With MSIE, this may happen
					// when the mouse crosses the HTML element, without any "mouseenter" event, 
					// presumably because of a bug in the browser.  With FF and NN, this can also 
					// happen if the mouse remains over the HTML element after the tooltip has been 
					// displayed and faded out, and the mouse then moves off the HTML element.
					mouseleave: (event) => this.#currentState  // do nothing
				}, // end of FadingTooltip.prototype.actionTransitionFunctions.Inactive
				// The "Pause" column of the "actionTransitionFunctions" table contains a 
				// function for each mouse and timer event that is expected in this state.
				Pause: {
					// When a "mousemove" event occurs in "Pause" state, take the same 
					// actions, and make the same state transition, as for "mouseenter" 
					// events in "Inactive" state.
					mousemove: (event) => this.doActionTransition("Inactive", "mouseenter", event),
					// When a "mouseleave" event occurs in "Pause" state, just cancel the
					// timer and return to "Inactive" state.  Since tooltip has been created
					// yet, there is nothing more to do.
					mouseleave: (event) => (this.cancelTimer(), this.#initialState),
					// When a "timeout" event occurs in "Pause" state, create the 
					// tooltip (with an initial opacity of zero).  In the normal case, 
					// when the fade-in time is non-zero, start the animation ticker and 
					// transition to "FadeIn" state.  But when the fade-in time is zero, 
					// skip the fade animation (to avoid dividing by zero when "timetick"
					// events occur in "FadeIn" state), and transition directly to "Display"
					// state (after increasing the tooltip opacity to its maximum value and
					// setting the display timer).
					timeout: (event) => {
						this.cancelTimer();
						this.createTooltip();
						if (this.#options.fadeinTime > 0) {
							this.startTicker(1000 / this.#options.fadeRate);
							return "FadeIn";
						} else {
							this.fadeTooltip(+this.#options.tooltipOpacity);
							this.startTimer(this.#options.displayTime * 1000);
							return "Display";
						}
					}
				}, // end of FadingTooltip.prototype.actionTransitionFunctions.Pause
				// The "FadeIn" column of the "actionTransitionFunctions" table contains a 
				// function for each mouse and timer event that is expected in this state.
				FadeIn: {
					// When a "mousemove" event occurs in "FadeIn" state, take the same 
					// actions as for "mousemove" events in "Display" state.  Note that no
					// state transition occurs; the finite state machine remains in its 
					// current state.
					mousemove: (event) => this.doActionTransition("Display", "mousemove", event),
					// When a "mouseleave" event occurs in "FadeIn" state, just transition
					// to "FadeOut" state.  Leave the animation ticker running; subsequent
					// "timetick" events in "FadeOut" state will cause the fade animation to
					// reverse direction at the current tooltip opacity.
					mouseleave: (event) => "FadeOut",
					// When a "timetick" event occurs in "FadeIn" state, increase the
					// opacity of the tooltip slightly (such that opacity increases from zero 
					// to the specified maximum in equal increments over the specified fade-in 
					// time at the specified animation rate).  When tooltip opacity reaches the
					// specified maximum, cancel the ticker, start the display timer, and 
					// transition to "Display" state.
					timetick: (event) => {
						this.fadeTooltip(+this.#options.tooltipOpacity / (this.#options.fadeinTime * this.#options.fadeRate));
						if (this.#currentOpacity >= this.#options.tooltipOpacity) {
							this.cancelTicker();
							this.startTimer(this.displayTime * 1000);
							return "Display";
						}
						return this.#currentState;
					}
				}, // end of FadingTooltip.prototype.actionTransitionFunctions.FadeIn
				// The "Display" column of the "actionTransitionFunctions" table contains a 
				// function for each mouse and timer event that is expected in this state.
				Display: {
					// When a "mousemove" event occurs in "Display" state, move the tooltip
					// to the current cursor location, and leave the finite state machine in
					// its current state.
					mousemove: (event) => {
						this.moveTooltip(event.clientX, event.clientY);
						return this.#currentState;
					},
					// When a "mouseleave" event occurs in "Display" state, take the same 
					// actions, and make the same state transitions, as for "timeout" 
					// events in "Display" state.
					mouseleave: (event) => this.doActionTransition("Display", "timeout", event),
					// When a "timeout" event occurs in "Display" state, in the normal case, 
					// (when the fade-out time is non-zero), start the animation ticker and 
					// transition to "FadeOut" state.  But when the fade-out time is zero, 
					// skip the fade animation (to avoid dividing by zero when "timetick"
					// events occur in "FadeOut" state), and transition directly to "Inactive"
					// state (after deleting the tooltip).
					timeout: (event) => {
						this.cancelTimer();
						if (this.#options.fadeoutTime > 0) {
							this.startTicker(1000 / this.#options.fadeRate);
							return "FadeOut";
						} else {
							this.deleteTooltip();
							return "Inactive";
						}
					}
				}, // end of FadingTooltip.prototype.actionTransitionFunctions.Display
				// The "FadeOut" column of the "actionTransitionFunctions" table contains a 
				// function for each mouse and timer event that is expected in this state.
				FadeOut: {
					// When a "mouseenter" event occurs in "FadeOut" state, move the tooltip
					// to the current cursor location, and transition back to "FadeIn" state.
					// Leave the animation ticker running; subsequent "timetick" events in 
					// "FadeIn" state will cause the fade animation to reverse direction at 
					// the current tooltip opacity.
					mouseenter: (event) => {
						this.moveTooltip(event.clientX, event.clientY);
						return "FadeIn";
					},
					// When a "mousemove" event occurs in "FadeOut" state, take the same 
					// actions as for "mousemove" events in "Display" state.  Note that no
					// state transition occurs; the finite state machine remains in the 
					// current state.
					mousemove: (event) => this.doActionTransition("Display", "mousemove", event),
					mouseleave: (event) => this.#currentState, // do nothing
					// When a "timetick" event occurs in "FadeOut" state, decrease the
					// opacity of the tooltip slightly (such that opacity decreases from the 
					// specified maximum to zero in equal increments over the specified fade-out
					// time at the specified animation rate).  When tooltip opacity reaches zero,
					// cancel the ticker, delete the tooltip, and transition to "Inactive" state.
					timetick: (event) => {
						this.fadeTooltip(-this.#options.tooltipOpacity / (this.#options.fadeoutTime * this.#options.fadeRate));
						if (this.#currentOpacity <= 0) {
							this.cancelTicker();
							this.deleteTooltip();
							return this.#initialState;
						}
						return this.#currentState;
					}
				} // end of FadingTooltip.prototype.actionTransitionFunctions.FadeOut
			}; // end of FadingTooltip.prototype.actionTransitionFunctions 
			constructor(el, content, options) {
				this.#el = el;
				this.#content = content;
				this.#options = { ...ToolTip.defaultOptions, ...options };
				// Initialize the tooltip
				this.init();
			}
			init() {
				const self = this;
				this.#el.addEventListener('mouseenter', self.handleEvent.bind(this));
				this.#el.addEventListener('mousemove', self.handleEvent.bind(this));
				this.#el.addEventListener('mouseleave', self.handleEvent.bind(this));
				this.#currentState = this.#initialState;
				this.#id = `tooltip-${Math.random().toString(36).substring(2, 9)}`; // Unique id
				this.#el.dataset.tooltipId = this.#id;
			}
			// The "handleEvent" method handles mouse and timer events as appropriate for 
			// the current state of the finite state machine.  The required "event" argument 
			// is an object that has (at least) a "type" property whose value corresponds to 
			// one of the event types in the current state's column of the 
			// "actionTransitionFunctions" table.  For mouse events, it must also have 
			// "clientX" and "clientY" properties that specify the location of the cursor.
			// This method will select the appropriate action/transition function from the 
			// table and call it, passing on the "event" argument. Note that the
			// action/transition function is invoked via the "call" method of its Function
			// object, which allows us to set the context for the function so that the 
			// built-in variable "this" will point at the ToolTip object.  If we
			// were to call the function directly from the "actionTransitionFunctions" table, 
			// the "this" variable would point into the table.  The action/transition function 
			// returns a new state, which this method will store as current state of the finite 
			// state machine.  This method does not return a value.
			handleEvent(event) {
				const eventType = event.type;
				const action = this.#actionTransitionFunctions[this.#currentState][eventType];
				if (action) {
					const nextState = action(event);
					if (nextState && this.#actionTransitionFunctions[nextState]) {
						if (this.#options.trace) trace(`Transitioning from state "${this.#currentState}" to state "${nextState}" due to event "${eventType}"`);
						this.#currentState = nextState;
					} else {
						this.#currentState = this.undefinedState(event, nextState);
					}
				} else {
					if (this.#options.trace) {
						console.warn(`Unhandled event "${eventType}" in state "${this.#currentState}"`);
					}
					this.#currentState = this.unexpectedEvent(event);
				}
			}
			// The "unexpectedEvent" method is called by the "handleEvent" method when the
			// "actionTransitionFunctions" table does not contain a function for the current
			// event and state.  The required "event" argument is an object, but only its 
			// "type" property is required.  The method cancels any active timers, deletes 
			// the tooltip, if one has been created, and returns the finite state machine's 
			// initial state.  The unexpected event and state are shown in a "console.log" dialog 
			// to the user, who will hopefully send a problem report to the author of this code.
			unexpectedEvent(event) {
				this.cancelTimer();
				this.cancelTicker();
				this.deleteTooltip();
				console.log(`ToolTip handled unexpected event "${event.type}" in state "${this.#currentState}" for id="${this.#el.id}" running browser ${window.navigator.userAgent}`);
				return this.#initialState;
			}
			// The "undefinedState" method is called by the "handleEvent" method when the
			// "actionTransitionFunctions" table does not contain a column for the next 
			// state returned by the selected function.  The required "state" argument is 
			// the name of the undefined state.  The method cancels any active timers, deletes 
			// the tooltip, if one has been created, and returns the finite state machine's 
			// initial state.  The undefined state is shown in a "console.log" dialog to the user, 
			// who will hopefully send a problem report to the author of this code.
			undefinedState(event, state) {
				this.cancelTimer();
				this.cancelTicker();
				this.deleteTooltip();
				console.log(`ToolTip transitioned to undefined state "${state}" from state "${this.#currentState}" due to event "${event.type}" from HTML element id="${this.#el.id}" running browser ${window.navigator.userAgent}`);
				return this.#initialState;
			}
			// The "doActionTransition" method is used in the "actionTransitionFunctions" 
			// table when one function takes exactly the same actions as another function 
			// in the table.  It selects another function from the table, using the required
			// "anotherState" and "anotherEventType" arguments, and calls that function, passing
			// on the required "event" argument, and then returning its return value.  As with
			// the "handleEvent" method, the function is called via the "call" method of its 
			// Function object, which allows us to set its context so that the build-in "this"
			// variable will point to the FadingTooltip object while the function executes. 
			doActionTransition(anotherState, anotherEventType, event) {
				const action = this.#actionTransitionFunctions[anotherState][anotherEventType];
				if (action) {
					return action.call(this, event);
				}
			}
			startTimer(timeout) {
				var self = this;
				this.#currentTimer = setTimeout(function () { self.handleEvent({ type: "timeout" }); }, timeout);
			}
			// The "cancelTimer" method cancels any one-shot timer that may be
			// running (or recently expired) and then removes the opaque reference to 
			// to the timer object saved in the "startTimer" method (defined above).
			// This method does not return a value.
			cancelTimer() {
				if (this.#currentTimer) clearTimeout(this.#currentTimer);
				this.#currentTimer = null;
			}
			// The "startTicker" method starts a repeating ticker.  The required 
			// "interval" argument specifies the period of the ticker in milliseconds.  
			// The method defines an anonymous function for the ticker event handler.
			// When the browser calls timer event handlers, "this" points at the 
			// global window object.  Therefore, a pointer to the FadeTooltip object
			// is copied to the "self" local variable and enclosed with the anonymous
			// function definition so that the ticker event handler can locate the 
			// object when it is called.  The browser does not pass any arguments to
			// timer event handlers, so the ticker event handler creates a simple
			// "timer event" object containing only a "type" property, and passes
			// it to the "handleEvent" method (defined above).  So, when the 
			// "handleEvent" method executes, "this" will point at the FadingTooltip 
			// object, and the "type" property of its "event" argument will identify 
			// it as a "timetick" event.  The opaque reference to a timer object (returned
			// by the browser when any timer is started) is saved as a state variable 
			// so that the ticker can be cancelled when it is no longer needed.
			// This method does not return a value.
			startTicker(interval) {
				var self = this;
				this.currentTicker = setInterval(function () { self.handleEvent({ type: "timetick" }); }, interval);
			}
			// The "cancelTicker" method cancels any repeating ticker that may be
			// running, and then removes the opaque reference to the timer object 
			// saved in the "startTicker" method (defined above).  This method does 
			// not return a value.
			cancelTicker() {
				if (this.currentTicker) clearInterval(this.currentTicker);
				this.currentTicker = null;
			}
			// The "saveCursorPosition" method is called when the cursor position
			// changes while waiting for the cursor to pause over the HTML element.  
			// The required arguments "x" and "y" are the current cursor 
			// coordinates, which the method  It saves the so that the tooltip 
			// can be positioned near it, after the cursor pauses, when the 
			// "Pause" state timer expires. This method does not return a value.
			saveCursorPosition(x, y) {
				this.#lastCursorX = x;
				this.#lastCursorY = y;
			}
			// The createTooltip" method is called when the fade-in animation is
			// about to start.  It creates a "floating" HTML Division element for 
			// the tooltip.  The tooltip is styled with a named CSS style, if one 
			// is defined, or a default style if not.  In either case, the initial
			// opacity is set to zero for FF, NN, and MSIE.  This method does not 
			// return a value.
			createTooltip() {
				// create an HTML Division element for the tooltip and load the 
				// tooltip's text and HTML tags into it
				if (document.body.querySelector(this.#id)) {
					document.body.querySelector(this.#id).remove();
				}
				this.#tooltipDivision = document.createElement("div");
				this.#tooltipDivision.id = this.#id;
				if (typeof (this.#content) === 'string')
					this.#tooltipDivision.innerHTML = this.#content;
				else if (this.#content instanceof HTMLElement)
					this.#tooltipDivision.appendChild(this.#content);
				else if (this.#content instanceof jQuery)
					this.#tooltipDivision.appendChild(this.#content[0]);
				// if a named CSS style has been defined, apply it to the tooltip,
				// otherwise apply some default styling 
				if (this.#options.tooltipClass) {
					this.#tooltipDivision.className = this.#options.tooltipClass;
				} else {
					Object.assign(this.#tooltipDivision.style, this.#options.defaultStyle);
				}
				// make sure that the tooltip floats over the rest of the HTML
				// elements on the page
				// Set position based on placement
				const pos = this.calculateTooltipPosition();
				this.#tooltipDivision.style.visibility = "visible";
				this.#tooltipDivision.style.position = "absolute";
				this.#tooltipDivision.style.zIndex = 101;
				this.#tooltipDivision.style.left = pos.left + "px";
				this.#tooltipDivision.style.top = pos.top + "px";
				this.#tooltipDivision.style.pointerEvents = "none";
				// set the initial opacity of the tooltip to zero, using the proposed W3C 
				// CSS3 "style" property, and, if we are running MSIE, also create an 
				// "alpha" filter with an "opacity" property whose initial value is zero
				this.#currentOpacity = 0;
				this.#tooltipDivision.style.opacity = 0;
				// display the tooltip on the page
				document.body.appendChild(this.#tooltipDivision);
			}

			// Calculate tooltip position so it does not obscure the target
			calculateTooltipPosition() {

				const placement = this.#options.placement || 'hover';
				if (placement === 'hover') {
					const hleft = this.#lastCursorX + this.#options.tooltipOffsetX;
					const htop = this.#lastCursorY + this.#options.tooltipOffsetY;
					//console.log(`hover tooltip position: ${hleft}, ${htop}`);
					return { left: hleft.toFixed(2), top: htop.toFixed(2) };
				}
				const targetRect = this.#el.getBoundingClientRect();
				// Temporarily add tooltip to DOM to measure size
				let tooltipDiv = this.#tooltipDivision;
				tooltipDiv.style.display = 'block';
				tooltipDiv.style.visibility = 'hidden'; // Hide it off-screen
				tooltipDiv.style.position = 'absolute';
				tooltipDiv.style.left = '-9999px';
				document.body.appendChild(tooltipDiv);
				const tooltipRect = tooltipDiv.getBoundingClientRect();
				document.body.removeChild(tooltipDiv);
				// Restore original styles
				tooltipDiv.style.visibility = 'visible';
				// console.log(`placement: ${placement} target position: ${targetRect.left}, ${targetRect.top} target size: ${targetRect.width}, ${targetRect.height} -- ${JSON.stringify(targetRect)}`);
				// console.log(`tooltip size: ${tooltipRect.width}, ${tooltipRect.height} -- ${JSON.stringify(tooltipRect)}`);
				let left = 0, top = 0;
				switch (placement) {
					case 'top':
						// Centered above the target
						left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
						top = targetRect.top - tooltipRect.height - this.#options.tooltipOffsetY;
						break;
					case 'bottom':
						// Centered below the target (already correct)
						left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
						top = targetRect.bottom + this.#options.tooltipOffsetY;
						break;
					case 'left':
						// Vertically centered, left of the target
						left = targetRect.left - tooltipRect.width - this.#options.tooltipOffsetX;
						top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
						break;
					case 'right':
						// Vertically centered, right of the target
						left = targetRect.right + this.#options.tooltipOffsetX;
						top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
						break;
					case 'top-left':
						// Top edge aligned, left edges aligned
						left = targetRect.left - tooltipRect.width - this.#options.tooltipOffsetX;
						top = targetRect.top - tooltipRect.height - this.#options.tooltipOffsetY;
						break;
					case 'top-right':
						// Top edge aligned, right edges aligned
						left = targetRect.right + this.#options.tooltipOffsetX;
						top = targetRect.top - tooltipRect.height - this.#options.tooltipOffsetY;
						break;
					case 'bottom-left':
						// Bottom edge aligned, left edges aligned
						left = targetRect.left - tooltipRect.width - this.#options.tooltipOffsetX;
						top = targetRect.bottom + this.#options.tooltipOffsetY;
						break;
					case 'bottom-right':
						// Bottom edge aligned, right edges aligned
						left = targetRect.right + this.#options.tooltipOffsetX;
						top = targetRect.bottom + this.#options.tooltipOffsetY;
						break;
					case 'hover':
					default:
						// Fallback to cursor position (handled elsewhere)
						left = this.#lastCursorX + this.#options.tooltipOffsetX;
						top = this.#lastCursorY + this.#options.tooltipOffsetY;
						break;
				}
				// Clamp to viewport
				left = Math.max(0, Math.min(left, window.innerWidth - tooltipRect.width));
				top = Math.max(0, Math.min(top, window.innerHeight - tooltipRect.height));
				//console.log(`final tooltip position: ${left}, ${top}`);
				return { left: left.toFixed(2), top: top.toFixed(2) };
			}
			// The "fadeTooltip" method increases or decreases the opacity of the 
			// tooltip.  The required "opacityDelta" argument specifies the size
			// of the increase (positive values) or decrease (negative values).
			// The increase is limited to the specified maximum value; the decrease
			// is limited to zero. This method does not return a value.
			fadeTooltip(opacityDelta) {
				// if the tooltip is not currently visible, do nothing
				if (!this.#tooltipDivision) return;

				// calculate the new opacity value as a decimal fraction, rounded 
				// to the nearest 0.000001 (that is, the nearest one-millionth), 
				// to avoid exponential representation of very small values, which 
				// are not recognized as valid values of the "opacity" style property
				this.#currentOpacity = Math.round((this.#currentOpacity + opacityDelta) * 1000000) / 1000000;
				// make sure the new opacity value is between 0.0 and the specified
				// maximum tooltip opacity
				if (this.#currentOpacity < 0) this.#currentOpacity = 0;
				if (this.#currentOpacity > this.#options.tooltipOpacity) this.#currentOpacity = this.#options.tooltipOpacity;
				// change the "opacity" style property of the HTML Division element that
				// contains the tooltip text, and, if we are running MSIE, find the "alpha"
				// filter created in "createTooltip" (defined above) and change its "opacity"
				// property to match, remembering that its range is 0 to 100, not 0 to 1
				this.#tooltipDivision.style.opacity = this.#currentOpacity;
			}
			// The "moveTooltip" method is called when the cursor position
			// changes while the tooltip is visible, whether it is fading in, 
			// fully displayed, or fading out.  It moves the tooltip so that
			// it follows the movement of the cursor.  This method does not 
			// return a value.
			moveTooltip(x, y) {
				// Only move tooltip if placement is 'hover' (follows cursor)
				if (this.#tooltipDivision && this.#options.placement === 'hover') {
					this.#tooltipDivision.style.left = x + this.#options.tooltipOffsetX + "px";
					this.#tooltipDivision.style.top = y + this.#options.tooltipOffsetY + "px";
				}
			}
			// The "deleteTooltip" method is called after the tooltip has faded out
			// completely.  It deletes the HTML Division element.  This method does 
			// not return a value.  
			deleteTooltip() {
				if (this.#tooltipDivision) document.body.removeChild(this.#tooltipDivision);
				this.#tooltipDivision = null;
			}
			stop() {
				$(this.#el).off('mouseenter mousemove mouseleave');
				this.deleteTooltip();
				this.cancelTimer();
				this.#currentState = this.#initialState;
			}
			changeOptions(newOptions) {

					this.#options = { ...this.#options, ...newOptions };
			}
			// content is always set when the tooltip is created
			// so there is no need to do anything fancy here.
			changeContent(newContent) {
				this.#content = newContent;
			}
			get id() {
				return this.#id;
			}
			get content() {
				return this.#content;
			}
			// Public method to get current options (for UI/demo use)
			get options() {
				return { ...ToolTip.defaultOptions, ...this.#options };
			}

		}

		// Tooltip plugin definition
		$.fn.tooltip = function (content, options) {
			return this.each(function () {
				let tip = $(this).data('tooltipInstance');

				// If content is 'options', just update options
				if (typeof content === 'string' && content.trim() === 'options') {
					if (tip) {
						tip.changeOptions(options);
					}
					return;
				}

				// If no instance, use title if content is undefined
				if (!tip) {
					let tooltipContent = content;
					if (content === undefined) {
						const title = $(this).attr('title');
						if (title) {
							tooltipContent = title;
							$(this).removeAttr('title');
						}
					}
					tip = new ToolTip(this, tooltipContent, options);
					$(this).data('tooltipInstance', tip);
					return;
				}

				// If instance exists, update content and/or options
				if (content !== undefined) {
					tip.changeContent(content);
				} else if ($(this).attr('title')) {
					const title = $(this).attr('title');
					$(this).removeAttr('title');
					tip.changeContent(title);
				}
				if (options) {
					tip.changeOptions(options);
				}
			});
		}
		$.fn.getTooltipOptions = function () {

			const tip = $(this[0]).data('tooltipInstance');
			return tip ? tip.options : null;
		};
		$.fn.getTooltipContents = function () {
			const tip = $(this[0]).data('tooltipInstance');
			return tip ? tip.content : null;
		};
		$.fn.setTooltipContents = function (newContent) {
			return this.each(function () {
				const tip = $(this).data('tooltipInstance');
				if (tip) {
					tip.changeContent(newContent);
				}
			});
		};
		$.fn.removeTooltip = function () {
			return this.each(function () {
				const tip = $(this).data('tooltipInstance');
				if (tip) {
					tip.stop();
					$(this).data('tooltipInstance', null);
				}
			});
		};

	})(jQuery);
}