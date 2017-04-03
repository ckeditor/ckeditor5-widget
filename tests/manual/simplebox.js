/**
 * @license Copyright (c) 2003-2017, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md.
 */

/* global console, window */

import ClassicEditor from '@ckeditor/ckeditor5-editor-classic/src/classic';
import Enter from '@ckeditor/ckeditor5-enter/src/enter';
import Typing from '@ckeditor/ckeditor5-typing/src/typing';
import Paragraph from '@ckeditor/ckeditor5-paragraph/src/paragraph';
import Heading from '@ckeditor/ckeditor5-heading/src/heading';
import Widget from '@ckeditor/ckeditor5-widget/src/widget';
import Undo from '@ckeditor/ckeditor5-undo/src/undo';
import global from '@ckeditor/ckeditor5-utils/src/dom/global';
import Plugin from '@ckeditor/ckeditor5-core/src/plugin';
import buildModelConverter from '@ckeditor/ckeditor5-engine/src/conversion/buildmodelconverter';
import buildViewConverter from '@ckeditor/ckeditor5-engine/src/conversion/buildviewconverter';
import ViewEditableElement from '@ckeditor/ckeditor5-engine/src/view/editableelement';
import { toWidget, toWidgetEditable } from '../../src/utils';
import ViewContainerElement from '@ckeditor/ckeditor5-engine/src/view/containerelement';

export default class SimpleBoxEngine extends Plugin {
	/**
	 * @inheritDoc
	 */
	init() {
		const editor = this.editor;
		const doc = editor.document;
		const schema = doc.schema;
		const data = editor.data;
		const editing = editor.editing;
		const t = editor.t;

		// Simplebox widget
		schema.registerItem( 'simplebox' );
		schema.allow( { name: 'simplebox', inside: '$root' } );
		schema.objects.add( 'simplebox' );

		// Build converter from model to view for data pipeline.
		buildModelConverter().for( data.modelToView )
			.fromElement( 'simplebox' )
			.toElement( () => createSimpleBoxElement() );

		// Build converter from model to view for editing pipeline.
		buildModelConverter().for( editing.modelToView )
			.fromElement( 'simplebox' )
			.toElement( () => toWidget( createSimpleBoxElement(), { label: t( 'simple box widget' ) } ) );

		// View to data conversion for data pipeline.
		buildViewConverter().for( data.viewToModel )
			.from( { name: 'div', class: 'simplebox' } )
			.toElement( 'simplebox' );

		// Simple box title.
		schema.registerItem( 'simplebox-title' );
		schema.allow( { name: '$inline', inside: 'simplebox-title' } );
		schema.allow( { name: 'simplebox-title', inside: 'simplebox' } );
		schema.limits.add( 'simplebox-title' );

		buildModelConverter().for( data.modelToView )
			.fromElement( 'simplebox-title' )
			.toElement( () => new ViewContainerElement( 'h2', { class: 'simplebox-title' } ) );

		buildModelConverter().for( editing.modelToView )
			.fromElement( 'simplebox-title' )
			.toElement( () => toTitleNestedEditable( editing.view ) );

		buildViewConverter().for( data.viewToModel )
			.from( { name: 'h2' } ) // TODO check if inside simplebox
			.toElement( 'simplebox-title' );

		// Simple box content.
		schema.registerItem( 'simplebox-content' );
		schema.allow( { name: '$inline', inside: 'simplebox-content' } );
		schema.allow( { name: 'simplebox-content', inside: 'simplebox' } );
		schema.objects.add( 'simplebox-content' );

		buildModelConverter().for( data.modelToView )
			.fromElement( 'simplebox-content' )
			.toElement( () => new ViewContainerElement( 'div', { class: 'simplebox-content' } ) );

		buildModelConverter().for( editing.modelToView )
			.fromElement( 'simplebox-content' )
			.toElement( () => toContentNestedEditable( editing.view ) );

		buildViewConverter().for( data.viewToModel )
			.from( { name: 'div' } ) // TODO check if inside simplebox
			.toElement( 'simplebox-content' );
	}
}

function createSimpleBoxElement() {
	return new ViewContainerElement( 'div', { class: 'simplebox' } );
}

function toTitleNestedEditable( viewDocument ) {
	const editable = new ViewEditableElement( 'h2' );
	editable.document = viewDocument;

	return toWidgetEditable( editable );
}

function toContentNestedEditable( viewDocument ) {
	const editable = new ViewEditableElement( 'div' );
	editable.document = viewDocument;

	return toWidgetEditable( editable );
}

ClassicEditor.create( global.document.querySelector( '#editor' ), {
	plugins: [ Enter, Typing, Paragraph, Undo, Heading, Widget, SimpleBoxEngine ],
	toolbar: [ 'headings', 'undo', 'redo' ]
} )
.then( editor => {
	window.editor = editor;
} )
.catch( err => {
	console.error( err.stack );
} );
