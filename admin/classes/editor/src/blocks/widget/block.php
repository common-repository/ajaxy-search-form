<?php

if ( ! defined( 'ABSPATH' ) ) exit;

return array(
    'apiVersion' => 2,
    'name' => 'ajaxy-blocks/widget',
    'title' => 'Ajaxy Instant Search Widget',
    'category' => 'ajaxy-blocks',
    'description' => 'Live search',
    'keywords' =>
    array(
        0 => 'search',
        1 => 'live search',
    ),
    'textdomain' => 'default',
    'attributes' =>
    array(
        'postTypes' =>
        array(
            'type' =>'array',
        ),
        "showCategories" =>
        array(
            'type' => 'boolean',
        ),
		"rtlStyles" => array(
            'type' => 'boolean',
        ),
		"showPostCategories" => array(
            'type' => 'boolean',
        ),
		"searchLabel" => array(
            'type' => 'string',
        ),
		"delay" => array(
            'type' => 'string',
        ),
		"credits" => array(
            'type' => 'boolean',
        ),
		"searchUrl" => array(
            'type' => 'string',
        ),
		"borderColor" => array(
            'type' => 'string',
        ),
		"borderType" => array(
            'type' => 'string',
        ),
		"borderWidth" => array(
            'type' => 'string',
        ),
		"resultsWidth" => array(
            'type' => 'string',
        ),
		"resultsWidthUnit" => array(
            'type' => 'string',
        ),
		"width" => array(
            'type' => 'string',
        ),
    ),
    'supports' =>
    array(
        'anchor' => false,
        'html' => false,
    )
);
