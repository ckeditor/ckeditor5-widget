/**
 * @license Copyright (c) 2003-2020, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/* global document */

import DowncastWriter from '@ckeditor/ckeditor5-engine/src/view/downcastwriter';
import ViewText from '@ckeditor/ckeditor5-engine/src/view/text';
import ViewElement from '@ckeditor/ckeditor5-engine/src/view/element';
import ViewPosition from '@ckeditor/ckeditor5-engine/src/view/position';
import ViewEditableElement from '@ckeditor/ckeditor5-engine/src/view/editableelement';
import ViewDocument from '@ckeditor/ckeditor5-engine/src/view/document';
import {
	toWidget,
	isWidget,
	setLabel,
	getLabel,
	toWidgetEditable,
	setHighlightHandling,
	findOptimalInsertionPosition,
	viewToModelPositionOutsideModelElement,
	WIDGET_CLASS_NAME
} from '../src/utils';
import UIElement from '@ckeditor/ckeditor5-engine/src/view/uielement';
import env from '@ckeditor/ckeditor5-utils/src/env';
import testUtils from '@ckeditor/ckeditor5-core/tests/_utils/utils';
import Model from '@ckeditor/ckeditor5-engine/src/model/model';
import { setData } from '@ckeditor/ckeditor5-engine/src/dev-utils/model';
import Mapper from '@ckeditor/ckeditor5-engine/src/conversion/mapper';
import ModelElement from '@ckeditor/ckeditor5-engine/src/model/element';
import ModelText from '@ckeditor/ckeditor5-engine/src/model/text';

describe( 'widget utils', () => {
	let element, writer, viewDocument;

	testUtils.createSinonSandbox();

	beforeEach( () => {
		// Most tests assume non-edge environment but we do not set `contenteditable=false` on Edge so stub `env.isEdge`.
		testUtils.sinon.stub( env, 'isEdge' ).get( () => false );

		viewDocument = new ViewDocument();
		writer = new DowncastWriter( viewDocument );

		element = writer.createContainerElement( 'div' );
		toWidget( element, writer );
	} );

	describe( 'toWidget()', () => {
		it( 'should set contenteditable to "false"', () => {
			expect( element.getAttribute( 'contenteditable' ) ).to.equal( 'false' );
		} );

		it( 'should define getFillerOffset method', () => {
			expect( element.getFillerOffset ).to.be.a( 'function' );
			expect( element.getFillerOffset() ).to.be.null;
		} );

		it( 'should add proper CSS class', () => {
			expect( element.hasClass( WIDGET_CLASS_NAME ) ).to.be.true;
		} );

		it( 'should add element\'s label if one is provided', () => {
			toWidget( element, writer, { label: 'foo bar baz label' } );

			expect( getLabel( element ) ).to.equal( 'foo bar baz label' );
		} );

		it( 'should add element\'s label if one is provided as function', () => {
			toWidget( element, writer, { label: () => 'foo bar baz label' } );

			expect( getLabel( element ) ).to.equal( 'foo bar baz label' );
		} );

		it( 'should set default highlight handling methods', () => {
			toWidget( element, writer );

			const set = element.getCustomProperty( 'addHighlight' );
			const remove = element.getCustomProperty( 'removeHighlight' );

			expect( typeof set ).to.equal( 'function' );
			expect( typeof remove ).to.equal( 'function' );

			set( element, { priority: 1, classes: 'highlight', id: 'highlight' }, writer );
			expect( element.hasClass( 'highlight' ) ).to.be.true;

			remove( element, 'highlight', writer );
			expect( element.hasClass( 'highlight' ) ).to.be.false;
		} );

		it( 'should set default highlight handling methods - CSS classes array', () => {
			toWidget( element, writer );

			const set = element.getCustomProperty( 'addHighlight' );
			const remove = element.getCustomProperty( 'removeHighlight' );

			expect( typeof set ).to.equal( 'function' );
			expect( typeof remove ).to.equal( 'function' );

			set( element, { priority: 1, classes: [ 'highlight', 'foo' ], id: 'highlight' }, writer );
			expect( element.hasClass( 'highlight' ) ).to.be.true;
			expect( element.hasClass( 'foo' ) ).to.be.true;

			remove( element, 'highlight', writer );
			expect( element.hasClass( 'highlight' ) ).to.be.false;
			expect( element.hasClass( 'foo' ) ).to.be.false;
		} );

		it( 'should add element a selection handle to widget if hasSelectionHandle=true is passed', () => {
			toWidget( element, writer, { hasSelectionHandle: true } );

			expect( element.hasClass( 'ck-widget_with-selection-handle' ) ).to.be.true;

			const selectionHandle = element.getChild( 0 );
			expect( selectionHandle ).to.be.instanceof( UIElement );

			const domSelectionHandle = selectionHandle.render( document );

			expect( domSelectionHandle.classList.contains( 'ck' ) ).to.be.true;
			expect( domSelectionHandle.classList.contains( 'ck-widget__selection-handle' ) ).to.be.true;

			const icon = domSelectionHandle.firstChild;

			expect( icon.nodeName ).to.equal( 'svg' );
			expect( icon.classList.contains( 'ck' ) ).to.be.true;
			expect( icon.classList.contains( 'ck-icon' ) ).to.be.true;
		} );

		describe( 'on Edge', () => {
			beforeEach( () => {
				testUtils.sinon.stub( env, 'isEdge' ).get( () => true );

				element = writer.createContainerElement( 'div' );
				toWidget( element, writer );
			} );

			it( 'should not set contenteditable onEdge', () => {
				expect( element.getAttribute( 'contenteditable' ) ).to.be.undefined;
			} );
		} );
	} );

	describe( 'isWidget()', () => {
		it( 'should return true for widgetized elements', () => {
			expect( isWidget( element ) ).to.be.true;
		} );

		it( 'should return false for non-widgetized elements', () => {
			expect( isWidget( new ViewElement( 'p' ) ) ).to.be.false;
		} );

		it( 'should return false for text node', () => {
			expect( isWidget( new ViewText( 'p' ) ) ).to.be.false;
		} );
	} );

	describe( 'label utils', () => {
		it( 'should allow to set label for element', () => {
			const element = new ViewElement( 'p' );
			setLabel( element, 'foo bar baz', writer );

			expect( getLabel( element ) ).to.equal( 'foo bar baz' );
		} );

		it( 'should return empty string for elements without label', () => {
			const element = new ViewElement( 'div' );

			expect( getLabel( element ) ).to.equal( '' );
		} );

		it( 'should allow to use a function as label creator', () => {
			const element = new ViewElement( 'p' );
			let caption = 'foo';
			setLabel( element, () => caption, writer );

			expect( getLabel( element ) ).to.equal( 'foo' );
			caption = 'bar';
			expect( getLabel( element ) ).to.equal( 'bar' );
		} );
	} );

	describe( 'toWidgetEditable()', () => {
		let viewDocument, element;

		beforeEach( () => {
			viewDocument = new ViewDocument();
			element = new ViewEditableElement( 'div' );
			element._document = viewDocument;
			toWidgetEditable( element, writer );
		} );

		it( 'should be created in context of proper document', () => {
			expect( element.document ).to.equal( viewDocument );
		} );

		it( 'should add proper class', () => {
			expect( element.hasClass( 'ck-editor__editable', 'ck-editor__nested-editable' ) ).to.be.true;
		} );

		it( 'should add proper contenteditable value when element is read-only - initialization', () => {
			const element = new ViewEditableElement( 'div' );
			element._document = viewDocument;
			element.isReadOnly = true;
			toWidgetEditable( element, writer );

			expect( element.getAttribute( 'contenteditable' ) ).to.equal( 'false' );
		} );

		it( 'should add proper contenteditable value when element is read-only - when changing', () => {
			element.isReadOnly = true;
			expect( element.getAttribute( 'contenteditable' ) ).to.equal( 'false' );

			element.isReadOnly = false;
			expect( element.getAttribute( 'contenteditable' ) ).to.equal( 'true' );
		} );

		it( 'should add proper class when element is focused', () => {
			element.isFocused = true;
			expect( element.hasClass( 'ck-editor__nested-editable_focused' ) ).to.be.true;

			element.isFocused = false;
			expect( element.hasClass( 'ck-editor__nested-editable_focused' ) ).to.be.false;
		} );

		describe( 'on Edge', () => {
			beforeEach( () => {
				testUtils.sinon.stub( env, 'isEdge' ).get( () => true );

				viewDocument = new ViewDocument();
				element = new ViewEditableElement( 'div' );
				element._document = viewDocument;
				toWidgetEditable( element, writer );
			} );

			it( 'should add contenteditable attribute when element is read-only - initialization', () => {
				const element = new ViewEditableElement( 'div' );
				element._document = viewDocument;
				element.isReadOnly = true;
				toWidgetEditable( element, writer );

				expect( element.getAttribute( 'contenteditable' ) ).to.be.undefined;
			} );

			it( 'should add contenteditable attribute when element is read-only - when changing', () => {
				element.isReadOnly = true;
				expect( element.getAttribute( 'contenteditable' ) ).to.be.undefined;

				element.isReadOnly = false;
				expect( element.getAttribute( 'contenteditable' ) ).to.be.undefined;
			} );
		} );
	} );

	describe( 'addHighlightHandling()', () => {
		let element, addSpy, removeSpy, set, remove;

		beforeEach( () => {
			element = new ViewElement( 'p' );
			addSpy = sinon.spy();
			removeSpy = sinon.spy();

			setHighlightHandling( element, writer, addSpy, removeSpy );
			set = element.getCustomProperty( 'addHighlight' );
			remove = element.getCustomProperty( 'removeHighlight' );
		} );

		it( 'should set highlight handling methods', () => {
			expect( typeof set ).to.equal( 'function' );
			expect( typeof remove ).to.equal( 'function' );
		} );

		it( 'should call highlight methods when descriptor is added and removed', () => {
			const descriptor = { priority: 10, classes: 'highlight', id: 'highlight' };

			set( element, descriptor, writer );
			remove( element, descriptor.id, writer );

			sinon.assert.calledOnce( addSpy );
			sinon.assert.calledWithExactly( addSpy, element, descriptor, writer );

			sinon.assert.calledOnce( removeSpy );
			sinon.assert.calledWithExactly( removeSpy, element, descriptor, writer );
		} );

		it( 'should call highlight methods when next descriptor is added', () => {
			const descriptor = { priority: 10, classes: 'highlight', id: 'highlight-1' };
			const secondDescriptor = { priority: 11, classes: 'highlight', id: 'highlight-2' };

			set( element, descriptor );
			set( element, secondDescriptor );

			sinon.assert.calledTwice( addSpy );
			expect( addSpy.firstCall.args[ 1 ] ).to.equal( descriptor );
			expect( addSpy.secondCall.args[ 1 ] ).to.equal( secondDescriptor );
		} );

		it( 'should not call highlight methods when descriptor with lower priority is added', () => {
			const descriptor = { priority: 10, classes: 'highlight', id: 'highlight-1' };
			const secondDescriptor = { priority: 9, classes: 'highlight', id: 'highlight-2' };

			set( element, descriptor );
			set( element, secondDescriptor );

			sinon.assert.calledOnce( addSpy );
			expect( addSpy.firstCall.args[ 1 ] ).to.equal( descriptor );
		} );

		it( 'should call highlight methods when descriptor is removed changing active descriptor', () => {
			const descriptor = { priority: 10, classes: 'highlight', id: 'highlight-1' };
			const secondDescriptor = { priority: 11, classes: 'highlight', id: 'highlight-2' };

			set( element, descriptor );
			set( element, secondDescriptor );
			remove( element, secondDescriptor.id );

			sinon.assert.calledThrice( addSpy );
			expect( addSpy.firstCall.args[ 1 ] ).to.equal( descriptor );
			expect( addSpy.secondCall.args[ 1 ] ).to.equal( secondDescriptor );
			expect( addSpy.thirdCall.args[ 1 ] ).to.equal( descriptor );

			sinon.assert.calledTwice( removeSpy );
			expect( removeSpy.firstCall.args[ 1 ] ).to.equal( descriptor );
			expect( removeSpy.secondCall.args[ 1 ] ).to.equal( secondDescriptor );
		} );

		it( 'should call highlight methods when descriptor is removed not changing active descriptor', () => {
			const descriptor = { priority: 10, classes: 'highlight', id: 'highlight-1' };
			const secondDescriptor = { priority: 9, classes: 'highlight', id: 'highlight-2' };

			set( element, descriptor );
			set( element, secondDescriptor );
			remove( element, secondDescriptor );

			sinon.assert.calledOnce( addSpy );
			expect( addSpy.firstCall.args[ 1 ] ).to.equal( descriptor );

			sinon.assert.notCalled( removeSpy );
		} );

		it( 'should call highlight methods - CSS class array', () => {
			const descriptor = { priority: 10, classes: [ 'highlight', 'a' ], id: 'highlight-1' };
			const secondDescriptor = { priority: 10, classes: [ 'highlight', 'b' ], id: 'highlight-2' };

			set( element, descriptor );
			set( element, secondDescriptor );

			sinon.assert.calledTwice( addSpy );
			expect( addSpy.firstCall.args[ 1 ] ).to.equal( descriptor );
			expect( addSpy.secondCall.args[ 1 ] ).to.equal( secondDescriptor );
		} );
	} );

	describe( 'findOptimalInsertionPosition()', () => {
		let model, doc;

		beforeEach( () => {
			model = new Model();
			doc = model.document;

			doc.createRoot();

			model.schema.register( 'paragraph', { inheritAllFrom: '$block' } );
			model.schema.register( 'image' );
			model.schema.register( 'span' );

			model.schema.extend( 'image', {
				allowIn: '$root',
				isObject: true,
				isBlock: true
			} );

			model.schema.extend( 'span', { allowIn: 'paragraph' } );
			model.schema.extend( '$text', { allowIn: 'span' } );
		} );

		it( 'returns position after selected element', () => {
			setData( model, '<paragraph>x</paragraph>[<image></image>]<paragraph>y</paragraph>' );

			const pos = findOptimalInsertionPosition( doc.selection, model );

			expect( pos.path ).to.deep.equal( [ 2 ] );
		} );

		it( 'returns position before parent block if an inline object is selected', () => {
			model.schema.register( 'placeholder', {
				allowWhere: '$text',
				isInline: true,
				isObject: true
			} );

			setData( model, '<paragraph>x</paragraph><paragraph>f[<placeholder></placeholder>]oo</paragraph><paragraph>y</paragraph>' );

			const pos = findOptimalInsertionPosition( doc.selection, model );

			expect( pos.path ).to.deep.equal( [ 1 ] );
		} );

		it( 'returns position inside empty block', () => {
			setData( model, '<paragraph>x</paragraph><paragraph>[]</paragraph><paragraph>y</paragraph>' );

			const pos = findOptimalInsertionPosition( doc.selection, model );

			expect( pos.path ).to.deep.equal( [ 1, 0 ] );
		} );

		it( 'returns position before block if at the beginning of that block', () => {
			setData( model, '<paragraph>x</paragraph><paragraph>[]foo</paragraph><paragraph>y</paragraph>' );

			const pos = findOptimalInsertionPosition( doc.selection, model );

			expect( pos.path ).to.deep.equal( [ 1 ] );
		} );

		it( 'returns position before block if in the middle of that block (collapsed selection)', () => {
			setData( model, '<paragraph>x</paragraph><paragraph>f[]oo</paragraph><paragraph>y</paragraph>' );

			const pos = findOptimalInsertionPosition( doc.selection, model );

			expect( pos.path ).to.deep.equal( [ 1 ] );
		} );

		it( 'returns position before block if in the middle of that block (non-collapsed selection)', () => {
			setData( model, '<paragraph>x</paragraph><paragraph>f[o]o</paragraph><paragraph>y</paragraph>' );

			const pos = findOptimalInsertionPosition( doc.selection, model );

			expect( pos.path ).to.deep.equal( [ 1 ] );
		} );

		it( 'returns position after block if at the end of that block', () => {
			setData( model, '<paragraph>x</paragraph><paragraph>foo[]</paragraph><paragraph>y</paragraph>' );

			const pos = findOptimalInsertionPosition( doc.selection, model );

			expect( pos.path ).to.deep.equal( [ 2 ] );
		} );

		// Checking if isTouching() was used.
		it( 'returns position after block if at the end of that block (deeply nested)', () => {
			setData( model, '<paragraph>x</paragraph><paragraph>foo<span>bar[]</span></paragraph><paragraph>y</paragraph>' );

			const pos = findOptimalInsertionPosition( doc.selection, model );

			expect( pos.path ).to.deep.equal( [ 2 ] );
		} );

		it( 'returns selection focus if not in a block', () => {
			model.schema.extend( '$text', { allowIn: '$root' } );
			setData( model, 'foo[]bar' );

			const pos = findOptimalInsertionPosition( doc.selection, model );

			expect( pos.path ).to.deep.equal( [ 3 ] );
		} );
	} );

	describe( 'viewToModelPositionOutsideModelElement()', () => {
		let mapper, model, modelP, viewP, viewXyz, modelSpan, viewSpan;

		beforeEach( () => {
			mapper = new Mapper();
			model = new Model();

			// MODEL: <p>foo<span></span>bar</p>
			const modelFoo = new ModelText( 'foo' );
			modelSpan = new ModelElement( 'span' );
			const modelBar = new ModelText( 'bar' );
			modelP = new ModelElement( 'p', null, [ modelFoo, modelSpan, modelBar ] );

			// VIEW: <p>foo<span>xyz</span>bar</p>
			const viewFoo = new ViewText( 'foo' );
			viewXyz = new ViewText( 'xyz' );
			viewSpan = new ViewElement( 'span', null, viewXyz );
			const viewBar = new ViewText( 'bar' );
			viewP = new ViewElement( 'p', null, [ viewFoo, viewSpan, viewBar ] );

			mapper.bindElements( modelP, viewP );
			mapper.bindElements( modelSpan, viewSpan );
		} );

		it( 'should map view position that is at the beginning of the view element to a position before the model element', () => {
			mapper.on( 'viewToModelPosition', viewToModelPositionOutsideModelElement( model, viewElement => viewElement.name == 'span' ) );

			// View:
			// <p>foo<span>|xyz</span>bar</p>.
			const viewPosition = new ViewPosition( viewXyz, 0 );

			// Model:
			// <p>foo|<span></span>bar</p>.
			const modelPosition = mapper.toModelPosition( viewPosition );

			expect( modelPosition.path ).to.deep.equal( [ 3 ] );
		} );

		it( 'should map view position that is in the middle of the view element to a position after the model element', () => {
			mapper.on( 'viewToModelPosition', viewToModelPositionOutsideModelElement( model, viewElement => viewElement.name == 'span' ) );

			// View:
			// <p>foo<span>x|yz</span>bar</p>.
			const viewPosition = new ViewPosition( viewXyz, 1 );

			// Model:
			// <p>foo|<span></span>bar</p>.
			const modelPosition = mapper.toModelPosition( viewPosition );

			expect( modelPosition.path ).to.deep.equal( [ 4 ] );
		} );

		it( 'should map view position that is at the end of the view element to a position after the model element', () => {
			mapper.on( 'viewToModelPosition', viewToModelPositionOutsideModelElement( model, viewElement => viewElement.name == 'span' ) );

			// View:
			// <p>foo<span>xyz|</span>bar</p>.
			const viewPosition = new ViewPosition( viewXyz, 3 );

			// Model:
			// <p>foo<span></span>|bar</p>.
			const modelPosition = mapper.toModelPosition( viewPosition );

			expect( modelPosition.path ).to.deep.equal( [ 4 ] );
		} );

		it( 'should not fire if view element is not matched', () => {
			mapper.on( 'viewToModelPosition', viewToModelPositionOutsideModelElement( model, () => false ) );

			// View:
			// <p>foo<span>x|yz</span>bar</p>.
			const viewPosition = new ViewPosition( viewXyz, 1 );

			// Model:
			// <p>foo<span>x|yz</span>bar</p>.
			modelSpan._appendChild( new ModelText( 'xyz' ) );
			const modelPosition = mapper.toModelPosition( viewPosition );

			expect( modelPosition.path ).to.deep.equal( [ 3, 1 ] );
		} );
	} );
} );
