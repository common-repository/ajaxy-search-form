/**
 * External dependencies
 */
import classnames from "classnames";
/**
 * WordPress dependencies
 */
import { __, _x } from "@wordpress/i18n";
import { InspectorControls, useBlockProps } from "@wordpress/block-editor";
import { Panel, PanelBody, ToggleControl, TextControl } from "@wordpress/components";
import { SelectControl } from "@wordpress/components";


function widgetEdit({ attributes, isSelected, setAttributes }) {
	const {
		showCategories,
		rtlStyles,
		postTypes,
		showPostCategories,
		searchLabel,
		delay,
		credits,
		searchUrl,
		borderColor,
		borderType,
		borderWidth,
		resultsWidth,
		resultsWidthUnit,
		width,
	} = attributes;

	const classNames = classnames({
		"is-selected": isSelected,
	});

	const generalSettings = (
		<Panel>
			<PanelBody title={__("Search Settings")}>
				<ToggleControl
					label={__("Show Categories")}
					checked={showCategories}
					onChange={() =>
						setAttributes({
							showCategories: !showCategories,
						})
					}
					help={"Show the categories in the search results."}
				/>
				<ToggleControl
					label={__("Show Post Categories")}
					checked={showPostCategories}
					onChange={() =>
						setAttributes({
							showPostCategories: !showPostCategories,
						})
					}
					help={"Show post of found categories in the search results."}
				/>
				<SelectControl
					label={__("Post types")}
					value={postTypes}
					onChange={(value) =>
						setAttributes({
							postTypes: value,
						})
					}
                    multiple={true}
					// @ts-ignore
					options={ajaxyBlocks.widget.post_types}
					help={"The type of the search form border."}
				/>
			</PanelBody>
			<PanelBody title={__("Search Form Box")}>
				<ToggleControl
					label={__("Use Right to Left styles")}
					checked={rtlStyles}
					onChange={() =>
						setAttributes({
							rtlStyles: !rtlStyles, 
						})
					}
					help={"Check this in case you want to use rtl themes to support right to left languages like arabic."}
				/>
				<TextControl
					label={__("Search label")}
					value={searchLabel}
					onChange={(value) =>
						setAttributes({
							searchLabel: value,
						})
					}
					help={"This label appears inside the search form and will be hidden when the user clicks inside."}
				/>
				<TextControl
					label={__("Width")}
					value={width}
					onChange={(value) =>
						setAttributes({
							width: value,
						})
					}
					type="number"
					help={"The width of the search form (width is per pixel) - the value should be integer."}
				/>
				<TextControl
					label={__("Delay time (in ms)")}
					value={delay}
					onChange={(value) =>
						setAttributes({
							delay: value,
						})
					}
					type="number"
					help={
						"The delay time before showing the results (this will allow the user to input more text before searching) - (in millisecond, i.e 5000 = 5sec)."
					}
				/>
				<TextControl
					label={__("Border width")}
					value={borderWidth}
					onChange={(value) =>
						setAttributes({
							borderWidth: value,
						})
					}
					type="number"
					help={"The width of the search form border."}
				/>
				<SelectControl
					label={__("Border type")}
					value={borderType}
					onChange={(value) =>
						setAttributes({
							borderType: value,
						})
					}
					options={[
						{ label: "Solid", value: "solid" },
						{ label: "Dotted", value: "dotted" },
						{ label: "Dashed", value: "dashed" },
						{ label: "None", value: "none" },
					]}
					help={"The type of the search form border."}
				/>
				<TextControl
					label={__("Border color")}
					value={borderColor}
					onChange={(value) =>
						setAttributes({
							borderColor: value,
						})
					}
					help={"The color of the search form border (color value is hexa-decimal)."}
				/>
			</PanelBody>
			<PanelBody title={__("Search Results box")}>
				<TextControl
					label={__("Width")}
					value={resultsWidth}
					onChange={(value) =>
						setAttributes({
							resultsWidth: value,
						})
					}
					type="number"
					help={"The width of the results box (width is per pixel) - the value should be integer."}
				/>
				<SelectControl
					label={__("Width Unit")}
					value={resultsWidthUnit || "px"}
					onChange={(value) =>
						setAttributes({
							resultsWidthUnit: value,
						})
					}
					options={[
						{ label: "", value: "" },
						{ label: "px", value: "px" },
						{ label: "%", value: "%" },
						{ label: "em", value: "em" },
					]}
					help={"The type of the search form border."}
				/>
			</PanelBody>
			<PanelBody title={__("More Results Box")}>
				<TextControl
					label={__("Search Url")}
					value={searchUrl}
					onChange={(value) =>
						setAttributes({
							searchUrl: value,
						})
					}
					help={'This search URL for the "See more results", keep empty to use the default search url'}
				/>
			</PanelBody>
			<PanelBody title={__("Credits")}>
				<ToggleControl
					label={__('Author "Powered by" link and credits.')}
					checked={credits}
					onChange={() =>
						setAttributes({
							credits: !credits,
						})
					}
				/>
			</PanelBody>
		</Panel>
	);

	const blockProps = useBlockProps({
		className: classNames,
	});

	return (
		<>
			<InspectorControls>{generalSettings}</InspectorControls>
			<div {...blockProps}>
                {/*@ts-ignore*/}
                <img src={ajaxyBlocks.widget.preview} width={190} />
            </div>
		</>
	);
}

export default widgetEdit;
