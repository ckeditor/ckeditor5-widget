/**
 * @license Copyright (c) 2003-2020, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/* globals document */

import ClassicTestEditor from '@ckeditor/ckeditor5-core/tests/_utils/classictesteditor';
import ArticlePluginSet from '@ckeditor/ckeditor5-core/tests/_utils/articlepluginset';

import { toWidget } from '../src/utils';
import { setData as setModelData, getData as getModelData } from '@ckeditor/ckeditor5-engine/src/dev-utils/model';

describe( 'Regression', () => {
	let editor, editorElement;

	beforeEach( async () => {
		editorElement = document.createElement( 'div' );
		document.body.appendChild( editorElement );

		editor = await createEditor( editorElement );
	} );

	afterEach( () => {
		editorElement.remove();

		if ( editor ) {
			return editor.destroy();
		}
	} );

	it( 'allows setting the selection before a widget', () => {
		setModelData( editor.model, '[<widget></widget>]' );

		const widgetModel = editor.model.document.getRoot().getChild( 0 );

		editor.model.change( writer => {
			writer.setSelection( widgetModel, 'before' );
		} );

		expect( getModelData( editor.model ) ).to.be.equal( '[]<widget></widget>' );
	} );

	function createEditor( element ) {
		return ClassicTestEditor
			.create( element, {
				plugins: [
					ArticlePluginSet, simpleWidgetPlugin
				]
			} );

		function simpleWidgetPlugin( editor ) {
			editor.model.schema.register( 'widget', {
				inheritAllFrom: '$block',
				isObject: true
			} );

			editor.conversion.for( 'downcast' )
				.elementToElement( {
					model: 'widget',
					view: ( modelItem, viewWriter ) => {
						return toWidget( viewWriter.createContainerElement( 'div' ), viewWriter );
					}
				} );
		}
	}
} );
