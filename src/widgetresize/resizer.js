/**
 * @license Copyright (c) 2003-2019, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/**
 * @module widget/widgetresize/resizer
 */

import View from '@ckeditor/ckeditor5-ui/src/view';
import Template from '@ckeditor/ckeditor5-ui/src/template';
import Rect from '@ckeditor/ckeditor5-utils/src/dom/rect';

import ObservableMixin from '@ckeditor/ckeditor5-utils/src/observablemixin';
import mix from '@ckeditor/ckeditor5-utils/src/mix';

import ResizeState from './resizerstate';

/**
 * Stores the internal state of a single resizable object.
 *
 * @class Resizer
 */
export default class Resizer {
	/**
	 * @param {module:widget/widgetresizer~ResizerOptions} options Resizer options.
	 */
	constructor( options ) {
		/**
		 * @readonly
		 * @member {module:widget/widgetresizer/resizerstate~ResizerState} #state
		 */

		/**
		 * @private
		 * @type {module:widget/widgetresizer~ResizerOptions}
		 */
		this._options = options;

		/**
		 * Container of the entire resize UI.
		 *
		 * Note that this property is initialized only after the element bound with the resizer is drawn
		 * so it will be a `null` when uninitialized.
		 *
		 * @private
		 * @type {HTMLElement|null}
		 */
		this._domResizerWrapper = null;

		/**
		 * View to a wrapper containing all the resizer-related views.
		 *
		 * @private
		 * @type {module:engine/view/uielement~UIElement}
		 */
		this._viewResizerWrapper = null;

		/**
		 * @observable
		 * @readonly
		 * @member {Boolean} #isEnabled
		 */
		this.set( 'isEnabled', true );

		this.decorate( 'begin' );
		this.decorate( 'cancel' );
		this.decorate( 'commit' );
		this.decorate( 'updateSize' );
	}

	/**
	 *
	 */
	attach() {
		const that = this;
		const widgetElement = this._options.viewElement;
		const writer = this._options.downcastWriter;

		this._viewResizerWrapper = writer.createUIElement( 'div', {
			class: 'ck ck-reset_all ck-widget__resizer'
		}, function( domDocument ) {
			const domElement = this.toDomElement( domDocument );

			that._appendHandles( domElement );
			that._appendSizeUI( domElement );

			that._domResizerWrapper = domElement;

			return domElement;
		} );

		this.on( 'set:isEnabled', ( event, name, newValue ) => {
			if ( newValue ) {
				writer.removeClass( 'ck-hidden', this._viewResizerWrapper );
				this.cancel();
			} else {
				writer.addClass( 'ck-hidden', this._viewResizerWrapper );
			}
		} );

		// Append resizer wrapper to the widget's wrapper.
		writer.insert( writer.createPositionAt( widgetElement, 'end' ), this._viewResizerWrapper );
		writer.addClass( 'ck-widget_with-resizer', widgetElement );
	}

	begin( domResizeHandle ) {
		this.state = new ResizeState( this._options );

		this.sizeUI.bindToState( this.state );

		this.state.begin( domResizeHandle, this._getResizeHost() );

		this.redraw();
	}

	updateSize( domEventData ) {
		const resizeHost = this._getResizeHost();
		const newSize = this._proposeNewSize( domEventData );

		resizeHost.style.width = newSize.width + 'px';

		this.state.fetchSizeFromElement( resizeHost );

		// Refresh values based on the real image. Real image might be limited by max-width, and thus fetching it
		// here will reflect this limitation.
		this._domResizerWrapper.style.width = this.state.proposedWidth + 'px';
		this._domResizerWrapper.style.height = this.state.proposedHeight + 'px';
	}

	commit() {
		this._options.onCommit( this.state );

		this._cleanup();
	}

	/**
	 * Cancels and rejects proposed resize dimensions hiding all the UI.
	 */
	cancel() {
		this._cleanup();
	}

	destroy() {
		this.cancel();
	}

	redraw() {
		const domWrapper = this._domResizerWrapper;

		if ( existsInDom( domWrapper ) ) {
			// Refresh only if resizer exists in the DOM.
			const widgetWrapper = domWrapper.parentElement;
			const resizingHost = this._getResizeHost();
			const clientRect = new Rect( resizingHost );

			domWrapper.style.width = clientRect.width + 'px';
			domWrapper.style.height = clientRect.height + 'px';

			// In case a resizing host is not a widget wrapper, we need to compensate
			// for any additional offsets the resize host might have. E.g. wrapper padding
			// or simply another editable. By doing that the border and resizers are shown
			// only around the resize host.
			if ( !widgetWrapper.isSameNode( resizingHost ) ) {
				domWrapper.style.left = resizingHost.offsetLeft + 'px';
				domWrapper.style.top = resizingHost.offsetTop + 'px';

				domWrapper.style.height = resizingHost.offsetHeight + 'px';
				domWrapper.style.width = resizingHost.offsetWidth + 'px';
			}
		}

		function existsInDom( element ) {
			return element && element.ownerDocument && element.ownerDocument.contains( element );
		}
	}

	containsHandle( domElement ) {
		return this._domResizerWrapper.contains( domElement );
	}

	static isResizeHandle( domElement ) {
		return domElement.classList.contains( 'ck-widget__resizer__handle' );
	}

	/**
	 * Cleans up the context state.
	 *
	 * @protected
	 */
	_cleanup() {
		if ( this.sizeUI ) {
			this.sizeUI.dismiss();
			this.sizeUI.isVisible = false;
		}
	}

	/**
	 * Method used to calculate the proposed size as the resize handles are dragged.
	 *
	 * @private
	 * @param {Event} domEventData Event data that caused the size update request. It should be used to calculate the proposed size.
	 * @returns {Object} return
	 * @returns {Number} return.x Proposed width.
	 * @returns {Number} return.y Proposed height.
	 */
	_proposeNewSize( domEventData ) {
		const state = this.state;
		const currentCoordinates = extractCoordinates( domEventData );
		const isCentered = this._options.isCentered ? this._options.isCentered( this ) : true;
		const originalSize = state.originalSize;

		// Enlargement defines how much the resize host has changed in a given axis. Naturally it could be a negative number
		// meaning that it has been shrunk.
		//
		// +----------------+--+
		// |                |  |
		// |       img      |  |
		// |                |  |
		// +----------------+  | ^
		// |                   | | - enlarge y
		// +-------------------+ v
		// 					<-->
		// 					 enlarge x
		const enlargement = {
			x: state._referenceCoordinates.x - ( currentCoordinates.x + originalSize.width ),
			y: ( currentCoordinates.y - originalSize.height ) - state._referenceCoordinates.y
		};

		if ( isCentered && state.activeHandlePosition.endsWith( '-right' ) ) {
			enlargement.x = currentCoordinates.x - ( state._referenceCoordinates.x + originalSize.width );
		}

		// Objects needs to be resized twice as much in horizontal axis if centered, since enlargement is counted from
		// one resized corner to your cursor. It needs to be duplicated to compensate for the other side too.
		if ( isCentered ) {
			enlargement.x *= 2;
		}

		// const resizeHost = this._getResizeHost();

		// The size proposed by the user. It does not consider the aspect ratio.
		const proposedSize = {
			width: Math.abs( originalSize.width + enlargement.x ),
			height: Math.abs( originalSize.height + enlargement.y )
		};

		// Dominant determination must take the ratio into account.
		proposedSize.dominant = proposedSize.width / state.aspectRatio > proposedSize.height ? 'width' : 'height';
		proposedSize.max = proposedSize[ proposedSize.dominant ];

		// Proposed size, respecting the aspect ratio.
		const targetSize = {
			width: proposedSize.width,
			height: proposedSize.height
		};

		if ( proposedSize.dominant == 'width' ) {
			targetSize.height = targetSize.width / state.aspectRatio;
		} else {
			targetSize.width = targetSize.height * state.aspectRatio;
		}

		return targetSize;
	}

	/**
	 * Method used to obtain the resize host.
	 *
	 * Resize host is an object that is actually resized.
	 *
	 * Resize host will not always be an entire widget itself. Take an image as an example. Image widget
	 * contains an image and caption. Only the image should be used to resize the widget, while the caption
	 * will simply follow the image size.
	 *
	 * @protected
	 * @returns {HTMLElement}
	 */
	_getResizeHost() {
		const widgetWrapper = this._domResizerWrapper.parentElement;

		return this._options.getResizeHost ?
			this._options.getResizeHost( widgetWrapper ) : widgetWrapper;
	}

	/**
	 * Renders the resize handles in DOM.
	 *
	 * @private
	 * @param {HTMLElement} domElement The resizer wrapper.
	 */
	_appendHandles( domElement ) {
		const resizerPositions = [ 'top-left', 'top-right', 'bottom-right', 'bottom-left' ];

		for ( const currentPosition of resizerPositions ) {
			domElement.appendChild( ( new Template( {
				tag: 'div',
				attributes: {
					class: `ck-widget__resizer__handle ${ getResizerClass( currentPosition ) }`
				}
			} ).render() ) );
		}
	}

	/**
	 * @private
	 * @param {HTMLElement} domElement
	 */
	_appendSizeUI( domElement ) {
		const sizeUI = new SizeView();

		// Make sure icon#element is rendered before passing to appendChild().
		sizeUI.render();

		this.sizeUI = sizeUI;

		domElement.appendChild( sizeUI.element );
	}

	/**
	 * Determines the position of a given resize handle.
	 *
	 * @private
	 * @param {HTMLElement} domHandle Handler used to calculate reference point.
	 * @returns {String|undefined} Returns a string like `"top-left"` or `undefined` if not matched.
	 */
	_getHandlePosition( domHandle ) {
		const resizerPositions = [ 'top-left', 'top-right', 'bottom-right', 'bottom-left' ];

		for ( const position of resizerPositions ) {
			if ( domHandle.classList.contains( getResizerClass( position ) ) ) {
				return position;
			}
		}
	}
}

mix( Resizer, ObservableMixin );

class SizeView extends View {
	constructor() {
		super();

		const bind = this.bindTemplate;

		this.setTemplate( {
			tag: 'div',
			attributes: {
				class: [
					'ck',
					'ck-size-view',
					bind.to( 'activeHandlePosition', value => value ? `ck-orientation-${ value }` : '' )
				],
				style: {
					display: bind.if( 'isVisible', 'none', visible => !visible )
				}
			},
			children: [ {
				text: bind.to( 'label' )
			} ]
		} );
	}

	bindToState( resizerState ) {
		this.bind( 'isVisible' ).to( resizerState, 'proposedWidth', resizerState, 'proposedHeight', ( x, y ) =>
			x !== null && y !== null );

		this.bind( 'label' ).to( resizerState, 'proposedWidth', resizerState, 'proposedHeight', ( x, y ) =>
			`${ Math.round( x ) }×${ Math.round( y ) }` );

		this.bind( 'activeHandlePosition' ).to( resizerState );
	}

	dismiss() {
		this.unbind();
		this.isVisible = false;
	}
}

// @param {String} resizerPosition Expected resizer position like `"top-left"`, `"bottom-right"`.
// @returns {String} A prefixed HTML class name for the resizer element
function getResizerClass( resizerPosition ) {
	return `ck-widget__resizer__handle-${ resizerPosition }`;
}

function extractCoordinates( event ) {
	return {
		x: event.pageX,
		y: event.pageY
	};
}
