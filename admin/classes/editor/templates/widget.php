<?php

/**
 * Block attributes.
 *
 * The following attributes are available:
 *
 * @var $attributes array(
 * )
 */

if (!defined('ABSPATH')) exit;

$classes = [];
$column_content_classes = array();

$shortcode = sprintf('[ajaxy-live-search show_category="%s" show_post_category="%s" post_types="%s" label="%s" width="%s" delay="%s" iwidth="%s" url="%s" credits="1" border="%s"]', $attributes['showCategories'], $attributes['showPostCategories'], implode(',', $attributes['postTypes']), $attributes['searchLabel'], sprintf("%s%s", $attributes['resultsWidth'], $attributes['resultsWidthUnit']), $attributes['delay'], $attributes['width'], $attributes['searchUrl'], sprintf("%spx %s %s", $attributes['borderWidth'], $attributes['borderType'] ?? 'solid', $attributes['borderColor']));

?>
<?php echo do_shortcode($shortcode); ?>
